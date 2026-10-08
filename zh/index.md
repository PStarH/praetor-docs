# Praetor

面向 Coding 与 DevOps AI 智能体的安全审批与状态恢复平面

*杜绝重复外部变更 · 网络丢包与超时安全恢复 · 密码学签名存证链*

自主智能体正在迅速接管关键生产任务：修改代码库、提交 Pull Request、运行数据库迁移以及配置云端基础设施。然而，当智能体发起外部写操作时，**网络超时、连接断开或节点崩溃会使系统陷入无法确认的不确定状态：该写入究竟是否已经发生？被执行了几次？提交了什么载荷？**

盲目重试会导致重复的 PR、多次重复扣款/计费或底层状态污染；而直接放弃又会留下悬空的外部孤立副作用。

Praetor 从系统底层解决了这一经典分布式系统难题。它在智能体外部独立记录审批后的请求与其执行状态，执行 **Preflight（执行前排重查询）** 来探测外部实体是否已生效；当证据模糊存疑时，系统明确停止在 `UNKNOWN` 状态并告警，坚决杜绝盲目猜测或重复执行。

<p align="center">
  <img src="/commander-overview-zh.png" alt="Praetor 核心架构与安全治理全景" width="100%" />
</p>

<details>
<summary><b>查看纯文本架构示意图 (ASCII)</b></summary>

```
   ┌────────────────────────────────────────────────────────┐
   │             AI 智能体框架与大语言模型                  │
   │  Claude Code · Cursor · OpenAI Agents · LangGraph      │
   └──────────────────────────┬─────────────────────────────┘
                              │ 1. 提议变更（智能体不直接持有写权限凭据）
                              ▼
   ┌────────────────────────────────────────────────────────┐
   │             Praetor 治理与恢复控制面                 │
   │  ┌─────────────────────────┐ ┌──────────────────────┐  │
   │  │ 重试前预检 (幂等性保证) │ │ 人类双阶段密码学审批 │  │
   │  │ (Query-Before-Retry)    │ │ (Cryptographic Hash) │  │
   │  └─────────────────────────┘ └──────────────────────┘  │
   │  ┌─────────────────────────┐ ┌──────────────────────┐  │
   │  │ 持久化 PostgreSQL 内核  │ │ 防篡改数字签名存证   │  │
   │  │ (崩溃安全 Step Lease)   │ │ (Ed25519 Signed JWS) │  │
   │  └─────────────────────────┘ └──────────────────────┘  │
   └──────────────────────────┬─────────────────────────────┘
                              │ 2. 受治理执行与自动事务补偿
                              ▼
   ┌────────────────────────────────────────────────────────┐
   │             外部基础设施与目标系统                     │
   │    GitHub (PR/Issue) · Kubernetes · 云端基础资源       │
   └────────────────────────────────────────────────────────┘
```

</details>

