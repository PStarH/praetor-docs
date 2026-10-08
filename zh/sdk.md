# SDK 与 API 集成指南

## 核心交互形态概览 (Interfaces)

| 交互界面 | 核心入口 | 成熟度状态 | 适用定位 |
| --- | --- | --- | --- |
| 本地命令行 (Local CLI) | `praetor run <task>` | **正式支持 (Primary Supported)** | 官方主推的本地多智能体审查与执行界面 |
| 本地 HTTP API | `http://localhost:4000` | **本地正式支持** | 单机与私有化环境的 Express 5 API 接口 |
| 企业网关 `/v1` API | `POST /v1/runs` | **Alpha 预览** | 面向生产集成的 Action Gateway 端点 |
| TypeScript SDK | `@praetor/sdk` | **Alpha 预览** | 官方 TypeScript / Node.js 客户端开发包 |
| Python SDK | `praetor-ai`（代码中 `import commander`） | **Alpha 预览** | 官方 Python (≥ 3.10) 客户端开发包 |
| MCP 标准服务端 | `commander-mcp-server` | **Alpha 预览** | 基于 Stdio JSON-RPC 暴露受治理工具的标准协议服务 |

- 完整命令行手册详见 [CLI 参考手册](/zh/cli)。
- 全量端点列表与认证说明详见 [HTTP API 接口规范](/zh/api)。

## OpenAPI 规范契约导出 (OpenAPI Document)

运行中的 API 服务会在以下标准端点对外发布其 OpenAPI 3.1 契约定义：

```bash
curl http://localhost:4000/v1/openapi.json
```

在标准画像（Standard Profile）下，服务还会暴露兼容路由 `http://localhost:4000/api/openapi.json`（该路由已标记废弃，在企业企业版画像下直接返回 `410 Gone`）。请注意：系统不存在根路径 `/openapi.json`。

## TypeScript SDK 集成

`@praetor/sdk` 提供了两套客户端实现：

- `CommanderGatewayClient`：专为生产环境设计的标准 HTTP 客户端，直接对接 `/v1` 网关端点。无需在调用端引入本地运行时或数据库依赖，是推荐的服务端集成路径。
- `CommanderClient`：进程内客户端，会动态加载 `@praetor/core` 并在本地直接初始化状态与工具链（处于 Alpha 阶段）。

```typescript
import { CommanderGatewayClient } from '@praetor/sdk';

const client = new CommanderGatewayClient({
  baseUrl: process.env.PRAETOR_API_URL || 'http://127.0.0.1:4000',
  apiKey: process.env.PRAETOR_API_KEY!,
});

const result = await client.submitRun({
  goal: 'Review the proposed change',
  policySnapshotId: 'review-policy-v1',
  idempotencyKey: crypto.randomUUID(),
});
```

## Python SDK 集成

Python 官方开发包通过 PyPI 发布，支持 Python 3.10 及以上环境：
```bash
pip install praetor-ai
```

在代码中统一通过 `CommanderGatewayClient` 进行调用。该客户端会自动读取环境变量 `PRAETOR_API_URL`（缺省连接到 `http://127.0.0.1:4000`）：

```python
from commander import CommanderGatewayClient

client = CommanderGatewayClient(base_url="http://127.0.0.1:4000")
```

> [!WARNING]
> 旧版遗留客户端 `CommanderClient` / `CommanderClientSync` **不会**自动读取 `PRAETOR_API_URL`，且历史实现中默认指向了监控端口。若因历史原因必须调用旧版客户端，请务必显式传入 `base_url` 参数，或推荐全面迁移至 `CommanderGatewayClient`。

## 系统集成演进与边界 (Boundaries)

请将旧版非版本化或内部 API 视为历史兼容层，而非长期稳定的公开外部集成契约。部分产品路由虽然挂载了历史版本号别名以防破坏旧系统，但这些别名并未包含在对外公开支持的集成标准中。企业系统在对接多智能体编排与写操作治理时，请统一基于 `/v1` 标准企业网关展开集成。