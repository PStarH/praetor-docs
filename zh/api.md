# HTTP API 接口规范

Commander API 服务基于 Express 5 构建。服务默认在 `PORT`（缺省 `4000`）端口监听，并绑定到 `API_HOST` 地址（本地缺省 `127.0.0.1`；Docker 与 Helm 部署中会自动设置为 `0.0.0.0`）。

环境变量 `WEB_PORT`（缺省 `5173`）仅用于 CORS 跨域白名单以及 OIDC 重定向来源判定——**并非** API 服务的监听端口。

## 基础服务与探针端点 (Service Endpoints)

| HTTP 方法 | 请求路径 | 用途与说明 |
| --- | --- | --- |
| `GET` | `/health` | 存活探针 (Liveness)：汇报服务状态、运行时间、内存开销与版本信息。返回 `200` 或 `503` |
| `GET` | `/ready` | 就绪探针 (Readiness)：真实检测数据库、执行内核与存储后端。返回 `200` 或 `503` |
| `GET` | `/v1/health` | 网关收敛就绪探针（重点校验 `kernel` 与 `evidenceRepository`） |
| `GET` | `/health/detailed` | 输出系统各底层组件与子模块的深度诊断明细 |
| `GET` | `/metrics` | 导出 Prometheus / OpenMetrics 文本格式性能监控指标 |
| `GET` | `/system/status` | 系统运行时长、堆内存分布与已加载模块映射图 |
| `GET` | `/v1/openapi.json` | 官方标准 OpenAPI 3.1 规范契约（权威入口） |
| `GET` | `/api/openapi.json` | 标准画像别名；已废弃，在企业企业版画像下返回 `410` |

> [!NOTE]
> API 服务原生探针端点为 `/health` 与 `/ready`，不存在 Kubernetes 默认风格的独立别名路由。

## 认证与鉴权机制 (Authentication)

| 认证方式 | 调用凭据与实现细节 |
| --- | --- |
| API Key | 通过 `X-API-Key: <key>` 或 `Authorization: Bearer <key>` 传入。Key 均以 `cmdr_` 为前缀，在 PostgreSQL 中经 SHA-256 加盐散列存储 |
| JWT | 通过 `Authorization: Bearer <jwt>` 传入。使用 `JWT_SECRET` 进行 HS256 签名；Access Token 有效期 24 小时，Refresh Token 有效期 7 天 |
| OIDC | 通过 `OIDC_*` 环境变量配置企业单点登录；配置持久化沉淀于 `.commander/oidc-config.json` |
| SCIM | 用户身份同步接口，要求 JWT 具备 `admin`/`super_admin` 角色，或 API Key 拥有 `scim`/`admin`/`*` 授权范围 |
| A2A | 智能体互联协议 (Agent-to-Agent)，通过 `COMMANDER_A2A_AUTH_TOKEN` 传递 Bearer 凭据，长度不得低于 16 位字符 |

环境变量 `COMMANDER_API_KEY` 是生产环境的**必需启动凭据**，同时也是 Commander 自身向上游 Action Gateway 证明自身身份的内部鉴权凭据——它**不是**入向请求的 API Key 存储源。

请求头 `X-Tenant-ID` 仅用于多租户匹配校验，绝非权威认证源：其取值只能与经认证令牌中绑定的 Tenant ID 一致，绝不允许凭空放宽或越权切换租户。

系统公开（无需认证）的白名单路径仅包括：`/health`、`/health/detailed`、`/ready`、`/system/status`、`/api/openapi.json`、`/a2a/.well-known/agent-card`、`/mcp/.well-known/mcp` 以及 `/api/auth/{login,register,refresh,logout}` 系列接口。除上述白名单外，其余所有端点一律遵循**默认拒绝 (Default-Deny)** 策略：允许匿名访问必须显式声明环境变量 `COMMANDER_ALLOW_ANON=1`。

