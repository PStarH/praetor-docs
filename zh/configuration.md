# 配置指南 (Configuration)

部署与运行 Commander 时，推荐首先复制环境模板文件并根据实际需要进行配置：
```bash
cp .env.example .env
```

在本页面中，若某个变量注明具有**代码默认值 (Code default)**，表示当该环境变量未显式声明时，应用程序代码内部会回退使用该预设值；若注明具有**部署默认值 (Deployment default)**，表示该值仅由官方提供的 Docker Compose 或 Helm 模板声明，应用程序代码自身并未硬编码默认值。

## 核心启动凭据 (Required Startup Credentials)

| 环境变量 | 用途与约束说明 |
| --- | --- |
| `COMMANDER_API_KEY` | 生产环境必需启动凭据，同时作为 Commander 访问外部 Action Gateway 的内部凭据。请注意该凭据**不是**客户端调用 API 的入向鉴权 Key |
| `COMMANDER_MASTER_KEY` | 加密密钥库 (Secrets Vault) 的主加密密钥。长度不得少于 32 位字符 |
| `JWT_SECRET` | 用于 Access Token 与 Refresh Token 的 HS256 数字签名密钥。长度不得少于 32 位字符；系统严禁使用任何公开的弱默认值。**在所有环境中均为强制必需项** |
| `COMMANDER_CAPABILITY_TOKEN_KEY` | 用于 API 层权能令牌 (Capability Tokens) 的 HMAC 签名密钥 |
| `COMMANDER_INTEGRITY_KEY` | 用于 WAL 预写日志事件防篡改签名的 HMAC 密钥。独立于 `COMMANDER_AUDIT_CHAIN_KEY` |
| `COMMANDER_EVIDENCE_JWKS_JSON` | 供 API 服务验证 Ed25519 签名存证证据包的公钥 JWKS 字符串。在标准 Compose 模板中强制校验声明 (`${COMMANDER_EVIDENCE_JWKS_JSON:?}`) |
| `ADMIN_PASSWORD` | 系统初始管理员密码。长度不得少于 16 位字符；系统启动时会主动校验并拒绝默认弱口令 |

**不同环境下的校验强度策略：**
在生产环境（`NODE_ENV=production` 或 `COMMANDER_ENV=production`）下，上述凭据若缺失或强度不足，服务将立即触发 `process.exit(1)` 中止启动以确保安全。在非生产开发环境中，缺失凭据将打印安全告警但允许继续启动（`JWT_SECRET` 除外，其在任何模式下均严格强制要求）。`ADMIN_PASSWORD` 在生产环境或配置了多副本（`COMMANDER_API_REPLICAS > 1`）时为强制项。`DATABASE_URL`（以 `commander_app` 角色连接）在所有环境中均被 API 认证子系统严格依赖。

你可以使用 OpenSSL 快速生成各高强度密钥：
```bash
openssl rand -hex 32
```

## 系统画像与环境标识 (Profile & Environment)

下列变量决定了系统采用的安全策略与校验门槛，请根据部署目标明确声明：

| 环境变量 | 默认值 | 语义与作用说明 |
| --- | --- | --- |
| `COMMANDER_PROFILE` | 自动推导 | 可选 `enterprise`（企业版）或 `standard`（标准版）。显式配置**始终具有最高优先级**，覆盖自动推导逻辑 |
| `COMMANDER_ENV` | — | 设置为 `production` 或 `prod` 标记当前为正式生产环境 |
| `NODE_ENV` | — | 设置为 `production` 标记当前为正式生产环境 |

当 `COMMANDER_PROFILE` 未显式设置时的推导规则：若检测到生产环境标志（`NODE_ENV=production` 或 `COMMANDER_ENV=production|prod`），则自动推导为 `enterprise`；否则回退为 `standard`。

企业版画像（`enterprise`）会激活更加严格的安全防护：`/api/openapi.json` 直接返回 `410`，历史遗留执行接口被彻底阻断，且请求头租户标识无法单方面拓宽访问权限。

## API 服务基础配置 (Server)

