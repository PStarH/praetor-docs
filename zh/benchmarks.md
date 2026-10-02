# 基准测试与防御评估 (Benchmarks & Evaluation)

Commander 维护了系统性的自动化基准测试套件，用于版本变更时的防性能回归检测、安全防御有效性验证以及系统鲁棒性度量。

> [!NOTE]
> **可信度与证据边界声明**：本文档所记录的测试数据与指标均运行于**模拟/受控的测试环境 (Simulated / Scripted Harnesses)** 或作为 **CI 流水线基准值 (CI Baselines)**。它们代表系统在声明环境下的理论上限或工程基线，不构成针对特定客户商业交付的绝对 SLA 承诺，亦不代表第三方法定合规认证背书。实际表现受底层硬件、部署网络及模型提供商真实响应延迟影响。

## 快速运行基准套件 (Quick Start)

在本地源码检出目录中，可直接执行各自动化测试命令：

```bash
# 运行核心自动化验证套件
pnpm benchmark:all          # WAL + 故障自愈 + 状态回放 + SLO + 租户隔离 + 蓝军对抗 + AgentDojo
pnpm check:readiness --non-strict # 诊断校验：验证系统基准指标是否满足规范架构

# 安全防御基准测试
pnpm benchmark:agentdojo     # AgentDojo 12 组间接提示词注入 (Indirect Injection) 防御测试
pnpm benchmark:agentdojo:all # 全量 3 项安全防御基准 (AgentDojo + AgentSafetyBench + AgentHarm)
pnpm benchmark:redteam       # 自动化红蓝对抗攻防矩阵 (覆盖 8 大类攻击的 47 组场景)

# 韧性容灾与故障恢复基准
pnpm benchmark:chaos         # Chaos 255 混沌工程故障注入演练 (模拟测试环境)
pnpm bench:wal               # WAL 预写日志读写吞吐基准
pnpm bench:wal:regress       # WAL p99 延迟回归防线检测
pnpm bench:recovery          # RecoveryBootstrapper 宕机崩溃恢复 (<5s 恢复目标)
pnpm bench:replay            # EventSourcingEngine 确定性回放吞吐 (1k/10k/100k 事件阶梯)
pnpm bench:slo               # 系统 SLO 达成基线 (自愈耗时、故障转移、逆向补偿、死信重放)

# 多租户防越权测试
pnpm bench:tenant-isolation  # 跨租户模糊测试 (1,000 次变异，涵盖 6 类攻击向量)
```

## 基准测试全景矩阵 (Benchmark Matrix)

| 测试套件 | 领域分类 | 评测范围与样本规模 | 测试框架下表现 / 当前状态 | 对应执行脚本 |
| --- | --- | --- | --- | --- |
| **AgentDojo** | 安全防御 | 12 组间接提示词注入攻击用例 | 所列用例均被防御策略拦截（模拟测试框架） | `scripts/benchmark-agentdojo.ts` |
| **红蓝对抗攻防矩阵** | 安全防御 | 覆盖 8 大类攻击向量的 47 个对抗演练场景 | 所列用例均被防御策略拦截（模拟测试框架） | `scripts/benchmark-redteam.ts` |
| **Agent-SafetyBench** | 安全防御 | 10 组典型安全合规挑战样本 | 所列用例均被防御策略拦截（模拟测试框架） | `scripts/benchmark-agentdojo.ts --all` |
| **AgentHarm** | 安全防御 | 8 组恶意有害意图测试样本 | 所列用例均被防御策略拦截（模拟测试框架） | `scripts/benchmark-agentdojo.ts --all` |
| **Chaos 混沌工程** | 容灾韧性 | 200 组综合故障 + 55 组状态变异用例 (=255) | 完整测试套件；自动化度量 MTTD、MTTR 及 DLQ 死信自愈 | `benchmarks/chaos-runner/src/index.ts` |
| **WAL 预写吞吐** | 核心性能 | 纯追加式事件日志写入吞吐能力 | 建立 p99 延迟工程基线；纳入每日防回归门禁 | `scripts/bench-wal-throughput.ts` |
| **RecoveryBootstrapper** | 宕机自愈 | 模拟单节点崩溃并残留 10/100/1000 僵尸步骤 | 在受控测试环境下达成 <5s 的快速自愈目标 | `scripts/bench-recovery-bootstrap.ts` |
| **事件溯源回放** | 状态恢复 | 针对 1k/10k/100k 规模事件流执行严格确定性回放 | 100% 验证状态机迁移状态哈希一致性 | `scripts/bench-event-sourcing-replay.ts` |
| **SLO 服务等级度量** | 系统可靠性 | 覆盖故障转移、逆向补偿流转、死信处置各阶段 | API 模拟可用性 99.95%，调度自愈 <5s (CI 基准值) | `scripts/bench-slo-baseline.ts` |
| **租户越权模糊测试** | 安全隔离 | 1,000 次变异请求，覆盖 6 种租户穿透攻击向量 | 进程内多租户隔离原语全部通过校验 | `scripts/bench-tenant-isolation.ts` |

