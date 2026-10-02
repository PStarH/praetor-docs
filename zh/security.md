# 安全体系与隐私保护

Commander 目前处于 **Alpha** 阶段。官方代码库明确声明其尚未达到最终生产就绪，且多租户硬隔离特性**尚未经过生产级实战检验**。本页面客观阐明系统中已存在的安全防御控制措施，以及——同样重要的——**当前尚未实现的限制**。在依赖本系统前，请务必详阅文末的 [限制与诚实免责声明](#限制与诚实免责声明)。

## 一句话威胁模型 (Threat Model)

Commander 运行在您的宿主机或集群中，持有大模型提供商凭据，拥有文件读写与代码执行权能。核心需要保护的资产是：大模型 API 密钥、Commander 内部机密主密钥、流经任务的客户源代码与数据、以及审计存证链的防篡改完整性。面临的主要风险是：凭据被窃、通过工具输出发起的间接提示词注入、智能体工具越权、多租户环境下的租户数据渗透泄露、以及不受约束的无限制外部恶意写入。Commander 针对上述各维度均设计了防御措施，但大部分控制项需要显式配置方可生效，且部分属于可选激活项。

## 身份认证机制 (Authentication)

| 认证机制 | 技术细节与加密实现 |
| --- | --- |
| API Key | 请求头携带 `X-API-Key: <key>` 或 `Authorization: Bearer <key>`。格式为 `cmdr_` 后接 32 字节随机数。在 PostgreSQL 中以**未加盐的原始 SHA-256** 哈希存储，仅在创建时明文返回一次 |
| JWT | 请求头携带 `Authorization: Bearer <jwt>`。**仅支持 HS256 对称签名 HMAC**。访问令牌有效期 24 小时，刷新令牌 7 天。刷新令牌为单次消费，使用后即刻吊销 |
| OIDC | 支持 `GET/POST /api/auth/oidc/*`。通过 JWKS 校验 ID Token，支持 RS256/384/512 与 ES256/384/512 非对称签名算法 |
| SCIM 2.0 | 用户与组织目录自动化同步。需要管理员 JWT 角色或包含 `scim` / `admin` / `*` 作用域的 API Key |
| A2A (智能体间通信) | 携带 `COMMANDER_A2A_AUTH_TOKEN`（或兼容 `A2A_AUTH_TOKEN`）Bearer 令牌，最小长度 16 字符 |

**服务启动时强制校验的密钥规则**

| 环境变量 | 强制校验规则 |
| --- | --- |
| `JWT_SECRET` | 任何环境必填。最小长度 32 字符，拒绝已知的常见公开默认弱密码 |
| `ADMIN_PASSWORD` | 最小长度 16 字符，拒绝默认弱密码。在生产环境或 `COMMANDER_API_REPLICAS > 1` 时强制必填 |
| `COMMANDER_MASTER_KEY` | 最小长度 32 字符，作为加密密钥库 (Encrypted Secrets Vault) 的根主密钥 |
| `COMMANDER_API_KEY` | 生产环境启动必填，作为 Commander 自身面向 Action Gateway 调用的凭据。注意这**不是**外部调用者的接入密钥 |
| `COMMANDER_CAPABILITY_TOKEN_KEY` | 生产环境必填。用于 API 层权能令牌 (Capability Tokens) 的 HMAC 签名密钥 |
| `COMMANDER_INTEGRITY_KEY` | 生产环境必填。用于 PostgreSQL WAL 事件防篡改签名的 HMAC 密钥 |
| `COMMANDER_EVIDENCE_JWKS_JSON` | 在 Compose 部署中强制必填。供 API 服务验证 Worker Ed25519 签名存证证据的公钥 JWKS 字符串 |

在**生产环境 (`NODE_ENV=production`)** 下，若启动密钥缺失或强度不足，服务将**立即拒绝启动并退出进程**。在非生产环境下，除 `JWT_SECRET` 强制必填外，其余缺失项仅输出告警。

防暴力破解模块会在 60 秒滑动窗口内监测到 5 次认证失败后，对该 IP 执行 5 分钟的临时封禁锁闭 (`AUTH_MAX_FAILURES`, `AUTH_LOCKOUT_MS`)。

### 角色权限等级 (Roles)

系统预设 6 个角色，由 `requireRole` 依据数字权重由高到低进行鉴权：

`super_admin` (6) · `admin` (5) · `developer` (4) · `operator` (3) · `auditor` (2) · `viewer` (1)

新注册用户默认角色为 `viewer`；初始引导账号为 `admin`。用户密码采用 bcrypt 哈希加盐存储（cost = 10）。系统中最后一名活跃管理员账号受到保护，不可被删除。

### API Key 作用域 (Scopes)

外部 API Key 在创建时仅允许赋予 `read`、`write` 或 `admin` 粗粒度作用域。虽然底层部分路由细分了更精细的作用域字符串（如 `scim`, `mcp:admin`, `audit:read`, `actions:propose`, `knowledge:write` 等），但这些细粒度作用域目前仅能通过 JWT 声明注入或直连数据库配置，外部密钥生成接口暂未完全开放。`admin` 与 `*` 具有全局绕过特权。因此在设计访问策略时，请将 API Key 视为粗粒度权限凭据。

## 授权体系与多租户机制 (Authorization & Tenancy)

- 认证阶段解析出的租户身份（来自 JWT 声明或 API Key 记录）**始终具备最高法定权威**。
- 若请求头显式传递的 `X-Tenant-ID` 与令牌内绑定的租户不一致，请求将被立即阻断并返回 **403 Forbidden**。
- 若调用凭据未绑定固定租户，仅在非生产的标准开发模式下允许通过 Header 指定租户；在生产环境或企业模式下，裸 Header 无法确立有效租户身份，会被直接拒绝。
- 租户 ID 强制符合正则表达式 `^(?!.*\.\.)[a-zA-Z0-9._:-]{1,128}$`，从物理层面杜绝 `..` 路径穿越攻击；格式不合规的 ID 返回 400。
- **跨租户非法读取资源时，系统返回 404 而非 403**，从而避免攻击者通过报错状态码探测其他租户是否存在特定资源。

**行级安全控制 (Row-Level Security / RLS)**：系统在 PostgreSQL 中针对 17 个核心内核数据表（runs、steps、effects、events、outbox、timers、workers 等）全量开启了 `ENABLE ROW LEVEL SECURITY` **以及** `FORCE ROW LEVEL SECURITY`，并配置了按角色划分的策略。数据库底层严格分离角色身份：`commander_app` (API 业务层), `commander_worker` (任务执行层), `commander_adapter_ops` (补偿维护层), `commander_scheduler` (调度层), `commander_owner` (迁移维护者), 以及具备强行隔离的 `commander_tenant_authority` (`NOLOGIN NOBYPASSRLS`)。

租户上下文在数据库事务级别绑定，关联至数据库内部 OID、后端会话 PID 与事务 ID，拥有 60 秒强制过期时间。若绑定缺失或不一致，数据库会直接抛出异常，绝不静默放宽访问范围。

> 尽管行级安全机制已经实现且通过了自动化测试，但官方核心规范仍诚实声明多租户隔离**尚未达到经过实战检验的生产就绪标准**。若存在严苛的强合规硬隔离需求，请在投入生产前自行严格验证。

## 权能令牌体系 (Capability Tokens)

系统存在**两套完全不同**的权能令牌实现，理解其差异至关重要：

| 作用平面 | 算法机制 | 深度绑定的安全上下文 |
| --- | --- | --- |
| API 层 / 工具调用平面 | HMAC-SHA-256 (`COMMANDER_CAPABILITY_TOKEN_KEY`) | 主体 (subject)、受众 (audience)、工具作用域、参数结构特征、风险等级、TTL（默认上限 300 秒）、委托深度（上限 3 次）、随机数 (nonce) |
| Worker 执行平面与 adapter-ops | **Ed25519 非对称签名** (`COMMANDER_CAPABILITY_PRIVATE_KEY_PEM` + JWKS + key id) | 租户 ID、任务 run ID、步骤 step ID、生效动作类型、**请求哈希 (request hash)**、**动作意图摘要 (action digest)**、**策略快照版本 (policy snapshot)**、负载元数据、Worker 隔离栅世代编号 (fencing token)、随机数 |

只有在 Worker 平面的 Ed25519 签名路径下，系统才会严格将令牌与请求参数哈希、动作意图摘要及策略快照完成不可变绑定。HMAC 路径不具备此强绑定能力。此外，HMAC 令牌的吊销机制仅保存在**单机进程本地内存**中，进程重启即失效；而持久化的防重放与令牌吊销存储仅存在于 Ed25519 链路中。

在生产环境中，严禁复用 HMAC 密钥来替代 Worker 平面的私钥。两者在设计上物理隔离，Ed25519 模块在生产环境下拒绝使用任何占位符密钥启动。

## 存证体系 (Evidence)

所有受治理执行完成的生产动作，均会产出一份具备密码学签名的证据封包（Evidence Bundle）：

<p align="center">
  <img src="/commander-crypto-gate-zh.png" alt="两阶段人机密码学签名与 JWS 存证全生命周期" width="100%" />
</p>

*图：两阶段人机密码学门禁与 JWS 存证全生命周期。实现智能体推理与生产写权限解耦，保证不可抵赖性。*

- **数字签名：** 基于 Ed25519 对规范化后的证据体进行签名，拒绝任何非 Ed25519 签名算法。
- **证据封包结构：** 包含架构版本规范、唯一证据 ID、动作意图摘要、最终执行状态、所属作用域（租户/任务/效果）、权能授权凭据标识、版本硬绑定锚点（策略版本快照、工作图版本、内核 API 版本）、效果明细列表、审计事件链路与整体内容哈希。
- **完整性链条：** 效果列表与审计事件均组织为 SHA-256 **哈希链 (Hash Chain)**（即每一项均包含 `entryHash` → `prevEntryHash`），辅以覆盖全包体的全局 `contentHash`，最后整体加盖 Ed25519 数字签名。
- **Fail-closed 校验策略：** 验证逻辑优先校验两条哈希链的连贯性与全局内容哈希，全部一致后再执行签名验签。若调用方配置了验证公钥，则必须包含有效签名；无签名或验签失败的证据直接返回 `ok: false`。
- **数据脱敏处理：** 智能体内部思考过程 (chain-of-thought)、提示词全文与上下文消息字段全部从存证中剔除；形如私钥 PEM 块、`Bearer`、`sk_`、`ghp_`、`AKIA`、JWT 等敏感凭据自动脱敏替换为 `[REDACTED]`；响应体摘要严格受限于标量安全白名单。
- **持久化体积约束：** 单个证据封包落库最大体积严格限制在 256 KiB 以内。

官方 TypeScript SDK 导出了 `verifyActionEvidence()` 方法，方便运维方在离线状态下对照公开 JWKS 独立审计证据有效性。

## 沙箱隔离机制 (Sandboxing)

**配置预设剖面 (Profiles)：** `read-only`（只读）、`workspace-write`（工作区写入）、`full-access`（完全访问）、`hardened`（强化隔离）。其中 `hardened` 为带有反向代理网络、独立暂存目录、512 MB 内存与 1 核心 CPU 配额，并附带 120 秒硬超时的强隔离环境。在生产环境下，系统**彻底禁止启用 `full-access`**。

**底层实现机制：** 沙箱模块在启动时能主动探测宿主机机制（macOS `seatbelt`、Linux `bwrap`、gVisor、Docker、Windows AppContainer、V8 Isolate、TEE 及 SSH 等）。但在配置 `COMMANDER_SANDBOX_ISOLATION` 时，**仅接受 `process`、`docker` 或 `gvisor`**：

- 生产与预发环境默认采用 `docker`，本地开发与单元测试默认采用 `process`。
- 在生产环境下配置 `process` 将被系统**直接拒决**，因为进程级伪沙箱不符合基准安全合规要求。
- 因此，生产环境合法可用的隔离底层**仅限 Docker 或 gVisor**。Seatbelt 与 bwrap 仅属于探测机制，非生产可选方案。

**Fail-closed 启动探针：** 若宿主机未安装可用的操作系统级沙箱，Commander 将直接抛出 `SandboxInitializationError` 并终止运行。文档中虽然记录有 `COMMANDER_ALLOW_NO_SANDBOX` 逃逸开关，但该开关在**生产环境下被强制禁用**。生产启动时，系统会在选定的沙箱中运行微型探针，探针失败或机制不符合策略则立刻退出；若逃逸检测器本身加载失败，进程将以退出码 126 终止。

## 受治理的外部写操作

Effect Broker 是外部生产写操作的唯一合法通道，强制分为严格的两阶段执行：

1. **`admit()` 准入阶段** — 校验权能令牌有效性、验证受众与动作类型成员资格、校验请求参数哈希与策略快照是否完全匹配、检查租户白名单、评估每日调用配额、校验紧急熔断开关并记录该效果。**在此阶段，不对外部基础设施执行任何写操作。**
2. **`executeAdmitted()` 执行阶段** — 将已准入并签名的合法请求分发至指定执行器执行。

策略引擎返回三种结论：`allow`（允许执行）、`deny`（拒绝）、`require_approval`（需要人工审批）。系统从代码层面严禁设置“无条件放行（permit-all）”哨兵。任何拒绝均会触发一条高等级的 `effect.rejected` 审计日志，并返回标准原因码，如 `POLICY_DENIED`、`ACTION_NOT_ALLOWLISTED`、`QUOTA_EXCEEDED`、`APPROVAL_REQUIRED`、`REQUEST_HASH_MISMATCH`、`POLICY_SNAPSHOT_MISMATCH` 或 `ACTION_DIGEST_REQUIRED`。

**紧急熔断开关 (Kill Switches)** 支持多级精细化作用域：可按 `tenant`（租户）、`package`（模块）、`model`（模型）、`tool`（工具）、`destination`（目标端点）或 `effect-type`（效果动作类型）随时阻断。

**事务补偿是尽力而为的，并非百分之百保证回滚成功。** 补偿本身也是一项受治理的特殊动作，由独立守护进程运行，其终态可能为 `succeeded`（补偿成功）、`handedOff`（转交人工处理）或 `escalated`（告警上报升级）。当重试耗尽或超过最后期限时将触发升级。系统配备了专门的 `ReversibilityGate`（可逆性门禁），在未获得人工显式审批前，硬编码阻止不可逆工具（如 `git_push`、`shell_execute`、`python_execute`、`web_fetch`、`mcp__*` 等）的自动补偿。请勿假定系统能实现无条件完美物理回滚。

## 敏感凭据防护

- `EncryptedSecretsVault` 使用 **AES-256-GCM** 算法加密存储敏感静态凭据，利用 **HKDF-SHA-256** 按凭据和版本派生专属密钥，辅以高熵随机 IV 和 Salt。支持多达 10 个版本的滚动轮转与加密导出。
- 加密库由根主密钥 `COMMANDER_MASTER_KEY` 保护。生产环境下若未配置该密钥，服务拒绝启动；非生产环境下会临时生成内存瞬态密钥并输出警告。
- 供应商 API 密钥的解析顺序为：优先读取加密密钥库，未命中再回退查找环境变量。

**系统不存在全局日志拦截脱敏器。** 数据脱敏针对具体敏感场景分别部署：
- 审计请求体（敏感字段名自动替换为 `[REDACTED]`，报文体积截断至 8,000 字符以内）；
- 存证证据封包（匹配密钥格式与特定字段名进行脱敏）；
- DLP 数据防泄露模块在 5 个外部暴露点提供 `scan()` / `sanitize()` 扫描（API 响应、日志输出、工具返回、智能体输出、SSE 事件流）。

请将“日志中杜绝凭据泄露”视为研发与运维人员必须严格遵循的管理规范，而非平台层面已无条件解决的技术绝对保证。

## 提示词注入、毒化攻击与内容扫描

Commander 内置了完备的防御组件：

| 关注安全风险 | 防御组件与控制措施 |
| --- | --- |
| 提示词注入与隐藏载荷 | `contentScanner`（针对隐藏 HTML/CSS、Metadata、Unicode 字符注入、Data URL 与 SVG 深度扫描） |
| 语义级对抗注入 | `mlInjectionDetector`（基于嵌入向量特征的语义检测） |
| 上下文记忆毒化 | `memoryPoisoningDefenseEngine` 与 `memoryPoisoningGate` — 写入记忆前的防线，拦截对抗注入、逻辑矛盾、死循环重复与低置信度内容 |
| 多层写入防护 | `semanticFirewall` — 提供清洗 (sanitize)、溯源 (provenance)、校验 (validate)、隔离 (quarantine) 与审计全套机制 |
| 任务目标劫持 (Goal Hijack) | `goalHijackDetector`（对应 OWASP ASI01 威胁） |
| 工具与 MCP 毒化 | `toolPoisoningGuard`, `mcpToolPoisoningGuard` |
| 运行时行为监测 | `guardianAgent` 守护智能体 — 实时监控语义漂移、异常行为、合规冲突、成本突增、目标偏离、危险工具调用与数据外泄尝试 |
| 出站网络管控 | `OutboundNetworkPolicy` — 域名黑白名单、私有内网 IP (SSRF) 拦截、DNS 重绑定加固与数据分类端点绑定 |
| 协同深度防御网关 | `enterpriseSecurityGateway` — 涵盖从零信任签名验证到输出扫描的 7 层立体防护 |

系统内嵌了 **OWASP Agentic AI Top 10** 威胁映射矩阵（ASI01–ASI10）与 **MITRE ATLAS** 攻防对抗框架映射（14 个战术类别、60+ 项具体技术），为 Web 控制台的合规看板提供数据支撑。请注意：此类可视化报表属于**辅助治理与态势感知工具，并非合规审计认证结果**。

## 网络通信安全

- **CORS 跨域资源共享**：严格基于白名单机制，从不开放通配符 `*`。仅当请求来源完全命中白名单时才附带凭据传输。若未配置 `CORS_ORIGINS`，系统默认回退至仅允许 localhost 访问并抛出告警。
- **反向代理信任 (`TRUST_PROXY_HOPS`)**：默认值为 0（不信任任何外部代理），此时直接忽略客户端伪造的 `X-Forwarded-For`。非法值会导致服务拒绝启动。位于负载均衡器后方时请根据拓扑层级正确配置，否则限流与 IP 封禁模块将直接按负载均衡器的内部 IP 进行判定。
- **MCP stdio 命令白名单：** API 端的 `/mcp` 服务发现路径仅允许 `node`、`python` 与 `python3` 命令。内核 MCP 客户端支持 `node`、`nodejs`、`python`、`python3`、`bun`、`deno`；**`npx` 在任何情况下被强制禁止执行**；使用 `uvx` 需显式声明 `COMMANDER_MCP_ALLOW_UVX=1`。用于内联动态求值与模块加载的危险参数（如 `-e`、`-c`、`--eval`、`--require`、`--loader`、`--inspect`）会被直接拒绝。可通过 `COMMANDER_MCP_ALLOWED_COMMANDS` 安全扩展白名单。
- **安全响应头**：默认禁用 `X-Powered-By`，生产环境开启 HSTS，全面注入 CSP、`Referrer-Policy` 与 `Permissions-Policy`。

## 审计日志机制 (Audit Logging)

- `SecurityEventType` 监控事件覆盖：沙箱违规、认证成功与失败、触发限流、人工审批判定、内容威胁阻断、执行策略违规、凭据提取尝试、路径穿越与命令注入攻击、记忆毒化、配置变更、密钥轮转等。
- 安全事件以**追加写入式 (append-only) NDJSON** 格式保存于 `.commander_security/` 目录中，附带包含 10,000 条最近记录的内存环形缓冲区。
- 所有产生状态变更的 API 请求（`POST`/`PUT`/`PATCH`/`DELETE`）均被记录为 `user_action` 类型事件，并对请求体执行脱敏。
- **防篡改存证链条为可选启用项。** 仅当配置了 `COMMANDER_AUDIT_CHAIN_KEY` 时，日志项之间才会通过 `HMAC-SHA-256` 构成链式哈希校验，从而能够检测出任何事后修改、删除、插入或乱序篡改。此外，可通过 `COMMANDER_AUDIT_MANIFEST_DIR` 开启基于非对称公私钥（RSA-PSS）的 L2 清单存证。**若未进行上述配置，审计日志仅保持普通的追加存储格式，不具备密码学防篡改保障。**
- 针对 PostgreSQL WAL 事件的防篡改签名由独立的 `COMMANDER_INTEGRITY_KEY` 保障，请勿将这两个不同层级的密钥混淆。

## 访问速率限制 (Rate Limiting)

采用固定的 60 秒时间窗口，`API_RATE_LIMIT` 默认限制为每分钟 120 次请求，支持基于租户与用户维度的配额重载。不同接口具有权重倍率：健康检查探针 ×10，只读查询接口 ×1，有状态写入接口 ×0.25。限流计数器保存在 PostgreSQL 数据库中并通过原子操作更新，杜绝多副本部署下的竞态条件；若计数存储不可用，服务遵循 Fail-closed 原则返回 **503**。响应头中透明携带 `X-RateLimit-Limit`、`-Tier`、`-Remaining` 与 `-Reset`。

CLI 命令行工具在跨进程层面限制高消耗调用（每分钟最多发起 10 次大模型耗费型命令）。

## 生产模式防御防线 (Production Guards)

在生产环境 (`NODE_ENV=production`) 下，以下危险配置将导致服务直接拒绝启动或 Fail-closed 异常退出：

| 防御守卫项 | 触发表现与处理规则 |
| --- | --- |
| `AUTH_DISABLED=true` | 所有请求一律返回 **500 Internal Server Error**，生产环境坚决禁止关闭鉴权 |
| `COMMANDER_ALLOW_NO_SANDBOX` | 强制禁用；沙箱初始化失败直接抛出异常终止进程 |
| `COMMANDER_ALLOW_UNCHECKED_EXEC` | 强制禁用；若逃逸检测失效直接安全退出 |
| 缺少持久化存储 | 必须正确配置 `API_STORE_BACKEND` 或 `DATABASE_URL`，拒绝使用纯内存；除显式开启 `COMMANDER_ALLOW_MEMORY_STORE=1` 调试模式外禁止裸启 |
| 密钥缺失或强度过低 | 立即以退出码 `process.exit(1)` 中止 |
| PostgreSQL 传输未加密 | 强制要求 `sslmode=verify-full`、提供有效 CA 证书文件，并提供 64 位十六进制的 SPKI SHA-256 服务端公钥指纹固定 |
| 权能签名密钥不合规 | 拒绝使用临时生成的或占位符类型的 Ed25519 密钥对启动 |
| 沙箱隔离级别不合规 | 拒绝将隔离级别降级为 `process`；配置未知沙箱类型直接报错 |

## 限制与诚实免责声明

本章节旨在客观划清技术边界，避免过度承诺产品能力：

1. **处于 Alpha 阶段：** 官方代码库已明确指出 Commander 尚未达到工业级全面就绪标准，多租户隔离特性**尚未经过生产级严苛考验**。请勿将本文档视作具有法律约束力的安全认证报告。
2. **API Key 采用未加盐 SHA-256 存储**，而非高强度防碰撞的内存敏感 KDF 算法（如 Argon2 或 bcrypt）。该实现适用于高熵随机生成的复杂 Key，但防破解强度低于用户密码采用的 bcrypt。
3. **Commander 原生 JWT 采用 HS256 对称加密**。当前对 Access 与 Refresh Token 不支持非对称签名；非对称验签机制仅用于外部 OIDC ID Token。
4. **HMAC 权能令牌的吊销列表保存在单机内存中**，无法在服务重启后持久保持。
5. **外部写操作的事务补偿是尽力而为的 (Best-effort)**，不保证所有外部变更都能成功回滚；遇到物理不可逆情况将转为人工介入。
6. **不存在全局统一日志拦截脱敏器**，脱敏只发生在特定的审计日志与网络边界处。
7. **审计日志的密码学防篡改特性为可选开关**，需显式配置 `COMMANDER_AUDIT_CHAIN_KEY` 激活。
8. **API Key 的权限作用域模型较粗**，通过生成接口仅能开辟 `read`、`write`、`admin` 三种权限，无法直接创建更细粒度权限的密钥。
9. **SCIM 目录同步目前基于本地文件系统存储**（位于 `data/scim/<tenantId>`），未接入 PostgreSQL。
10. **`/metrics` 监控指标端点默认需要鉴权**，受 API 默认拒绝安全中间件保护，并非公开可访问。

## 敏感凭据与数据保护指引

- 切勿将大模型 API Key 或 `COMMANDER_API_KEY` 硬编码在代码仓库中，始终优先使用内置的加密密钥库进行管理。
- 严格限制智能体能够接触生产系统的工具集合，优先采用 `read-only` 或 `workspace-write` 等受限沙箱配置。
- 启动正式试点前，务必审阅涉及客户敏感数据的日志归档策略、留存周期与异地备份机制。
- 预先建立清晰的数据删除与事故应急响应预案。可通过 `POST /v1/privacy/erasure` 提交符合合规要求的数据擦除工单。

## 漏洞披露政策

如发现任何安全漏洞，请通过官方 `SECURITY.md` 约定的私密安全渠道进行通报，切勿通过公开 GitHub Issue 进行披露。

## 合规标准参考

本项目中引用的 ISO 42001 与 NIST AI RMF 技术映射属于**合规指引与辅助报告工具，绝不构成已通过第三方审计的合规资质背书**。Commander 暂未通过 SOC 2 正式审计认证；内嵌的 OWASP 与 MITRE ATLAS 映射仅作为纵深防御的数据遥测支撑，非第三方认可的控制措施集合。