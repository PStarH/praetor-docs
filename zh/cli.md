# 命令行参考手册 (CLI Reference)

Commander Local CLI 是官方主推支持的核心交互入口。你可以在源码检出目录中直接执行：

```bash
pnpm exec tsx packages/core/src/cliEntry.ts <command> [flags]
```

或者在执行 `pnpm build` 后，通过全局或局部安装的二进制可执行程序运行：

```bash
commander <command> [flags]
```

执行 `commander help --all` 可列出全部可用命令；执行 `commander <command> --help` 可查看指定命令的详细参数与用法。

## 命令画像 (Command Profiles)

每个 CLI 命令均归属于特定的画像（Profile）。CLI 自身仅处理本地闭环逻辑，绝不会擅自分发至 Enterprise Gateway——后者的交互入口为规范的 HTTP 端点 `POST /v1/runs`。

| 画像 Profile | 适用场景与语义 |
| --- | --- |
| `local` | 官方正式支持的本地标准运行能力 |
| `local·exp` | 实验性单次运行模型动词：`company`、`swarm`、`drive`、`goal` |

## 核心执行命令 (Core Execution)

| 命令 | 用途与说明 |
| --- | --- |
| `run <task> [flags]` | 使用完整的多智能体审议流水线执行任务 |
| `review [flags]` | AI 驱动的代码审查，输出 P0–P3 严重级别的缺陷与建议 |
| `fix [--test]` | 自动修复代码格式、Lint 警告以及 TypeScript 类型错误 |
| `company <task>` | 企业仿真引擎：智能体权能匹配 + 质量门禁 + 长期记忆 (`local·exp`) |
| `swarm <task> [flags]` | 递归蜂群调度：裂变分解 (Fission) + 聚变合并 (Fusion) (`local·exp`) |
| `drive <task> [flags]` | 自主推进循环：按步骤自动迭代推进 (`local·exp`) |
| `goal <subcommand>` | 多轮目标驱动执行：挂载独立裁判实时仲裁停止条件 (`local·exp`) |

### `goal` 子命令

| 子命令 | 用途与说明 |
| --- | --- |
| `judge <task>` | 依据已配置的停止条件对任务目标达成情况进行仲裁裁决 |
| `conditions list` | 列出全部已配置的全局停止条件 |
| `conditions set` | 新增或更新指定的停止条件 |
| `conditions delete` | 按 `--delete=<id>` 删除指定条件 |
| `conditions clear` | 清空全部停止条件 |

`conditions set` 命令支持的参数：`--add=<id>`, `--desc=<text>`, `--type=<MUST_HAVE|MUST_NOT_HAVE|MUST_MATCH|MUST_BE_ABOVE|CUSTOM>`, `--pattern=<regex>`, `--threshold=<N>`, `--custom=<prompt>`。

```bash
commander goal conditions set --add=no-ts --desc="No TS errors" --type=MUST_NOT_HAVE --pattern="error TS"
commander goal judge "Fix all TypeScript errors in src/"
```

### `run` 命令参数

| 参数 | 含义与说明 |
| --- | --- |
| `--dry-run` | 仅输出推演规划与拓扑，不进行实际文件与命令修改 |
| `--stream` | 启用 Server-Sent Events (SSE) 实时事件进度流式输出 |
| `--tui` | 启用终端交互仪表盘，展示实时智能体拓扑状态图 |
| `--mode=<mode>` | 运行模式：`balanced`（默认平衡模式）、`fast`（高速）、`thorough`（深度彻底）、`goal`（目标驱动） |
| `--provider=<name>` | 强制指定模型提供商（例如 `openai`、`anthropic`、`deepseek` 等） |
| `--budget=<tokens>` | 本次运行的 Token 预算消耗上限（默认 `100000`） |
| `--max-rounds=<n>` | 最大执行轮数，仅在 goal 模式下生效（默认 `10`） |

### `review` 代码审查参数

| 参数 | 含义与说明 |
| --- | --- |
| `--commit [sha]` | 审查特定的 Git 提交；省略 SHA 则默认审查最新一次提交 |
| `--branch` | 审查当前特性分支相对于主分支的全部变更 |
| `--base <ref>` | 指定比对基准的 Git Ref 分支或标签 |
| `--real` | 强制连接真实模型提供商；绝不回退至本地启发式规则 |
| `--provider=<name>` | 在 `--real` 模式下所调用的提供商名称 |
| `--json` | 以结构化 JSON 格式输出审查报告 |
| `--guidelines <rules>` | 注入额外审查规则（多条规则使用管道符 `|` 分隔） |

在开启 `--real` 参数时，向模型发送的 Diff 字符数上限为 15,000，模型响应截断阈值为 4,000 Token 及 8 MiB，网络传输在 120 秒后强制超时熔断。系统会自动从 `AGENTS.md`、`.review.md`、`REVIEW.md`、`.github/review.md` 以及 `.commander/review.md` 中聚合团队规范，合并上限为 1,000 字符。

