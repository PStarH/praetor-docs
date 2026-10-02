# 快速入门指南

## 环境依赖与前置条件

- **Node.js 22.x** 与 **pnpm 9**（可通过 Corepack 自动锁定指定版本）。
- 首次体验模拟演示环境**无需任何大模型提供商 API Key 凭据**。

企业客户建议首先阅读 [Shadow Phase A（影子评估指南）](https://github.com/PStarH/Commander/blob/shadow-phase-a-0.1.0-alpha.20260910/docs/pilot/shadow/README.md)，该模式可在完全不产生任何外部写副作用的前提下回放评估历史真实调用。

## 选择你的首次体验路径

| 体验目标 | 推荐路径 | 所需凭据与前置准备 |
| --- | --- | --- |
| **体验多智能体审议与质量门禁** | [1. 轻量化模拟演示](#_1-安装并运行模拟演示) | 零凭据（纯内存 Mock 模拟） |
| **真实审查 Git 代码变更 (LLM 裁判)** | [2. 大模型只读代码审查](#_2-基于真实模型的只读代码审查-推荐首选体验) | 1 个大模型 API Key (OpenAI / Anthropic / DeepSeek) |
| **验证网络丢包故障自愈与幂等性** | [3. GitHub Action 试点离线测试](#_3-github-action-试点受治理写操作与故障恢复) | 零凭据（离线契约测试套件） |
| **启动可视化控制大屏** | [4. 本地可视化界面](#_4-本地可视化界面) | 零凭据（`pnpm gui` 启动本地开发控制台） |

## 1. 安装并运行模拟演示

```bash
git clone https://github.com/PStarH/Commander.git
cd Commander
corepack enable
pnpm install --frozen-lockfile
pnpm build

pnpm exec tsx packages/core/src/cliEntry.ts --help
pnpm exec tsx packages/core/src/cliEntry.ts doctor --offline
pnpm demo:l4-a
```

- `doctor --offline` 在完全不连接外部提供商网络的前提下检查本地运行环境依赖。
- `demo:l4-a` 启动内置内存依赖与环回模拟服务：无外部大模型调用，无真实外部写入。clone、install 与 build 仅写入本地检出目录、依赖缓存与构建产物。
- 该路径仅作为本地开发演练与逻辑验证，不作为生产就绪性背书。

## 2. 基于真实模型的只读代码审查 (推荐首选体验)

进行首次真实提供商测试时，强烈推荐使用严格受限的只读代码审查能力，而非开放自主执行权限。该命令下模型**不挂载任何执行工具**，从根本上防止非预期的 Shell 命令、文件修改或外部写变更：

```bash
# 显式指定并导出所选提供商的 API Key
export OPENAI_API_KEY=sk-...
pnpm exec tsx packages/core/src/cliEntry.ts review   --commit HEAD --real --provider=openai
```

该命令读取当前 Git 选定提交的 Diff 与本地审查规范，向指定模型发送最多 15,000 字符的 Diff 内容，并严格将响应限制在 4,000 Token 及 8 MiB 大小内。网络传输超过 120 秒自动超时熔断中止。在发送仓库真实代码前，请先阅读 [安全体系与隐私保护](/zh/security)。

## 3. GitHub Action 试点（受治理写操作与故障恢复）

要在零外部凭据的前提下检视受治理的写操作全生命周期（提议 propose → 审批 approve → 检查 inspect → 恢复 recover），请执行离线契约验证：

```bash
pnpm test:github:offline
pnpm demo:github --help
```

若需在配置好的 Enterprise Gateway 上体验完整流程，请参阅 [GitHub 试点实战指南](https://github.com/PStarH/Commander/blob/master/docs/pilot/github/README.md)。

## 4. 本地可视化界面

| 界面工具 | 启动命令 | 本地访问地址 |
| --- | --- | --- |
| Web 控制台 (开发态) | `pnpm gui` | `http://localhost:5173`（API 服务监听在 `4000` 端口） |
| Web 控制台 (Docker Compose) | `docker compose --profile web up` | `http://localhost:3000` |
| HTTP API 服务 | 伴随上述任一命令启动 | `http://localhost:4000` |

`pnpm gui` 会同时拉起 API 服务与前端 Vite 开发服务器。在开发环境下，API 默认使用轻量 SQLite，仅对缺失的敏感密钥输出警告；但在生产环境下，服务强制要求配置持久化数据库以及 `JWT_SECRET` 和 `ADMIN_PASSWORD`。

启用 `observability` 监控剖面时，Grafana 默认监听在 `3001` 端口，注意这并不是 Commander API 的端口。

## 下一步

- [CLI 命令行参考](/zh/cli) — 查看每个命令与参数细节。
- [HTTP API 接口](/zh/api) — 端点规范、鉴权机制与 `/v1` Gateway 协议。
- [环境变量配置](/zh/configuration) — 环境变量字典与后端存储选择。
- [生产部署方案](/zh/deployment) — 本地与容器化部署指南与健康检查。
- [安全体系与隐私](/zh/security) — 接入外部系统前必读的安全规范。
- [支持策略与诚实边界](/zh/support) — 了解当前系统的真实能力与边界声明。