| 环境变量 | 代码默认值 | 用途与说明 |
| --- | --- | --- |
| `PORT` | `4000` | API 服务监听端口 |
| `API_HOST` | `127.0.0.1` | 服务绑定的网络接口。Docker 与 Helm 模板会自动配置为 `0.0.0.0` |
| `WEB_PORT` | `5173` | 仅用于本地跨域 CORS 白名单与 OIDC 重定向来源计算——**绝非** API 监听端口 |
| `WEB_ORIGIN` | `http://localhost:$WEB_PORT` | 覆盖并自定义 OIDC 重定向来源 URL |
| `CORS_ORIGINS` | 仅限本地回环 | 逗号分隔的跨域来源白名单。生产环境中严禁配置为通配符 `*`。未设置时输出警告 |
| `TRUST_PROXY_HOPS` | 不信任任何代理 (`0`) | 信任的反向代理跳数。配置格式错误将终止启动。若部署在负载均衡后方请务必准确配置，否则限流与防爆破会将代理 IP 误判为主机 |
| `COMMANDER_LOG_PERSIST` | `false` | 是否将结构化日志落盘持久化至本地 SQLite 数据库中 |
| `COMMANDER_AUTH_PROTECT_HEALTH` | `false` | 是否对基础系统端点（`/health`、`/health/detailed`、`/ready`、`/metrics`）施加认证保护 |
| `COMMANDER_API_REPLICAS` | — | API 副本数。声明超过 1 时强制要求显式提供 `ADMIN_PASSWORD` |

**日志级别与格式化输出：**
日志系统内置默认级别为 `info`，格式化输出默认采用便于阅读的高亮格式 **`pretty`**。日志格式通过环境变量 `LOGFORMAT`（注意无下划线）进行读取；系统不会解析 `LOG_FORMAT`。在当前代码版本中，`LOG_LEVEL` 并未直接与系统环境变量挂钩——部署模板中虽然传递了 `COMMANDER_LOG_LEVEL`，但目前日志框架尚未消费该字段。若需在当前版本精确调整日志级别，推荐通过程序化方式配置。

日志持久化具备背压自适应降级机制：当内部缓冲队列超过 10,000 条积压时，系统将主动丢弃 `debug` 与 `info` 级别日志，仅保留 `warn`、`error` 与 `critical`；当积压达到两倍阈值时，最早的历史日志将被强制丢弃。

## 流量控制与防爆破 (Rate Limiting)

限流时间窗口固定为 60 秒滑动窗口。

| 环境变量 | 默认值 | 用途与说明 |
| --- | --- | --- |
| `API_RATE_LIMIT` | `120` | 单个时间窗口内的全局基准最大请求数 |
| `API_RATE_LIMIT_USER` | `API_RATE_LIMIT` | 针对单一已认证用户的每分钟请求数限制 |
| `API_RATE_LIMIT_TENANT` | `API_RATE_LIMIT` | 针对单一租户维度的每分钟请求数限制 |
| `AUTH_MAX_FAILURES` | `5` | 触发 IP 锁定前允许的最大连续认证失败次数 |
| `AUTH_LOCKOUT_MS` | `300000` | 暴力破解触发后的锁定冻结时长（默认 5 分钟） |

系统针对不同接口重要程度应用了内置乘数：健康检查探针 ×10，普通读请求 ×1，写变更操作 ×0.25。
此外，CLI 命令行工具在多进程间独立设置了全局防浪涌限制：每分钟最多执行 10 次高成本的大模型调用。

## 大模型提供商凭据 (Providers)

系统启动时至少需要配置一项有效的模型提供商凭据。Commander 具备智能检测机制，能够根据环境中的 Key 自动装载对应通道。完整支持的 25 家提供商详见 [模型提供商全景手册](/zh/providers)（注意部分提供商环境变量名称较为特殊，例如 Cohere 为 `CO_API_KEY`、智谱 GLM 为 `ZHIPU_API_KEY`、Replicate 为 `REPLICATE_API_TOKEN`）。

| 环境变量 | 用途与说明 |
| --- | --- |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, … | 各大模型官方 API Key 认证凭据 |
| `OPENAI_BASE_URL`, `OPENAI_MODEL` | 自定义 OpenAI 兼容代理网关端点与默认模型名称 |
| `AZURE_OPENAI_BASE_URL`, `AZURE_OPENAI_MODEL`, `AZURE_OPENAI_API_VERSION` | 微软 Azure OpenAI 企业部署专有参数 |
| `OLLAMA_HOST`, `VLLM_BASE_URL` | 本地私有化推理引擎服务地址（Ollama / vLLM） |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | AWS Bedrock 云原生托管模型调用凭据 |
| `COMMANDER_MIN_SENSITIVE_MODEL_TIER` | 敏感核心步骤所允许调用的最低模型能力等级：`eco` \| `standard` \| `power` \| `consensus`（默认 `standard`） |