> [!IMPORTANT]
> 请注意：**`/metrics`、`/v1/health` 与 `/v1/openapi.json` 并不在上述公开白名单中**。尽管它们在 JWT 与租户层被豁免，但 API 的全局默认拒绝鉴权中间件依然要求携带凭据。如果你需要抓取 Prometheus 指标或探测网关就绪状态，请务必在请求中携带认证凭据，或在本地开发中显式配置 `COMMANDER_ALLOW_ANON=1`。

## 企业网关 `/v1` (Alpha)

| HTTP 方法 | 请求路径 | 用途与说明 |
| --- | --- | --- |
| `POST` | `/v1/runs` | 提交并启动一次新的执行任务 (Run) |
| `GET` | `/v1/runs/:runId` | 查询指定 Run 的执行详情 |
| `GET` | `/v1/runs/:runId/events` | 订阅指定 Run 的实时 SSE 事件流 |
| `GET` | `/v1/runs/:runId/status` | 查询指定 Run 的当前生命周期状态 |
| `POST` | `/v1/runs/:runId/pause` \| `/resume` \| `/cancel` | 暂停、恢复或取消指定 Run 的执行 |
| `POST` | `/v1/privacy/erasure` | 提交数据合规擦除与遗忘请求 |

### 受治理的写操作 (Governed Actions)

| HTTP 方法 | 请求路径 | 用途与说明 |
| --- | --- | --- |
| `GET` | `/v1/actions/kill-switches` | 列出当前生效的所有止血熔断开关 (Kill Switches) |
| `PUT` / `DELETE` | `/v1/actions/kill-switches/:scope/:value` | 设置或清除指定作用域的熔断开关 |
| `POST` | `/v1/actions/simulate` | 仅执行预检模拟而不产生外部副作用 |
| `POST` | `/v1/actions` | 提议一项受治理的外部写操作（进入审批流程） |
| `GET` | `/v1/actions/:runId` | 查询指定 Run 当前的写操作流转状态 |
| `GET` | `/v1/actions/:runId/evidence` | 获取经 Ed25519 签名的完整存证证据封包 (Evidence Bundle) |
| `POST` | `/v1/actions/:runId/approve` \| `/reject` | 人工录入对该操作的审批或否决裁定 |
| `POST` | `/v1/actions/:runId/compensations` | 针对失败或需回滚的操作发起逆向补偿请求 |
| `POST` | `/v1/actions/:runId/compensations/:authorizationId/approve` | 签署并授权指定的逆向补偿操作 |
| `POST` | `/v1/actions/:runId/reconcile` | 触发对账机制，对冲外部漂移状态 |

### 只读项目视图

`/v1/projects` 仅暴露出只读 (GET-only) 的项目画像视图（包括智能体状态、作战指挥室、运行上下文、长期记忆、语义检索、治理指标与周报）。所有写操作路由均在编译期被彻底裁减，调用将直接返回 `404`。

## 产品业务接口族 (Product API Families)

除非特别注明，下列全部业务接口均挂载于 `/api` 前缀下：