深入阅读工程长文：[为什么智能体的外部写操作不能盲目重试？](https://github.com/PStarH/Praetor/blob/master/docs/content/why-retrying-ai-agent-external-actions-is-unsafe.md)。

## AI 智能体面临的分布式系统挑战

| 核心挑战 | 传统智能体朴素执行 | Praetor 受治理执行 |
| --- | --- | --- |
| **响应丢失**（如创建 PR 时遭遇 504 网关超时） | 重新规划或盲目重试 → **产生重复 PR 与脏变更** | **Preflight 执行前排重**：基于操作唯一身份先查后试，杜绝重复写入 |
| **节点中途崩溃** | 状态丢失或归零重跑，留下不可控的外部副作用 | **持久化 PostgreSQL 内核**：租约安全回收，新 Worker 无缝接管与恢复 |
| **凭据暴露风险** | 智能体进程直接持有写权限 API Token / SSH 密钥 | **严格职责边界**：智能体仅有提议（Propose）权，真实凭据隔离在受控环境 |
| **人类审批确认** | 纯文本确认或无约束的按钮点击 | **密码学参数绑定**：审批不可变锁定请求内容摘要与策略快照 |
| **审计与存证归因** | 终端易失日志，事后不可归因 | **Ed25519 签名存证**：RFC 7515 JWS 签名收据，支持独立离线验证 |
| **回滚与撤销** | 依赖临时补丁脚本，常常无法安全回滚 | **受治理的补偿机制**：要求独立的人类授权绑定与专属收据 |

<p align="center">
  <img src="/commander-preflight-protocol-zh.png" alt="图 1: Preflight 执行前排重与故障恢复协议" width="100%" />
</p>

## ⚡ 60 秒内上手体验 Praetor 的 4 种方式

| 体验路径 | 执行命令 | 验证的核心能力 |
| --- | --- | --- |
| **1. 零依赖轻量演示** | `pnpm demo:l4-a` | 多智能体协作决策、5 大质量门禁、纯内存执行（无需配置 API Key） |
| **2. 真实大模型代码审查** | `pnpm exec tsx packages/core/src/cliEntry.ts review --commit HEAD --real --provider=openai` | 针对你的 Git 变更进行只读审查，通过配置的质量门禁输出专业报告 |
| **3. 交互式 Web 控制台** | `pnpm gui` | 在本地 `:5173` 启动控制台：查看拓扑流向、DLQ 死信队列与人工审批流 |
| **4. 受治理动作离线测试** | `pnpm test:github:offline` | 130 项离线契约断言，验证幂等排重与网络丢包恢复逻辑 |

### 📦 SDK 与 MCP 快速集成

#### 1. Python SDK（多智能体规划与执行）
```python
from commander import CommanderClient

async with CommanderClient(base_url="http://127.0.0.1:4000", api_key="cmd-...") as client:
    # 零模型消耗的拓扑智能规划
    plan = await client.plan("审查代码库安全漏洞并提议修复方案")
    print(f"推荐拓扑: {plan.topology} ({plan.estimated_steps} 步，预估预算: ${plan.estimate.cost_budget_usd:.2f})")

    # 执行任务并通过 5 层质量门禁检验
    result = await client.run("审查认证模块 diff 并提议热修复")
    print(f"状态: {result.status} — {result.summary}")
```

#### 2. 受治理动作网关 (Python)
```python
from commander import CommanderGatewayClient, ProposeActionInput

async with CommanderGatewayClient(base_url="http://127.0.0.1:4000", api_key="cmd-...") as gateway:
    # 提议带有幂等排重保障的外部写操作
    action, replay, accepted = await gateway.propose_action(
        ProposeActionInput(
            source="coding-agent",
            destination="github://octo-org/repo",
            effect_type="github.pullRequestCreate",
            args={"title": "fix: prevent token replay", "head": "fix-auth", "base": "main"},
            idempotency_key="0191ec4d-91b4-7b98-b80c-7b897914e1a0",
        )
    )
    print(f"动作 ID: {action.run_id}, 状态: {action.state}, 审批决策: {action.decision.effect}")
```

#### 3. 通用 Model Context Protocol (MCP) 集成
支持任意标准 MCP 客户端（Claude Code、Cursor、Windsurf、LangGraph、OpenAI Agents SDK 等）：
```json
{
  "mcpServers": {
    "commander": {
      "command": "commander-mcp-server",
      "env": {
        "PRAETOR_ACTION_GATEWAY_URL": "http://127.0.0.1:4000",
        "PRAETOR_API_KEY": "cmd-..."
      }
    }
  }
}
```

## 核心架构与系统能力

Praetor 构建了坚固的执行织网，将智能体的不受信推理与底层生产变更彻底解耦：

- **任务审议引擎 (Deliberation Engine)**: 根据任务类型与复杂度，自动推导并匹配最佳执行拓扑架构（`SINGLE`, `CHAIN`, `DISPATCH`, `ORCHESTRATOR`, `REVIEW`）。
- **25+ 主流大模型提供商与自动故障转移**: 统一配置，在 OpenAI、Anthropic、Gemini、Groq、Mistral、Ollama、DeepSeek 等之间无缝切换。详见 [模型供应商](/zh/providers)。
- **18 个内置系统工具与原生 MCP 支持**: 内置 Shell、文件系统、Git 等多级信任工具，全量支持标准 Model Context Protocol (stdio MCP)。详见 [工具体系](/zh/tools) 与 [MCP 协议](/zh/mcp)。
- **多层质量验证门禁 (Quality Gates)**: 涵盖幻觉检测、跨智能体一致性、任务完整性、事实准确性与注入安全性评估，严格把关。
- **分布式高可用与容灾内核**: 熔断器、7 大类死信队列 (DLQ)、Saga 事务补偿以及 PostgreSQL 崩溃安全步骤租赁。
- **受治理的写操作控制面**: 权能令牌 (Capability Tokens)、策略引擎、密码学人机审批绑定与 Ed25519 签名存证收据。

## 企业试点评估路径

Praetor 当前处于 **Alpha** 阶段，提供两条严密的评估路径：

- **GitHub 试点（受治理动作与故障恢复）：** 聚焦于基于同仓库现有分支创建 PR。智能体提出提议，人类审批确切请求。当遭遇网络丢包时，系统通过持久化的动作唯一身份查询 GitHub，而非创建重复 PR。详见 [GitHub 试点指南](https://github.com/PStarH/Praetor/blob/master/docs/pilot/github/README.md)。
- **Shadow Phase A（历史影子评估模式）：** 企业本地运行的只读评估模式，对照固定的策略版本重放历史调用观测，不执行任何外部变更。请下载 [Shadow Phase A 发行包](https://github.com/PStarH/Praetor/releases/tag/shadow-phase-a-0.1.0-alpha.20260910)。
- **企业试点就绪清单：** 包含安全性、多租户、SLO 与数据合规的详细技术对照基准。正式试点前请审阅 [ENTERPRISE_READINESS.md](https://github.com/PStarH/Praetor/blob/master/ENTERPRISE_READINESS.md)。

## 开发产品形态

- **Local CLI:** 面向个人开发者或本地研发团队的默认支持路径。
- **Web 控制台:** 随 API 启动的可视化控制大屏，用于实时流式查看拓扑与审批动作。
- **Enterprise Gateway:** 处于 Alpha 阶段的 `/v1` 服务端路径 (`apps/api` → `@praetor/kernel` Postgres → worker-plane + effect-broker)。

## 快速导航

| 页面 | 说明 |
| --- | --- |
| [快速入门](/zh/getting-started) | 安装依赖、运行模拟演示、启动交互界面 |
| [CLI 命令行参考](/zh/cli) | 每个命令、子命令与配置参数的详尽参考 |
| [HTTP API 接口](/zh/api) | 端点定义、身份认证机制与 `/v1` Gateway 协议 |
| [配置参考](/zh/configuration) | 环境变量字典与后端存储选型 |
| [工具体系](/zh/tools) | 18 个内置工具、权能分级与 MCP 过滤机制 |
| [模型提供商](/zh/providers) | 25+ 供应商环境变量、故障转移链与模型分层 |
| [MCP 协议支持](/zh/mcp) | stdio MCP 服务集成、工作模式与命令安全白名单 |
| [Web 控制台](/zh/web-console) | 控制台路由、启动方式与审批流 |
| [架构设计](/zh/architecture) | 拓扑路由、质量门禁与 V2 控制面全景 |
| [工作流自动化](/zh/workflows) | 工作流编排、调度器、Webhook 与后台任务 |
| [核心包生态](/zh/packages) | Workspace 模块划分、TS/Python SDK 与插件架构 |
| [SDK 概览](/zh/sdk) | Python / TypeScript 客户端接入指南 |
| [生产部署](/zh/deployment) | 部署方案、Docker Compose 与环境要求 |
| [运维与回滚](/zh/operations) | 健康检查、监控指标与安全回滚边界 |
| [安全与合规](/zh/security) | 身份认证、沙箱机制、受治理写入与安全免责声明 |
| [故障排查](/zh/troubleshooting) | 常见错误排查与修复方案 |
| [性能基准](/zh/benchmarks) | 基准测试范围与客观度量边界 |
| [支持与边界](/zh/support) | 当前支持能力与诚实的技术边界声明 |

连接真实客户数据或第三方写工具前，请务必详阅 [安全体系与隐私保护](/zh/security)。