在代码层面扩展新提供商极为简单：只需在 `packages/core/src/runtime/providers/providerRegistry.ts` 中追加一行 `registerProvider()` 调用，注册表将自动推导其环境变量映射、默认 URL、模型别名及展示名称。

## 持久化与存储后端 (Storage)

| 环境变量 | 默认值 | 语义与说明 |
| --- | --- | --- |
| `API_STORE_BACKEND` | `sqlite` | 可选存储后端：`sqlite` \| `memory` \| `postgres` |
| `DATABASE_URL` | — | PostgreSQL 数据库连接串；在 `API_STORE_BACKEND` 未声明时自动推导为 `postgres` |
| `COMMANDER_KERNEL_ENABLED` | **自动推导** | 是否启用以 PostgreSQL 为底座的分布式执行内核 |
| `COMMANDER_KERNEL_DATABASE_URL` | `DATABASE_URL` | 专供分布式内核使用的高隔离数据库连接串 |
| `COMMANDER_EVENT_SOURCING_WAL` | `.commander_state/event-sourcing.wal` | 确定性事件溯源与崩溃恢复的预写日志 (WAL) 落盘路径 |
| `COMMANDER_ALLOW_MEMORY_STORE` | — | 生产环境下使用纯内存存储的显式声明开关 |

> [!NOTE]
> `COMMANDER_KERNEL_ENABLED` **并非**默认关闭。在 `NODE_ENV=production`、`COMMANDER_V2_MODE=1` 或检测到有效内核数据库连接串时，系统会自动将其激活。你显式设置 `0` 或 `1` 会具有最高优先级——但请注意，在生产环境中显式声明 `0` 将被安全拦截拒绝。

在生产环境中，若既未配置 `API_STORE_BACKEND` 也未配置 `DATABASE_URL`，API 将遵循安全闭环原则直接抛出 `StoreBackendConfigError` 并拒绝启动。本地运行时状态保存在 `.commander_state/` 目录下；该目录下的 WAL 日志构成了单节点崩溃自愈的真实可信数据源 (Source of Truth)。

## 多租户隔离 (Multi-Tenancy)

| 环境变量 | 默认值 | 用途与说明 |
| --- | --- | --- |
| `TENANT_CONFIG_PATH` | — | 多租户静态定义配置文件的系统绝对路径 |
| `COMMANDER_DEFAULT_TENANT_ID` | `local` | 未携带租户声明时的默认回退租户标识 |

系统多租户隔离模式的激活完全取决于**是否存在 `TENANT_CONFIG_PATH`**：若该变量未配置或目标文件不存在，系统采用单租户 Null 提供商；若成功读取配置文件，则装载静态多租户隔离模型。

## 事件总线与分布式链路追踪 (Event Bus & Observability)

| 环境变量 | 默认值 | 用途与说明 |
| --- | --- | --- |
| `COMMANDER_EVENT_BUS_BACKEND` | `memory` | 事件总线驱动：可选 `memory`（单机内存）或 `redis`（分布式集群） |
| `COMMANDER_EVENT_BUS_REDIS_URL` | 无 | Redis 连接字符串。请注意 `redis://redis:6379` 仅为 **Compose 部署模板默认值**，非代码默认值 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | OpenTelemetry (OTLP) 收集器上报地址（例如 `http://jaeger:4318`） |
| `COMMANDER_OTEL_ENABLED` | `true` | 设置为 `false` 可彻底关闭 OTLP 分布式追踪上报 |
| `COMMANDER_AUDIT_CHAIN_KEY` | — | 启用安全审计日志 HMAC 哈希链级联防篡改校验（需显式开启） |
| `COMMANDER_AUDIT_MANIFEST_DIR` | — | 启用基于 RSA-PSS 的第二级审计清单目录签名存档（需显式开启） |
| `GRAFANA_ADMIN_PASSWORD` | `admin` | 仅在部署容器中生效。将监控大屏暴露到外部网络前请务必修改该初始密码 |