## 纵深防御架构验证 (Defensive Architecture)

### 间接提示词注入防御 (AgentDojo)

基准测试套件从输入端、工具调用端到模型输出端建立了三重安全拦截防线：

1. **输入边界 (Input Boundary)**：输入提示词标准化清洗、动态分隔符（Delimiter）强制隔离，以及不可预测的金丝雀令牌（Canary Token）追踪检测。
2. **工具边界 (Tool Boundary)**：通过 Ed25519 / HMAC 签名的细粒度权能令牌校验，强制执行参数结构契约校验与工具信任分级（划分 `trusted` 受信任与 `untrusted` 不受信任工具）。
3. **输出边界 (Output Boundary)**：挂载五大质量校验门禁（`HALLUCINATION_CHECK` 幻觉检测、`CONSISTENCY` 一致性、`COMPLETENESS` 完整性、`ACCURACY` 准确性、`SAFETY` 安全合规），严密扫描数据越权外发风险与未经授权的工具调用行为。

### 模型推理基准 vs 基础设施容灾韧性基准 (Reasoning vs. Resilience)

在学术界与消费级 AI 领域，SWE-bench、WebArena 或 GAIA 等基准主要度量的是**大语言模型的推理智商 (Model Reasoning IQ)**：测试模型在完美理想的网络与执行沙箱下，能否推导出一道算法题、编写一段代码补丁或完成一次网页浏览。

然而在企业级生产系统落地的第一线，**阻碍自主智能体进入生产的核心瓶颈不是模型智商，而是分布式系统韧性与执行面防护 (System Resilience & Control Plane Security)**：
- 当上游大模型提供商在执行关键写入（如金融划账、资源创建）中途返回 HTTP 504 Gateway Timeout 或 429 速率限制时，智能体会不会陷入盲目重试导致重复扣款或资源爆仓？
- 当下游第三方工具响应超时，远程资源其实已经创建成功，重试机制能否实现“先查后做”的幂等探测？
- 当 Worker 容器被 Kubernetes 因内存突增直接驱逐杀进程（`OOMKilled` / `SIGKILL`）时，未完成的任务能否在数秒内被接管且零数据丢失？
- 当调用外部工具返回的网页或 API 响应中包含恶意间接提示词注入（Prompt Injection）时，系统能否在执行危害工具前完成拦截？
- 当并发 Worker 同时操作同一租户或外部实体时，分布式租约与锁能否防止脑裂和脏写？

Commander 的基准测试套件专注于评估**故障注入、确定性状态恢复与纵深防御能力**。Commander 不标榜模型本身的推理能力，而是通过严格可复现的基准证明：当上游模型失效、下游网络抖动、宿主环境崩溃以及外部数据投毒时，外层的执行控制平面能够提供确定性的状态自愈、密码学边界鉴权与幂等防重保障。

### Chaos 255 混沌工程与自愈韧性

Chaos 255 自动化测试套件（位于 `benchmarks/chaos-runner`）向系统注入覆盖 **255 组测试用例**（200 组综合合成用例 + 55 组深度变异场景）的分布式异常，锚定 47 个真实生产事故原型，涵盖 641 个 Mock 工具、802 个智能体角色定义与 496 个确定性断言：