### `swarm` 蜂群参数

| 参数 | 含义与说明 |
| --- | --- |
| `--max-depth=<n>` | 任务裂变分解树的最大层级深度（默认 `3`） |
| `--max-workers=<n>` | 最大并行工作节点数（默认 `10`） |
| `--mode=<balanced\|thorough\|fast>` | 任务执行策略画像 |

### `drive` 自主推进参数

| 参数 | 含义与说明 |
| --- | --- |
| `--mode=<auto\|supervised>` | 推进模式：全自动 (`auto`) 或人工半监督 (`supervised`) |
| `--iterations=<n>` | 最大迭代步数限制（默认 `20`） |
| `--verbose` | 打印各步骤推演的详细过程日志 |

## 初始化与系统配置 (Setup & Configuration)

| 命令 | 用途与说明 |
| --- | --- |
| `init [flags]` | 零配置扫描、提供商连通性探测、构建容灾回退链 → 生成 `.commander.json` |
| `quickstart` | `init` 的现代化增强别名（使用 `--check` 保留经典诊断清单） |
| `status` | 查看当前提供商连通状态、API 凭据、运行时及元学习器统计指标 |
| `config <sub>` | 配置管理：`show`、`set <key> <val>`、`list-providers`、`list-models`、`test` |
| `doctor [--offline]` | 环境体检诊断：Node.js、API Key、依赖包、Git、工作区状态及网络连通性 |
| `mode [mode]` | 查看或设置全局安全审批模式 |
| `completion [shell]` | 生成 Shell 自动补全脚本：`bash`、`zsh`、`fish`、`install` |

`init` 命令参数：`--skip-tests`（跳过网络连通性探测）、`--timeout=<ms>`（超时时间，默认 `5000`）、`--save`（持久化写入配置文件）。
`doctor` 命令参数：`--offline` / `--no-network` 跳过提供商网络测试，并将 API Key 标记为可选检查项。

### 安全审批模式 (Approval Modes)

| 模式 | 运行行为与安全拦截 |
| --- | --- |
| `plan` | 纯分析规划模式，仅生成推演方案，严禁任何代码修改与命令执行 |
| `read-only` | 只读模式，严禁所有文件写入与外部写操作 |
| `suggest` | 建议模式，在执行破坏性或高风险操作前，暂停并等待人工交互确认 |
| `auto-edit` | 允许执行大多数常规开发修改，但在检测到沙箱逃逸或越权倾向时进行拦截 |
| `full-auto` | 全自动模式，关闭一切交互式人工拦截门禁 |

## 可视化交互界面 (Interfaces)

| 命令 | 用途与说明 |
| --- | --- |
| `gui` | 启动作战指挥室前端控制台（API 服务监听 `4000` 端口，Web 前端监听 `5173`） |
| `up [task] [flags]` | 统一执行并启动本地 Web TUI 服务（默认监听端口 `4000`） |

`up` 命令参数：`--port=<n>`, `--no-open`, `--resume`。

> [!WARNING]
> `viz` 命令虽然已注册，但**当前不可用**：它尝试拉起 `packages/viz/dist/index.js`，而当前代码仓库未包含独立 `packages/viz` 工作区包，启动会导致进程退出。如需查看动态拓扑视图，请使用 `run --tui` 或访问 Web 控制台。

## 会话历史、成本与可观测性 (Observability)

| 命令 | 用途与说明 |
| --- | --- |
| `history [sub]` | 会话历史检索与管理：`view <runId>`、`delete <runId>`、`prune <keep>` |
| `cost [flags]` | Token 消耗与成本核算报告（支持 `--format=table\|json\|csv`、`--since`、`--model`、`--provider`） |
| `budget [runId]` | 按任务运行与子智能体实时检视 Token 预算消耗状况 |
| `checkpoint [runId] [flags]` | 导出 MiMo 风格的检查点快照（支持 `--prune N`） |
| `jobs [jobId] [flags]` | 异步后台任务管理：列出任务、查看日志（`--logs`）、停止任务（`--stop`） |
| `debug intent [runId]` | 智能体意图推演溯源——还原决策树与因果推理链路 |
| `diagnose [--json]` | V2 分布式技术栈健康诊断：内核、Worker 执行面、存储状态、安全水位 |

## 耐用持久化与宕机恢复 (Durability & Recovery)

| 命令 | 用途与说明 |
| --- | --- |
| `saga <sub>` | 分布式补偿事务引擎：`run`、`list`、`status`、`resume`、`approve`、`reject`、`examples` |
| `resume [runId]` | 从最近持久化成功的检查点快照中，无缝恢复崩溃中断的任务 |
| `compensation [sub]` | 逆向补偿队列管理：`status`、`list`、`retry <id>` |

`saga run` 命令参数：`--input=<json>`、`--run-id=<id>`、`--timeout=<ms>`（默认 `60000`）、`--in-memory`。
`compensation list` 命令参数：`--limit=<n>`（默认 `50`）、`--status=<pending|in_progress|escalated>`。