| 业务族 | 路由基准路径 | 涵盖核心能力 |
| --- | --- | --- |
| 认证与用户管理 | `/api/auth` | 注册、登录、Token 刷新、登出、`me`、用户 CRUD、角色分配、密码重置 |
| OIDC 单点登录 | `/api/auth/oidc` | SSO 企业单点登录配置、OAuth 授权码交换、回调设置 |
| 项目视图 | `/projects` | 项目总览、智能体注册表、使命管理、指挥大屏、记忆持久化、合规治理 |
| 使命与日志 | `/projects/:projectId/missions` | 使命发起、人工审批、使命执行审计日志 |
| 记忆索引 | `/projects/:projectId/memory-index` | 记忆域划分、条目管理、状态主动对账 |
| 命名空间记忆 | `/api/namespaced-memory` | 多租户隔离的命名空间读写、语义搜索、统计审计与 ACL 访问控制 |
| 冲突探测 | `/projects/:projectId/conflict-detection` | 记忆与规则的事前预检与事后反应式冲突扫描及摘要报告 |
| 评估置信度 | `/projects/.../confidence`, `/api/confidence/thresholds` | 置信度量化报告、动态降级告警与判定阈值管理 |
| 质量保障 | `/api/quality`, `/api/consistency` | 幻觉检测核验、多步推演一致性校验记录 |
| 幻觉与血缘溯源 | `/api/hallucination`, `/api/lineage` | 单次运行风险评级与上下文因果血缘树追溯 |
| 安全防御体系 | `/api/security` | 提示词注入扫描、记忆投毒防御、可信度评分、安全态势大屏 |
| 流水线与状态机 | `/api/pipeline`, `/api/state-machine` | 多智能体流水线调度、有限状态机流转跃迁、人工干预拦截 |
| DAG 工作流 | `/api/workflows` | 工作流 CRUD 管理以及 `POST /api/workflows/:id/execute` 触发执行 |
| Token 与成本 | `/api/cost` | 成本聚合汇总、开销记录追溯、预算额度控制、成本大屏 |
| 历史回放 | `/api/replay` | 历史执行检索、运行事件全量还原、检查点快照导出 |
| 团队拓扑 | `/api/teams` | 团队运行状态检视、工作项分派、智能体分配与动态指派 |
| 死信队列 (DLQ) | `/api/dlq` | 失败任务分类统计、异常堆栈分析、死信重放重试机制 |
| 审批决策流 | `/api/approval` | 策略配置、审计日志追溯、沙箱模式切换、动态策略模式 |
| 知识库引擎 | `/api/knowledge`, `/api/knowledge-base` | 文档摄入、分块向量检索、语义问答、文件上传管理 |
| 分布式 Saga 事务 | `/api/saga` | Saga 事务流水线、详情透视、时间线回溯、实时 SSE 进度流 (`/api/saga/stream/:runId`) |
| 效果评估与裁判 | `/api/eval`, `/api/evaluation` | 基准数据集、LLM 独立裁判、A/B 效果对比、Wilcoxon 显著性检验、`pass-at-k` |
| 智能体自我画像 | `/api/agents/:agentId` | 智能体能力自评 (`self-assess`) 与自我行为模型建模 (`self-model`) |
| 智能体名片 | `/api/agent-cards` | 智能体名片列表、ID 检视、标准化定义创建 |
| 推理决策配置 | `/api/reasoning` | 推理模式切换 (`select-mode`) 与置信度联动行为策略 (`confidence-action`) |
| 定制化报表 | `/api/reporting` | 报表生成引擎状态检视、启用/禁用调度、模板渲染导出 |
| 拜占庭共识算法 | `/api/consensus` | 共识拓扑构建、拜占庭偏离探测 (BPD)、声誉衰减积分与安全收敛停止 |
| 审计合规日志 | `/api/audit`, `/api/audit-logs` | 不可篡改审计日志检索、结构化导出、来源分类与统计聚合 |
| 合规与治理 | `/api/governance` | 密码学检查点、关键节点人工审批、授权过期管理、全局风险评分 |
| 首次引导流程 | `/api/onboarding` | 状态探测、内置示例引导、模型连通性探测、配置保存、首个任务执行 |
| 全局系统设置 | `/api/settings` | 读取与热更新运行时核心参数配置 |
| API Key 鉴权凭据 | `/api/admin/api-keys` | 管理员凭据列表、分权 Key 生成、撤销失效操作 |
| 外部 Webhook 推送 | `/api/outgoing-webhooks` | 外部回调注册 CRUD、投递统计指标、历史交付追踪 |
| 事件流分发 | `/projects/:projectId/events`, `/events`, `/api/messages/stream` | 多通道 SSE 实时事件广播流 |
| 全链路可观测性 | `/api/v1/observability` | 任务全景、时间线回溯、调用树、成本度量、决策归因、智能体与工具监控、SLO 看板、数据回放与反馈沉淀 |
| 成本驾驶舱 | `/api/cost/dashboard` | 专为大屏设计的高聚合 Token 与财务开销透视看板 |

### 带版本号的历史别名路由说明

