# 模块包、SDK 与生态扩展

Commander 采用基于 pnpm 的 Monorepo 单体多包仓库组织结构。本篇文档详细梳理各个工作区模块包的核心职责、调用方式及其架构定位。

## 核心运行时 (Runtime)

### `@commander/core`

系统的核心智能体运行时：涵盖智能体主循环、编排调度与多拓扑模式、记忆系统、安全边界体系、内置工具链、插件引擎、大模型提供商适配器以及 CLI 命令行入口。

- **命令行可执行程序**：`commander`
- **代码导入**：`import { Commander } from '@commander/core'`
- **子路径导出**：`./runtime`, `./saga`, `./security`, `./observability`，以及企业 IM 协作集成 `./plugins/im/{dingtalk,feishu,wecom,slack,teams,discord}`
- **内置资产**：开箱即用集成 **18 个内置工具** 与 **25 家大模型提供商**

**18 个内置核心工具**：涵盖 STRAP 规范定义的 10 个系统资源工具（`file`、`memory`、`web`、`browser`、`code`、`checkpoint`、`handoff`、`exec`、`media`、`system`），以及配套的工程工具（`git`、`verify`、`apply_patch`、`file_hash_edit`、`lsp`、`verify_answer`、`skill_view`、`search_conversations`）。元工具（Meta-tools）属于按需配置项，不计入上述基础 18 个工具内。

### `@commander/contracts`

版本化的底层共享契约：统一声明各模块共享的 TypeScript 类型定义、标准化错误码、有限状态机流转跃迁规则、标准事件封装信封（Event Envelope）、JSON Schema 校验契约以及 OpenAPI V1 规范。该包保持纯净（Pure），严禁导入任何来自 core、kernel、providers 或 tools 的运行时业务实现代码。

### `@commander/kernel`

分布式持久化执行内核的唯一法定权威：封装 `PostgresKernelRepository` 与 `SqliteKernelRepository`、数据库自动迁移体系、发件箱（Outbox）事件发布器、租约回收与定时唤醒工作协程、权能令牌颁发权威以及数字存证仓库。

### `@commander/effect-broker`

外部写副作用的零信任仲裁代理：`EffectBroker` 严格落地两阶段执行协议 `admit()` → `executeAdmitted()`，统一完成 Ed25519 权能令牌签名验证、请求参数密码学哈希绑定校验、策略动态决议、租户限额审计、Worker 隔离栅（Fencing Token）校验以及故障安全闭环的防重放/吊销检查。同时负责签发权能令牌与装配防篡改数字存证证据封包。

### `@commander/worker-plane`

分布式 Worker 执行面，亦是租约绑定的步骤（Leased Step）**唯一被允许执行的物理环境**。提供 `PostgresWorkerRegistry` / `InMemoryWorkerRegistry`、`WorkerService` 以及可插拔的步骤执行器。

- **命令行程序**：`commander-worker`
- **必需启动配置**：强依赖环境变量 `COMMANDER_WORKER_BOOTSTRAP` 指向导出 `createWorkerService()` 的模块入口，启动时拒绝任何宽容的未定义行为。

### `@commander/adapter-ops`

逆向补偿与对账排空的后台守护组件，依托 Effect Broker 的仲裁机制运作。提供独立的健康探针服务（监听 `8082` 端口）。

### `@commander/postgres-runtime`

安全加固的 PostgreSQL 连接池工厂类：强制要求数据库连接启用 `sslmode=verify-full`，支持从 `COMMANDER_DATABASE_TLS_CA_FILE` 读取受信任的 CA 证书，并严格比对服务端证书的 SPKI SHA-256 公钥哈希指纹。

### `@commander/action-adapters`

外部写变更适配器集成库：包括 GitHub Pull Request 提交、ServiceNow 工单创建与审批、Kubernetes Deployment 回滚等外部适配器实现，提供通用的适配器注册表、环境凭据提供者以及可复用的符合性契约测试套件。

### `@commander/shadow-plane`

专为企业 Shadow 影子评估模式设计的只读历史策略推演引擎：负责管理带数字签名的策略清单、导入 NDJSON 历史运行轨迹、执行批次封存、开展假想策略对照评估并生成带数字签名的评估报告。

- **命令行程序**：`commander-shadow`
- **支持的核心命令**：`manifest register`、`import`、`batch close`、`report export`、`report verify`、`campaign withdraw`、`retention run`、`status`

## 官方客户端开发包 (SDKs)

### `@commander/sdk` (TypeScript)

提供两套面向不同场景的客户端实现：