- **四层故障注入体系 (4-Layer Fault Hierarchy)：**
  - **L1 (LLM 模型调用故障)：** 提供商超时、HTTP 429 限流、畸形 JSON 流式截断、Token 上限截断及故障转移延迟。
  - **L2 (Tool 工具调用故障)：** 覆盖 10 种典型故障模式（HTTP 5xx、HTTP 4xx、磁盘写满、内存爆仓、进程崩溃、状态损坏、依赖不可用、时钟漂移、凭据过期、套接字超时）。
  - **L3 (System 基础系统故障)：** 单调步骤租约超时失效、PostgreSQL 连接池断开、SQLite WAL 锁竞争以及 Worker 进程执行中途突发 `SIGKILL`。
  - **L4 (Tenant 租户与并发故障)：** 多租户爆炸半径隔离、喧宾夺主 (Noisy-Neighbor) 速率惩罚与跨租户隔离穿透模糊测试。

- **三大变异维度 (Mutation Axes)：**
  - **遥测缺失 (Fog of War)：** 局部可观测性丢失、执行凭据收据丢失及歧义网络响应。
  - **随机灰色故障 (Stochastic / Gray Failure)：** 间歇性套接字挂起与极端长尾延迟抖动。
  - **安全与稳定性汇聚 (Security-Stability Convergence)：** 运行态自愈过程中伴随恶意的间接提示词注入攻击。

- **核心韧性机制覆盖验证：**
  - **熔断防护 (Circuit Breaking - 255 例)：** 提供商降级时三态有限状态机严格跃迁（`CLOSED` → `OPEN` → `HALF-OPEN`）。
  - **Saga 逆向补偿回滚 (164 例)：** 局部写入失败时严格按逆序触发已注册的补偿动作。
  - **死信队列自愈 (DLQ - 139 例)：** 纯追加式 NDJSON 捕获与 7 类故障分类归档重放。
  - **租约与超时管理 (128 例)：** 步骤租约安全过期，新 Worker 无缝接管且不发生重复执行。
  - **幂等性与预检探测 (Preflight Idempotency - 34 例)：** 重试前主动查询远端事实状态，杜绝重复变更。

## 可靠性目标与 CI 基线指标 (Reliability Targets)

| 指标维度 | 目标基线 | 实现保障机制 | 适用环境与生效范围 |
| --- | --- | --- | --- |
| 检查点崩溃自愈耗时 | < 5 秒 | SQLite + WAL 预写日志 / Postgres Outbox 发件箱 | CI 基线环境 |
| 提供商宕机自动故障转移 | < 10 秒 | 智能容灾回退链动态重试 | 已配置的多提供商链路 |
| Saga 分布式事务逆向补偿 | < 30 秒 | 后台补偿调度器 (`adapter-ops`) | 内存状态 / PostgreSQL |
| 死信队列 (DLQ) 积压处置 | < 60 秒 | 纯追加式 NDJSON 日志与幂等重放引擎 | 本地队列 |

## 企业技术选型与试点落地指引 (Pilot Guidance)

在企业级生产系统选型与尽职调查中，建议不要仅参考纸面基准数据，而应当在真实的业务隔离沙箱中组织概念验证 (POC)：

1. **检验关键工具调用边界**：评估针对敏感系统工具（如 `exec`、`git`、外部 CRM/ERP API）是否已按规范挂载了 Ed25519 权能令牌防线与人工审批确认门禁。
2. **主动模拟网络抖动故障**：在外部写操作交互链路中人为注入丢包与网络超时（例如利用官方提供的 GitHub 试点网络拦截代理），验证系统在经历网络异常后是否能严格执行“先查后做”的探测排重，避免重复写造成脏数据。
3. **核验数字存证封包的防篡改性**：导出写操作生成的 Ed25519 签名存证证据封包（Evidence Bundle），使用官方 SDK 提供的 `verifyActionEvidence()` 工具函数进行离线脱机密码学验签。