# 架构设计

Praetor 分为两个核心层级：**智能体运行时**（任务审议、拓扑编排、质量门禁）与 **Architecture V2 受治理执行平面**（内核、Effect Broker 效果代理、Worker 执行平面）。本页面提供系统全景图谱；具有约束力的设计决策记录在仓库 `docs/architecture/` 目录下的 ADR 架构决策记录中。

## 任务审议机制 (Deliberation)

在任何智能体启动前，每个输入任务都会经过类型分类、复杂度估算与执行拓扑选择三大步骤。

**任务分类 (Task Classification)** — 覆盖六种标准类型：`FACTUAL`（事实检索）、`REASONING`（复杂推理）、`CREATIVE`（创意生成）、`RESEARCH`（深度调研）、`CODING`（代码开发与重构）、`ANALYSIS`（深度分析）。

**复杂度估算 (Complexity Estimation)** — 系统计算复杂度综合得分以确定拓扑规模。单行修改仅调度单个智能体；而跨仓库的代码库审计则会扇出至多智能体协同网络。

**拓扑架构选择 (Topology Selection)** — 五种规范执行拓扑：

| 拓扑架构 | 拓扑形态与协作模式 |
| --- | --- |
| `SINGLE` | 单智能体全权负责端到端执行 |
| `CHAIN` | 线性流水线：多智能体顺序 Prompt 链式传递 |
| `DISPATCH` | 扇出并发：多智能体并行处理后汇聚聚合 |
| `ORCHESTRATOR` | 主管编排：总控智能体向下分发委派至专门 Worker |
| `REVIEW` | 循环迭代：生成者与评估者构成自校正闭环 |

系统仍兼容历史命名（`SEQUENTIAL`, `HANDOFF`, `PARALLEL`, `HIERARCHICAL`, `HYBRID`, `DEBATE`, `ENSEMBLE`, `EVALUATOR_OPTIMIZER`, `CONSENSUS`），并会自动归一化至上述规范拓扑。每个进程对每个遗留别名仅警告一次。

## 执行流水线

```
任务审议 → 拓扑路由器 → 智能体协作 (大模型推理 → 工具调用 → 自行验证)
         → 综合汇总 → 质量门禁矩阵 → 终态输出
```

智能体流式事件、工具调用请求与门禁判定结论会通过终端或 SSE 实时服务端推送流输出。

## 质量门禁矩阵 (Quality Gates)

在结果返回给调用者前，可配置 5 项质量检验门禁：

| 质量门禁 | 校验目标与职责 |
| --- | --- |
| `HALLUCINATION_CHECK` | 大模型裁判（LLM-as-judge）检测捏造事实与虚假代码引用 |
| `CONSISTENCY` | 校验跨智能体输出结论是否一致，阻断事实自相矛盾 |
| `COMPLETENESS` | 校验用户提问与任务目标的所有关键维度是否全量覆盖 |
| `ACCURACY` | 对照检索到的事实源数据核对结论真实性 |
| `SAFETY` | 深度扫描提示词注入攻击、越权外泄风险与违规内容 |

质量门禁是防护性检查，而非数学绝对保证。若门禁未通过，系统将触发重试或附带上下文输出诊断失败原因。

## 韧性与高可用保障 (Resilience)

| 容灾能力 | 底层工业级实现机制 |
| --- | --- |
| 熔断器 (Circuit Breaker) | 三态状态机 (`CLOSED` / `OPEN` / `HALF-OPEN`)，按供应商维度动态追踪错误率 |
| 死信队列 (DLQ) | 追加写入式 NDJSON 存储，细分 7 类死信，支持断点重放 |
| Saga 事务补偿 | 注册可逆补偿动作；若外部状态已不可逆则提供安全审计记录 |
| 检查点 (Checkpointing) | 基于 SQLite + WAL 实现单机崩溃安全恢复 |
| 语义级缓存 | SHA-256 精确哈希匹配与余弦相似度语义去重 |

DLQ 死信分类包括：`llm`, `tool`, `execution`, `verification`, `circuit_breaker`, `compensation`, `semantic_drift`。

## Architecture V2 架构

Architecture V2 将**持久化管理权威**与**工作执行平面**严格分离，将所有外部生产环境的写操作收敛至统一受控通道中。

### 系统架构与信任边界

Praetor 确立了严格的三层隔离模型，解耦不受信智能体推理与外部基础设施变更：

<p align="center">
  <img src="/commander-architecture-academic-zh.png" alt="图 1: 高保障解耦控制面架构全景" width="100%" />
</p>

*图 1: 正式三层控制体系架构规范。不受信的推理进程与外部写凭据物理隔离。所有产生外部副作用的变更均需经过 Preflight 幂等验证、Ed25519 签名的人类授权与 PostgreSQL WAL 步骤租约守护方可安全下发。*