- `CommanderGatewayClient`：专为生产环境设计的标准 HTTP 客户端，直接对接 `/v1` 网关端点。无需在客户端引入本地运行时依赖。这是推荐的服务端集成路径。
- `CommanderClient`：进程内客户端，会动态加载 `@commander/core`（作为 Peer Dependency）。目前处于 Alpha 阶段。

该 SDK 同时导出了 `verifyActionEvidence()` 工具函数，可用于在客户端对 Ed25519 JWS 格式的操作存证收据进行本地密码学验签。

> [!NOTE]
> **拓扑命名约定**：为了保持向后兼容，`@commander/sdk` 导出的 `Topology` 枚举保留了历史字段名称。若需使用标准规范拓扑（`SINGLE`、`CHAIN`、`DISPATCH`、`ORCHESTRATOR`、`REVIEW`），建议在配置或提交任务时直接传入标准字符串字面量。

### `commander-ai` (Python)

支持 Python 3.10 及以上版本。通过 `pip install commander-ai` 安装，在代码中直接 `import commander` 导入。源码构建于 `packages/python-sdk`。

- `CommanderGatewayClient`：标准网关客户端，自动读取环境变量 `COMMANDER_API_URL`（默认连至 `http://127.0.0.1:4000`）。推荐首选。
- `CommanderClient` / `CommanderClientSync`：旧版客户端；不会读取该环境变量且会默认请求监控端口，使用时必须显式传入 `base_url`。

## 生态扩展 (Extensions)

### `@commander/mcp-server`

可独立发布的 Model Context Protocol (MCP) 标准服务端实现，通过 Stdio（标准输入输出）JSON-RPC 协议对外暴露 Commander 的 Action Gateway 治理工具。

- **命令行程序**：`commander-mcp-server`
- **对外暴露 8 个标准工具**：`commander_action_simulate`、`propose`、`get`、`approve`、`compensation_request`、`compensation_approve`、`reconcile`、`evidence`
- 在缺少 `COMMANDER_ACTION_GATEWAY_URL` 时遵循安全闭环原则直接终止退出。
- 声明 `COMMANDER_MCP_LOCAL_RUNTIME=1` 可额外启用本地开发工具（`execute_agent`、`list_models`、`route_task`）。

客户端配置示例（如 Claude Desktop）：
```json
{
  "mcpServers": {
    "commander": {
      "command": "commander-mcp-server",
      "args": [],
      "env": {
        "COMMANDER_ACTION_GATEWAY_URL": "https://commander.example",
        "COMMANDER_API_KEY": "replace-with-a-scoped-key"
      }
    }
  }
}
```

### `@commander/plugin-sdk`

官方插件开发规范 SDK。自定义插件可通过 `createPlugin` 进行标准封装导出：

```typescript
import { createPlugin, defineTool, createHookSubscriptions } from '@commander/plugin-sdk';

export default createPlugin({
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  async register(api) {
    api.registerTool(
      defineTool({
        definition: { name: 'greet', description: 'Say hello', inputSchema: {} },
        execute: async () => 'hello',
      }),
    );
    createHookSubscriptions().onAgentComplete(() => {}).subscribeTo(api);
  },
});
```

内置的辅助工具 `schema()`、`stringProperty()`、`numberProperty()` 与 `booleanProperty()` 可便捷构建 JSON Schema 描述。通过 CLI 命令 `commander plugin install <source>` 完成插件安装。

### `@commander/openai-agents-mcp`

一个保持完全独立进程边界的示例集成项目。它利用官方开源的 `@openai/agents` SDK，通过 Stdio 连接并消费 Commander MCP 服务端所暴露的受治理工具。该模块在代码中完全不导入 Commander 任何内部包或底层实现。在 CI 契约测试中采用确定性模拟模式（无任何外部模型网络调用）；可按需开启 `live` 模式与真实模型连通。

## 应用层与系统集成 (Apps & Integrations)

Monorepo 工作区规则涵盖 `apps/*`、`packages/*` 以及 `integrations/*`：

| 模块目录 | 对应包名 | 核心职责 |
| --- | --- | --- |
| `apps/api` | `@commander/api` | 基于 Express 5 的企业级 HTTP API 服务 |
| `apps/web` | `@commander/web` | 基于 React 的作战指挥室 Web 前端 |
| `integrations/openai-agents-mcp` | `@commander/openai-agents-mcp` | 通过 Stdio 消费 Commander MCP 工具的外部代理集成参考实现 |

> [!NOTE]
> 目录 `apps/memory/` 是一个静态数据目录，用于持久化本地预置的 JSON 记忆条目（`decisions.json`、`lessons.json`、`patterns.json`、`preferences.json`、`project-context.json`、`issues.json`、`index.json` 等）。它不是一个独立的 Monorepo 模块包，不会参与 npm 构建或镜像打包。