## 进化学习与反馈沉淀 (Learning & Feedback)

| 命令 | 用途与说明 |
| --- | --- |
| `intelligence [flags]`（别名 `i`） | 检视 Commander 已学习沉淀的知识经验：`--stats`、`--skills`、`--patterns`、`--all` |
| `experience [sub]` | 经验池管理：`status`（默认）或 `reset` 重置经验（`--skills`、`--patterns`、`--meta`、`--force`） |
| `feedback [flags]` | 提交运行反馈：`--rating=<1-5>`、`--message`、`--bug`、`--feature`；`stats` 查看聚合统计 |
| `skill <sub>` | 智能体技能沉淀管理：`list`、`view <name>`、`create <name>`、`pin`、`unpin`、`delete`、`curate` |
| `plugin <sub>` | 插件扩展生态管理：`install <source>`、`list`、`uninstall <name>`、`info <name>` |

## 自动化编排与外部集成 (Automation & Integration)

| 命令 | 用途与说明 |
| --- | --- |
| `schedule <sub>` | 定时任务调度器：`list`、`add <name> <task>`（`--cron` / `--every`）、`remove`、`enable`、`disable` |
| `workflow <sub>`（别名 `wf`） | DAG 工作流编排：`ls`、`run <id>`、`create <name>`、`schedule`、`unschedule`、`pause`、`resume`、`history`、`daemon`、`stop` |
| `webhook <sub>` | Webhook 事件触发器：`list`、`add <source> --events <list> --task <t>`、`remove <id>`、`start [--port=9876]` |
| `notify <message> [flags]` | 发送外部告警通知：`--slack`、`--discord`、`--webhook`、`--priority=<low\|normal\|high\|urgent>` |
| `action <sub>` | 命令行直接操作 Action Gateway（见下表） |
| `sandbox [status]` | 检查操作系统级沙箱支持状态、底层实现机制及隔离画像 |
| `security <sub>` | 红蓝对抗安全验证套件：`redteam`、`compliance-audit`、`adversarial-llm`、`hard-adversarial`、`unknown-adversarial` |

`action` 相关的子命令依赖环境变量 `COMMANDER_API_KEY` 以及可连通的 `COMMANDER_ACTION_GATEWAY_URL`：

| 子命令 | 用途与说明 |
| --- | --- |
| `simulate --data=<json>` | 模拟写操作变更而不真实执行（必需提供 `idempotencyKey` 幂等键） |
| `propose --data=<json>` | 提议一项受治理的写操作（必需提供 `idempotencyKey` 幂等键） |
| `get <runId>` | 查询指定 Run 的操作状态与进展 |
| `approve <runId>` \| `reject <runId>` | 记录人工对该操作的批准或拒绝决议 |
| `compensation request <runId>` \| `compensation approve <runId> <authorizationId>` | 逆向补偿请求与执行授权全流程 |
| `reconcile <runId>` | 对账并对冲异常漂移状态 |
| `evidence verify <runId>` | 获取并验签数字签名存证证据封包（若验签不通过则退出报错） |
| `kill list` \| `kill enable` \| `kill disable` | 熔断止血开关（Kill Switches）全局管理 |

传入任何未识别的命令参数将打印用法提示并退出。参数校验错误退出码为 `2`；其余执行失败退出码为 `1`。

`sandbox` 命令仅接受 `status` 子命令，用于汇报系统级沙箱可用性、检测到的底层机制（如 macOS Seatbelt、Linux bubblewrap）以及当前启用的隔离画像（`read-only`、`workspace-write`、`full-access`、`hardened`）。传入其他子命令将被拒绝。

## 全局行为与规约 (Global Behaviour)

- `--version` / `version`：打印当前版本号与当前生效的 Profile。生效 Profile 恒为 `local`；本地 CLI 绝不会自动路由至 Enterprise Gateway。
- `--help` / `help`：打印命令列表；`help --all` 输出展开的完整列表。`<command> --help` 打印单个命令的详细说明。
- 针对高消耗命令，多进程间统一实施每分钟最多 10 次大模型调用限制。超过阈值将打印限流警告并以状态码 `1` 退出。
- `COMMANDER_THEME`：设置终端高亮主题。
- 输入未知命令时，系统将以状态码 `1` 退出，并基于前缀匹配给出推荐命令提示（注意：此为前缀匹配而非模糊拼写纠错，单词中间拼写错误不会触发提示）。
- 发生异常错误时，CLI 会打印详细错误信息并建议运行 `commander doctor` 与 `commander quickstart` 进行诊断。

## 未接入 CLI 分发器的底层模块

部分在 CLI 源码包中导出的内部处理函数**并未接入中央命令分发器 (Dispatcher)**，因此未在本文档中列出且无法直接通过命令行运行：
`ask`、`diff`、`undo`、`approval-history`、`pr`、`commit`、`explain`、`test`、`refactor`、`learn` 和 `monitor`。