## 分布式 Worker 执行面 (Worker Plane)

| 环境变量 | 用途与约束说明 |
| --- | --- |
| `COMMANDER_WORKER_BOOTSTRAP` | 导出 `createWorkerService()` 工厂函数的模块加载路径。**必需提供**，不存在任何宽容的开发回退逻辑 |
| `COMMANDER_WORKER_AUTH_TOKEN` | Worker 节点向控制面注册时的强认证凭据。**由引导程序强制校验要求** |
| `COMMANDER_WORKER_AUTH_SUBJECT` | 声明 Worker 身份的主体标识，默认格式为 `worker:<workerId>` |
| `COMMANDER_WORKER_CAPABILITIES` | Worker 注册权能列表。代码默认 `agent`；在官方 Compose 与 Helm 中默认配置为 `agent,tool,connector` |
| `COMMANDER_WORKER_TENANTS` | 显式租户访问白名单。启动时通配符 `*` 或空列表均会被严格校验拒绝 |
| `COMMANDER_WORKER_MAX_CONCURRENCY` | 单个 Worker 节点允许并行承载的最大步骤执行并发数（默认 `10`） |
| `COMMANDER_WORKER_LEASE_TTL_MS` | 步骤租约 (Step Lease) 的生存超时时间（默认 `30000` 毫秒） |
| `COMMANDER_WORKER_HEARTBEAT_MS` | Worker 节点向内核保活的心跳上报间隔（默认 `10000` 毫秒） |
| `COMMANDER_WORKER_POLL_MS` | 待认领任务的轮询间隔（默认 `250` 毫秒） |
| `COMMANDER_WORKER_ID` | Worker 节点的唯一命名标识，缺省自动生成 `worker-<8位16进制>` |
| `COMMANDER_WORKER_KIND` | Worker 的角色类型，默认取值为 `agent` |
| `COMMANDER_OPS_HEALTH_PORT` | `kernel-ops` 后台守护组件的健康监控端口（默认 `8081`） |
| `COMMANDER_ADAPTER_OPS_HEALTH_PORT` | `adapter-ops` 补偿守护组件的健康监控端口（默认 `8082`） |
| `COMMANDER_WORKER_HEALTH_PORT` | `worker` 节点的健康检查监听端口。**无代码默认值——未声明时彻底关闭健康服务**。官方 Compose 与 Helm 默认设置为 `8083` |
| `COMMANDER_EFFECT_BROKER_SEED` | 副作用仲裁代理 (Effect Broker) 的种子熵源材料 |