| 核心代码包 | 核心架构职责 |
| --- | --- |
| `@praetor/contracts` | 版本化共享类型、错误码字典、状态机、事件信封与 OpenAPI V1 规范。纯类型包，零运行时依赖 |
| `@praetor/kernel` | 持久化生命周期的唯一法定权威：负责任务/步骤租赁、幂等排重、发件箱 (Outbox) 与崩溃数据迁移 |
| `@praetor/effect-broker` | 外部写入的唯一受批准路径。负责两阶段 `admit()` → `executeAdmitted()` 准入、Ed25519 权能令牌签名、配额与策略引擎 |
| `@praetor/action-adapters` | 目标系统适配器（GitHub PR、ServiceNow 事故单、Kubernetes 回滚等），配备完备的合规测试套件 |
| `@praetor/worker-plane` | 被租赁步骤运行的唯一合法执行面，具备 Fail-closed 失败闭合启动校验 |
| `@praetor/adapter-ops` | 负责事务补偿与孤立状态对齐清理的守护进程 |
| `@praetor/postgres-runtime` | 强化的 `pg.Pool` 运行时工厂：强制 `sslmode=verify-full`、CA 证书校验与 SPKI 公钥固定 |
| `@praetor/shadow-plane` | 面向 Shadow 影子模式的只读历史策略对比评估引擎 |
| `@praetor/core` | 智能体本地运行时：任务编排、工具集、供应商接入、上下文记忆与本地 CLI |
| `@praetor/sdk`, `praetor-ai` | 官方提供的 TypeScript 与 Python 客户端库 |
| `@praetor/mcp-server` | 暴露 Action Gateway 治理能力的 stdio MCP 服务端 |
| `@praetor/plugin-sdk` | 供外部扩展插件的官方接入规范 |

### 治理执行流 (Governance flow)

1. 任务请求提交至 Gateway (`POST /v1/runs`)，由 Kernel 持久化写入数据库。
2. 具备权能感知能力的 Worker 节点以步骤租约形式申领任务步骤。
3. 任何需要对外写入的步骤必须经由 Effect Broker：验证权能令牌有效性、绑定请求参数哈希、核验策略配额并签发审计凭证。
4. 高危或关键动作必须由人类批准；审批票据严格锁定请求的唯一摘要快照与策略版本。
5. 最终通过专用适配器（`@praetor/action-adapters`）下发外部操作。若网络传输中断，适配器在重试前必先向目标系统查询现有结果，彻底阻断重复副作用。
6. 若步骤在局部写入后异常中止，补偿动作由 `adapter-ops` 守护进程负责幂等回滚与最终状态对齐。

### Preflight 执行前排重与故障恢复协议

当外部写入遭遇网络丢包（如 HTTP 504 网关超时或 Worker 意外断电）时，传统智能体的盲目重试会引发生产级灾难。Praetor 执行确定性的 Preflight 预检协议：

<p align="center">
  <img src="/commander-preflight-protocol-zh.png" alt="图 2: Preflight 执行前排重与租约恢复协议" width="100%" />
</p>

*图 2: 分布式 Preflight 预检与故障恢复协议对比图。直观呈现传统智能体盲目重试导致的重复写灾难，与 Praetor 基于 WAL 租约接管与外部预检实现 Exactly-Once 恢复的确定性时序。*

### 两阶段人机密码学签名与存证全生命周期

<p align="center">
  <img src="/commander-crypto-gate-zh.png" alt="图 3: 两阶段人机密码学门禁与 JWS 存证全生命周期" width="100%" />
</p>

*图 3: 密码学数据流向图。不受信智能体生成规范化 JSON 提案；审阅人员通过离线 Ed25519 私钥为计算出的意图摘要背书签名；Effect Broker 验证后发放单次短效权能令牌；隔离沙箱执行完成后产出具备法律合规效力的 RFC 7515 JWS 防篡改审计存证。*

### 存储体系与持久化权威

| 存储层级 | 法定持久化权威 |
| --- | --- |
| API 产品级存储 | `sqlite`（本地默认）、`memory` 或 `postgres` |
| Kernel 内核存储 | PostgreSQL 独占权威 — 严格管理 runs、steps、events、outbox 与 leases |
| 本地运行时状态 | `.commander_state/`（WAL 日志位于 `.commander_state/event-sourcing.wal`） |

在生产环境中，若未正确配置持久化 PostgreSQL，API 将采取 Fail-closed 策略拒绝启动。本地文件系统状态不具备多节点共享的法定一致性。

## 相关页面

- [工具体系](/zh/tools) — 18 个内置工具与其权能分级
- [模型供应商](/zh/providers) — 25 家供应商接入与故障转移链
- [MCP 协议](/zh/mcp) — 外部 MCP 工具如何接入系统运行时
- [安全体系与隐私](/zh/security) — 权能令牌、签名存证与沙箱隔离

## 深入阅读

- `docs/architecture/000-index.md` — ADR 架构决策索引与特性冻结规范
- `docs/v2-migration-guide.md` — 升级至 Architecture V2 迁移指南
- `docs/slo.md` — 系统 SLO 服务等级目标
- [为什么智能体的外部写操作不能盲目重试？](https://github.com/PStarH/Praetor/blob/master/docs/content/why-retrying-ai-agent-external-actions-is-unsafe.md) — 深入剖析超时绝非失败、盲目重试必致重复写入的分布式故障模型