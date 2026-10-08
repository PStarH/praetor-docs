# 工作流编排与自动化

Praetor 提供了四种相互补充的自动化调用平面。它们彼此正交独立，底层持久化机制各有侧重，请根据实际场景审慎选型：

| 自动化平面 | CLI 对应命令 | 最佳适用场景 |
| --- | --- | --- |
| 命名工作流 (Workflows) | `commander workflow` (别名 `wf`) | 具备命名标识、可复用的多步骤有状态工作流，配备调度守护进程 |
| 周期调度器 (Scheduler) | `commander schedule` | 基于 Cron 表达式或固定时间间隔的单次轻量级周期任务 |
| 事件钩子 (Webhooks) | `commander webhook` | 由 GitHub、GitLab、Bitbucket 或自建系统触发的外部事件驱动任务 |
| 后台作业 (Background Jobs) | `commander jobs` | 检视、监控与强制终止正在后台异步执行的任务实例 |

## 命名工作流 (Workflows)

`commander workflow`（简写别名 `wf`）负责管理具名工作流及其常驻调度守护进程。

| 子命令 | 命令职责与用途 |
| --- | --- |
| `ls` | 列出系统中所有可用及已调度的具名工作流 |
| `run <id>` | 立即触发执行指定的工作流 |
| `create <name>` | 脚手架初始化新工作流；支持 `--description=` 与 `--cron=` 参数 |
| `schedule <id>` | 为工作流配置定时调度；支持 `--cron="…"` 或 `--interval="30m"` |
| `unschedule <id>` | 移除现有调度规则（别名为 `rm`） |
| `pause <id>` \| `resume <id>` | 暂停或恢复指定工作流的调度触发 |
| `history [wfId]` | 查询工作流的历史执行记录（别名为 `log`） |
| `daemon` | 在前台启动调度守护进程（别名为 `start`） |
| `stop` | 停止当前运行的调度守护进程 |

```bash
commander workflow create nightly-audit --description="每晚代码库自动安全审计" --cron="0 2 * * *"
commander workflow schedule nightly-audit --cron="0 2 * * *"
commander workflow history nightly-audit
commander workflow daemon
```

工作流同时暴露了对应的 HTTP REST API，挂载于 `/api/workflows` 路由下，涵盖标准 CRUD 及用于即时触发的 `POST /api/workflows/:id/execute`。详见 [HTTP API 接口参考](/zh/api)。

## 周期调度器 (Scheduler)

若仅需定时运行单个任务，`commander schedule` 提供了更轻量简便的选择。

| 子命令 | 命令职责与用途 |
| --- | --- |
| (缺省) \| `list` | 查看当前所有已注册的调度任务清单 |
| `add <name> <task>` | 新增调度任务，支持 `--cron="0 2 * * *"` 或 `--every="30m"` |
| `remove <id>` | 永久删除指定的调度任务 |
| `enable <id>` | 启用先前被禁用的任务 |
| `disable <id>` | 禁用指定任务（保留配置但不再触发） |

```bash
commander schedule add nightly-test "运行全量集成测试套件" --cron="0 3 * * *"
commander schedule list
commander schedule disable nightly-test
```

## 事件钩子 (Webhooks)

`commander webhook` 负责监听并响应外部系统推送的入站 HTTP Webhook 事件。

| 子命令 | 命令职责与用途 |
| --- | --- |
| (缺省) \| `list` | 列出已配置的 Webhook 触发规则 |
| `add <source> --events <list> --task <t>` | 新增触发规则。数据源来源支持：`github`、`gitlab`、`bitbucket`、`custom` |
| `remove <id>` | 移除指定的 Webhook 规则 |
| `start [--port=9876]` | 启动本地 Webhook 接收监听服务（默认端口为 `9876`） |

```bash
commander webhook add github --events=push,pull_request --task="审查新提交的变更代码 diff"
commander webhook start --port=9876
```

系统亦支持配置出站 Webhook（通知外部系统），通过 API 端点 `/api/outgoing-webhooks` 统一管理，支持完整的 CRUD、投递成功率统计与审计投递流水日志。

## 后台作业管理 (Background Jobs)

`commander jobs` 用于直观检视与干预正在后台异步运行的作业：

```bash
commander jobs                 # 列出最近的后台作业状态
commander jobs <jobId>         # 查看指定作业的详细执行参数
commander jobs <jobId> --logs  # 查看最近 50 行输出日志
commander jobs <jobId> --stop  # 优雅或强制终止运行中的作业
```

## 多通道通知通知 (Notifications)

`commander notify <message>` 支持通过多种预设通道分发运维通知：

| 参数标志 | 目标通道说明 |
| --- | --- |
| `--slack` | 发送通知至配置的 Slack 频道 |
| `--discord` | 发送通知至配置的 Discord 服务器 |
| `--webhook` | 投递自定义 HTTP Webhook 消息 |
| `--priority=<level>` | 指定紧急等级：`low` \| `normal` \| `high` \| `urgent` |

Webhook 消息投递内置指数退避重试机制，默认在 1 秒、5 秒和 15 秒后重试。

## 自动化运行的人机审批交互

通过定时调度或 Webhook 触发的自动化任务，**依然严格遵循与交互式终端完全一致的安全审批模型**。

可使用 `commander mode [mode]` 查询或动态切换当前智能体的审批模式：`plan`（只出规划）、`read-only`（只读执行）、`suggest`（提议待审）、`auto-edit`（代码自动修改）或 `full-auto`（全自主执行）。详见 [CLI 命令行参考](/zh/cli#审批运行模式)。

## 运维注意事项

- 调度守护进程 (`workflow daemon`) 默认在前台运行。在生产环境中，请务必使用 systemd、Supervisor 或容器守护运行，确保重启后能自动拉起。
- `pause` 与 `resume` 仅控制未来的调度计划，不会强行中断当前正在执行的任务实例。若要终止运行中的任务，请使用 `commander jobs <jobId> --stop`。
- 本地 CLI 的工作流、调度规则与 Webhook 配置保存在本地 Praetor 状态目录中，该存储不作为多副本共享的数据权威——详见 [运维与数据恢复](/zh/operations#数据恢复)。