Worker 节点与 Adapter-ops 之间的权限校验统一采用 Ed25519 密码学密钥对与 JWKS 架构（通过 `COMMANDER_CAPABILITY_PRIVATE_KEY_PEM`、`COMMANDER_CAPABILITY_KEY_ID`、`COMMANDER_CAPABILITY_JWKS_JSON`、`COMMANDER_EVIDENCE_SIGNING_PRIVATE_KEY_PEM`、`COMMANDER_EVIDENCE_SIGNING_KEY_ID` 传入），绝不采用 API 层的简易 HMAC 密钥。详细规范请参阅 [安全体系与权能令牌](/zh/security#权能令牌体系-capability-tokens)。

## 沙箱防护与执行安全 (Sandbox & Safety)

| 环境变量 | 默认值 | 语义与说明 |
| --- | --- | --- |
| `COMMANDER_ALLOW_NO_SANDBOX` | `false` | 当宿主机缺失系统级沙箱时，是否允许放行。生产环境严禁配置为 true |
| `COMMANDER_SANDBOX_ISOLATION` | 生产/预发为 `docker`，其余为 `process` | 沙箱隔离机制：严格限定为 `process`、`docker` 或 `gvisor`。生产环境严禁使用 `process` |
| `COMMANDER_SANDBOX_MODE` | — | 选取沙箱配置画像。无论何种配置，绝不允许通过该变量选取 `full-access` |
| `COMMANDER_MCP_ALLOWED_COMMANDS` | 详见下方 | 允许 MCP Stdio 服务调用的额外可执行基础命令白名单 |
| `COMMANDER_MCP_ALLOW_UVX` | 未设置 | 是否显式允许调用 Python `uvx` 工具（默认处于禁止状态） |

核心 MCP 客户端默认允许调用 `node`、`nodejs`、`python`、`python3`、`bun` 与 `deno`。**`npx` 在任何情况下均被彻底禁止**；调用 `uvx` 必须显式声明 `COMMANDER_MCP_ALLOW_UVX=1`。注意：API 网关的 `/mcp` 发现端点拥有独立硬编码白名单（`node`、`python`、`python3`），不会继承读取 `COMMANDER_MCP_ALLOWED_COMMANDS`。

## 执行模式与历史遗留控制 (Execution Mode)

| 环境变量 | 默认值 | 语义与用途说明 |
| --- | --- | --- |
| `COMMANDER_LEGACY_EXECUTION` | 未设置 | 声明为 `1` 以尝试开启历史旧版 `/api/runs` 与 `/api/orchestrator` 执行接口 |
| `COMMANDER_V2_MODE` | 未设置 | 强制开启 V2 分布式内核，并从物理层阻断历史遗留执行接口 |
| `COMMANDER_V2_BENCH_HARNESS` | 未设置 | 挂载 `/v2` 基准压测路由。严禁在生产环境中启用 |
| `COMMANDER_ALLOW_ANON` | 未设置 | 是否允许免密匿名调用 API 服务。默认全量拒绝 |
| `AUTH_DISABLED` | 未设置 | 在生产环境下声明该变量将直接触发 **500** 致命错误；在非生产环境下仍必须搭配 `COMMANDER_ALLOW_ANON=1` 生效 |

## 企业网关与外部集成 (Action Gateway & Protocols)

| 环境变量 | 用途与说明 |
| --- | --- |
| `COMMANDER_ACTION_GATEWAY_URL` | Action Gateway 服务的根基准 URL。在生产环境、企业 MCP 模式以及调用 `commander action` 时为必需项 |
| `COMMANDER_A2A_AUTH_TOKEN` | 智能体互联协议 (A2A) Bearer 令牌，字符长度不得少于 16 位。未配置时调用 A2A 接口直接返回 500 |

## 企业 OIDC 单点登录 (OIDC Single Sign-On)

| 环境变量 | 默认值 | 语义与用途说明 |
| --- | --- | --- |
| `OIDC_ENABLED` | 持久化配置 | 全局启用或关闭 OIDC 单点登录认证 |
| `OIDC_ISSUER` | — | 身份提供商 Issuer URL，必须基于标准 HTTPS 协议 |
| `OIDC_CLIENT_ID` | — | 注册在 IdP 的客户端 Client ID |
| `OIDC_ROLE_CLAIM` | `roles` | 携带角色定义的 ID Token Claim 声明字段名称 |
| `OIDC_ADMIN_ROLES` | `['admin']` | 映射为系统管理员角色的 IdP 角色组名称 |
| `OIDC_OPERATOR_ROLES` | `['operator','developer']` | 映射为系统操作员角色的 IdP 角色组名称 |
| `OIDC_TENANT_CLAIM` | `tenant_id` | 携带租户标识的 Claim 声明字段名称 |
| `OIDC_DEFAULT_TENANT_ID` | — | 当 Claim 未声明租户时的兜底回退租户标识 |
| `OIDC_ISSUER_HOST_ALLOWLIST` | — | 允许的 Issuer 域名白名单约束 |

OIDC 的运行配置会自动持久化保存在 `.commander/oidc-config.json` 文件中。当系统通过邮箱将 OIDC 身份与本地用户进行关联映射时，强制要求 IdP 提供的 `email_verified` 字段必须为 `true`。

## 数据库传输加密 TLS (Database TLS)

| 环境变量 | 用途与说明 |
| --- | --- |
| `COMMANDER_DATABASE_TLS_CA_FILE` | 自定义受信任的根证书 CA 路径 |
| `COMMANDER_DATABASE_TLS_EXPECTED_SERVER_SPKI_SHA256` | 严格固化的数据库服务端公钥 SPKI SHA-256 证书指纹（64位十六进制哈希） |

在启用了端到端加密验证的场景下，PostgreSQL 数据库连接串必须携带严格的 `sslmode=verify-full` 参数。配置任何其他 `ssl*` 参数都会被直接拦截，连接池强制激活 `rejectUnauthorized`，并严格同时校验 CA 证书链与 SPKI 公钥指纹双重防御。