部分旧版业务族为了向后兼容，可能在底层保留了带有历史版本前缀的别名路径。这些别名**并非**公开稳定的集成接口，本文档刻意不予收录。请统一基于 `/api` 标准业务路径进行新功能对接；涉及 Action Gateway 网关交互时，请统一调用无前缀的 `/v1` 端点。

## 标准协议支持 (Protocols)

| 挂载路径 | 协议标准与用途说明 |
| --- | --- |
| `/a2a` | Agent-to-Agent 协议：名片发现、任务分派、工件交互。`/.well-known/agent-card` 允许公开访问；其余接口均需认证鉴权 |
| `/a2a/v2` | A2A v2 增强协议：提供 `/.well-known/agent-card.json` 端点，支持 `POST /` 与流式交互 `POST /stream` |
| `/mcp` | Model Context Protocol 管理端点：`POST /` JSON-RPC 通信、`/.well-known/mcp` 服务描述、`/status`、`/discover` 及 `/connect` |
| `/mcp/client` | 客户端连接专用的 MCP 对接端点 |
| `/scim/v2` | SCIM 2.0 企业用户与组织架构自动化同步管理标准接口 |

> [!TIP]
> HTTP 路径下的 `/mcp` 接口主要充当配置管理与服务发现入口。若需要将 Commander 工具能力直接挂载到外部 MCP 客户端（如 Claude Desktop），推荐运行基于 Stdio 的专用进程 `commander-mcp-server`——详见 [MCP 协议指南](/zh/mcp)。

## 已废弃与受门禁保护的路由 (Gated Routes)

旧版传统执行路径仅在**同时严格满足下列全部四项条件**时方被允许激活：

1. 显式配置环境变量 `COMMANDER_LEGACY_EXECUTION=1`
2. `NODE_ENV` 的值**不为** `production`
3. `COMMANDER_V2_MODE` 的值**不为** `1`
4. 当前解析的系统画像**不为** `enterprise`

只要有任何一项条件不满足，下列遗留入口将全部被彻底阻断：

- `/api/runs` 下的 `POST` 执行路由已被彻底下线：除符合上述四项条件外，调用将直接返回 **`410 LEGACY_EXECUTION_GONE`**。
- 编排调度器路由 `/api/orchestrator`（包括 `execute`、`deliberate`、`stream`）：除非满足上述条件，否则该路由在启动时**根本不会被挂载进路由树**，因此调用将返回 `404`。即使由于满足条件而挂载，其内部仍会进行二次校验并返回 `410 LEGACY_EXECUTION_DISABLED`。切勿针对该路径进行系统对接。
- 状态机 `/api/state-machine` 与流水线 `/api/pipeline` 虽然始终挂载，但在路由级中间件中会自动阻断并返回 `410 LEGACY_EXECUTION_DISABLED`。例外情况：审批决策路由 `POST /:taskId/approve` 与 `/reject` 保持放行，以保证认证鉴权能够在旧版检查前优先完成。
- `/v2` 下的基准压测路由（包括 `/v2/runs`、`/v2/runs/batch`、`/v2/runs/status`、`/v2/effects`、`/v2/bench/anomalies`）专为自动化性能基准测试设计。它们仅在 `COMMANDER_V2_BENCH_HARNESS=1` 时挂载，**严禁在任何生产拓扑中开启**。

### 代码中存在但从未挂载的无效路由

代码库中存在 `createChatRouter` 与 `createWebhookRouter` 的定义，但它们仅供单元测试与契约测试调用。在实际运行的 API 服务中，`/api/chat` 与 `/api/webhook/*` **从未被挂载至应用**。请勿尝试对接这些不存在的外部端点。

## 接口契约发现 (OpenAPI Discovery)

API 导出的 OpenAPI 3.1 契约文档是基于已注册的业务 Router 动态反射生成的。因此，顶层直接通过 `app.get` 挂载的基础系统探针路由（如 `/health`、`/ready`、`/metrics`、`/system/status`、`/health/detailed` 等）并不会呈现在该 JSON 文档中。请将该 OpenAPI 文档视作业务 Router 层的接口契约定义，而非全量服务路由的机械枚举。