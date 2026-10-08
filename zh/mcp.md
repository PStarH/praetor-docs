# MCP (Model Context Protocol) 协议支持

Praetor 在架构设计中通过两种截然不同的方式接入并支持 MCP 协议，两者边界分明，请注意区分：

1. **`commander-mcp-server`** — 可独立发布的 **stdio 标准输入输出** 协议服务端。您可将其直接挂载至任何兼容 MCP 的智能体客户端（如 Claude Desktop、Cursor、Windsurf 等），从而将 Praetor 的受治理能力暴露给外部宿主。
2. **API 服务端的 `/mcp` HTTP 端点** — 属于管理与服务发现协议层（包含 `POST /mcp`, `/mcp/discover`, `/mcp/connect`, `/mcp/status`, `/.well-known/mcp`）。**这并非 MCP 客户端直接建立长连接的通信通道**。详见 [HTTP API 协议参考](/zh/api#协议说明)。

本页面主要聚焦于第一种形态：面向外部宿主智能体的 stdio 协议服务端。

## 安装与快速启动

```bash
npx -y @praetor/mcp-server
# 或者全局安装后直接运行：
commander-mcp-server
```

该服务端基于标准输入/输出 (stdin/stdout) 传输按行分隔的 JSON-RPC 消息，严格通过 MCP 官方规范的 `tools/list` 能力向客户端上报其支持的工具清单。

## 两种工作模式

运行模式由环境变量 `PRAETOR_MCP_LOCAL_RUNTIME` 严格决定，该变量将彻底切换所暴露的工具集结构：

### 1. 网关治理模式 (Gateway Mode - 默认推荐)

当 `PRAETOR_MCP_LOCAL_RUNTIME` **未被设置为 `1`** 时生效。该模式向外部注册 8 个标准的受治理动作工具，所有调用均通过安全通道直连 Action Gateway，确保外部一切写入变更均受到策略引擎、人工审批与不可篡改存证的强约束：

| 暴露工具标识 | 映射 Gateway 端点 |
| --- | --- |
| `commander_action_simulate` | `POST /v1/actions/simulate`（模拟执行与参数预检） |
| `commander_action_propose` | `POST /v1/actions`（提交动作意图提案） |
| `commander_action_get` | `GET /v1/actions/:runId`（查询动作执行状态） |
| `commander_action_approve` | `POST /v1/actions/:runId/approve`（人类密码学授权审批） |
| `commander_action_compensation_request` | `POST /v1/actions/:runId/compensations`（发起反向补偿申请） |
| `commander_action_compensation_approve` | `POST /v1/actions/:runId/compensations/:authorizationId/approve`（审批反向补偿） |
| `commander_action_reconcile` | `POST /v1/actions/:runId/reconcile`（触发状态对齐调和） |
| `commander_action_evidence` | `GET /v1/actions/:runId/evidence`（提取 JWS 签名存证） |

### 2. 本地运行时模式 (Local Runtime Mode)

当显式配置 `PRAETOR_MCP_LOCAL_RUNTIME=1` 时激活。此时服务端暴露出另一组用于本地研发调测的工具集合：

- **模型路由工具：** `execute_agent`、`list_models`、`route_task`。
- **Praetor 原生内置工具：** 通过 `registerCommanderTools` 动态注册的内置系统工具。

此模式专为在本机环境下进行轻量级功能研发设计，**不包含受治理执行平面的容灾与合规保障**。

## 工具安全过滤机制

在本地运行时模式下，为防止宿主智能体利用 MCP 连接恶意篡改开发者本机，系统**默认将危险工具全部过滤阻断**；除非客户端显式传递 `allowDangerousTools: true` 授权开启：

被默认过滤的工具包括：`exec`, `git`, `apply_patch`, `file`, `file_hash_edit`, `system`, `verify`, `code`, `refine_code`，以及历史别名 `shell_execute`, `file_delete`, `file_write`, `python_execute` 和 `execute_script`。

需要格外注意的是：即便客户端显式声明了允许危险工具，只要该工具涉及外部写变更，若未配置 `PRAETOR_ACTION_GATEWAY_URL`，系统依旧会直接抛出 `ACTION_GATEWAY_REQUIRED` 异常——**任何非只读的写操作严禁在纯本地无治理环境下直接执行**，必须走 `/v1/actions` 网关提议流程。

## 客户端接入配置

| 核心环境变量 | 作用说明与约束 |
| --- | --- |
| `PRAETOR_ACTION_GATEWAY_URL` | Action Gateway 服务端基地址。在企业生产模式或允许高危工具时**强制必填**，缺失将直接 Fail-closed 终止启动 |
| `PRAETOR_API_KEY` | 用于向 Gateway 进行双向身份校验的访问凭据 |
| `PRAETOR_MCP_LOCAL_RUNTIME` | 设置为 `1` 时从网关治理模式切换至本地运行时调试模式 |

主流智能体客户端（如 Claude Desktop）配置文件示例：

```json
{
  "mcpServers": {
    "commander": {
      "command": "commander-mcp-server",
      "args": [],
      "env": {
        "PRAETOR_ACTION_GATEWAY_URL": "https://commander.example",
        "PRAETOR_API_KEY": "在此填入具备合法作用域的访问密钥"
      }
    }
  }
}
```

## 进程启动命令白名单

当 Praetor 自身作为 MCP 客户端启动外部 stdio 协议子进程时，仅允许调度以下预设的基础命令：

- 默认放行的安全可执行文件：`node`、`nodejs`、`python`、`python3`、`bun`、`deno`。
- **`npx` 在任何环境下被严令禁止调用**（防止动态拉取未受控网络包）。
- `uvx` 默认禁用，仅在显式声明 `PRAETOR_MCP_ALLOW_UVX=1` 时放行。
- 可通过环境变量 `PRAETOR_MCP_ALLOWED_COMMANDS` 显式扩展白名单列表。
- 严禁携带任何用于内联动态求值与模块拦截加载的危险参数（如 `-e`、`-c`、`--eval`、`--require`、`--loader`、`--inspect*` 以及组合短参数如 `-pe`）。

API 层的 `/mcp` 服务发现路由采用了自身的**硬编码白名单**（仅限 `node`、`python` 与 `python3`），不会读取上述环境变量。

## 独立集成组件

`@praetor/openai-agents-mcp` 是一个独立的跨进程边界组件，通过官方 `@openai/agents` SDK 在 stdio 上消费已发布的 MCP 服务。该模块未引入任何 Praetor 核心内部包，完全解耦。其确定性测试模式在 CI 流程中执行，全程不向外部模型发送真实网络请求；亦支持通过配置启用 live 真实调用模式。