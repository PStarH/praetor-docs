# 故障排查与诊断指南 (Troubleshooting)

遇到异常问题时，推荐首先执行 `commander doctor` 进行环境体检——该命令会自动检查本地 Node.js 版本、API Key 配置、依赖包完备性、Git 仓库状态、工作区可写性以及大模型提供商的网络连通性。追加 `--offline` 参数可跳过外部网络探测。

## 依赖安装阶段 (Installation)

### `better-sqlite3` 编译安装失败

该模块依赖宿主机的 C++ 原生构建工具链：

1. 确认当前的 Node.js 版本与仓库根目录 `.node-version` 严格一致（建议 Node.js 22.x）。
2. 在宿主机上安装 Python 3 与对应的 C++ 编译环境：
   - **macOS**：执行 `xcode-select --install`
   - **Windows**：安装 Visual Studio Build Tools（勾选 C++ 桌面开发）
   - **Linux**：通过包管理器安装 `build-essential`（如 Debian/Ubuntu 下 `sudo apt-get install build-essential`）

若因特殊容器环境限制仍无法编译，可临时切换为内存存储：`API_STORE_BACKEND=memory`。请注意：在生产环境中还必须显式声明 `COMMANDER_ALLOW_MEMORY_STORE=1`，否则 API 将遵循安全闭环原则拒绝启动。内存存储不具备任何数据持久化能力，仅限本地短期调试使用。

### `npm install` 报错 `UNMET DEPENDENCY`

请使用 **pnpm**。Commander 是严格基于 pnpm 构建的 Monorepo 工作区，使用原生 npm 或 yarn 会导致工作区间软链接解析失败。

```bash
corepack enable
pnpm install --frozen-lockfile
```

## API 服务启动异常 (Starting the API)

### API 服务拉起后立即退出 (Exit Immediately)

通常是因为缺失了必需的核心启动凭据或数据库配置。API 服务启动时会强制校验：`COMMANDER_API_KEY`、`COMMANDER_MASTER_KEY`、`JWT_SECRET`、`COMMANDER_CAPABILITY_TOKEN_KEY`、`COMMANDER_INTEGRITY_KEY`、`COMMANDER_EVIDENCE_JWKS_JSON` 以及 `ADMIN_PASSWORD`。

此外，身份认证子系统严格依赖 PostgreSQL 底座：若环境变量中未检测到 `DATABASE_URL`，API 进程将抛出 `AUTH_DATABASE_URL_REQUIRED` 并直接终止。在容器化部署中，请务必使用官方推荐的组合文件启动 PostgreSQL 与 TLS 证书栈：

```bash
docker compose -f docker-compose.yml -f docker-compose.v2.yml -f docker-compose.kernel-tls.yml --profile v2 up -d --build
```

### 生产模式下报 `StoreBackendConfigError`

表示在生产环境下既未声明 `API_STORE_BACKEND`，也未配置有效的 `DATABASE_URL`。请配置高可用的持久化数据库连接串，或显式声明 `COMMANDER_ALLOW_MEMORY_STORE=1`（仅限无状态临时容器）。

### HTTP 请求持续返回 `401 Unauthorized`

Commander API 默认对所有非白名单接口实行**默认拒绝 (Default-Deny)** 访问控制。请在请求头中携带有效认证凭据：`X-API-Key: <key>` 或 `Authorization: Bearer <key>` / `<jwt>`。在纯本地无外网开发场景下，可通过声明 `COMMANDER_ALLOW_ANON=1` 临时允许匿名调试。请注意：在生产环境下声明 `AUTH_DISABLED=true` 会故意触发 **500** 致命错误以阻断不合规暴露。

> [!NOTE]
> `COMMANDER_API_KEY` 是系统的核心启动凭据，同时也是访问 Action Gateway 的内部凭证，**并非**客户端调用 API 的入向 Key。入向调用的 API Key 均在 PostgreSQL 中加盐哈希存储并通过管理接口发放。
> 此外，`/metrics`、`/v1/health` 与 `/v1/openapi.json` 同样受鉴权中间件保护，未经认证的探测将返回 401。

如果部署在反向代理（如 Nginx、Traefik）后方，环境变量 `TRUST_PROXY_HOPS` 默认取值为 0（不信任任何代理）。若未按实际代理层数显式配置，所有请求在 API 看来均源自同一个代理 IP，会导致防暴力破解与限流机制异常触发大面积锁定。

### 调用 `/v1` 网关端点返回 `403` 或 `404`

租户 Claim 声明缺失或不匹配。请求头 `X-Tenant-ID` 仅用于一致性匹配校验，绝不能凭空扩大访问权限。为了防止通过试探响应状态码猜测资源是否存在，跨租户未授权读取在设计上统一返回 **`404`**（而非 `403`）。

### `/ready` 探针返回 `503`，但 `/health` 正常返回 200

`/ready` 会真实执行数据库连接池探测、执行内核心跳以及存证仓库读写检查。返回 `503` 说明底层基础设施存在依赖不可用。请查看响应 Body 中的 JSON 错误详情，定位具体失败的组件。

## Docker Compose 部署排错

### 容器启动时报错退出并提示 `AUTH_DATABASE_URL_REQUIRED`

基础编排文件 `docker-compose.yml` 为了轻量解耦，在设计上刻意未内置硬编码的数据库连接串。如果直接单独执行裸 `docker compose up`，API 容器会由于缺少认证数据库配置而快速失败退出。请务必结合 `v2` profile 及其编排文件启动：

```bash
docker compose -f docker-compose.yml -f docker-compose.v2.yml -f docker-compose.kernel-tls.yml --profile v2 up -d --build
```

### Compose 启动提示变量在 `.env` 中未定义

Compose 模板对关键安全密钥配置了 `${VAR:?}` 强断言（包括 `COMMANDER_EVIDENCE_JWKS_JSON` 等）。请参考 `.env.example`，将所有必需的安全凭据生成并写入 `.env` 文件后再执行启动。

## 命令行交互排错 (CLI)

### 提示 `Rate limit exceeded`

为防止意外死循环导致高昂的账单开销，CLI 命令行工具在多进程间实施了全局限流约束：每分钟最多发起 10 次大模型调用。请稍候片刻后重试。

### `commander gui` 执行失败

`gui` 命令本质上是在本地同时拉起 API 服务（端口 4000）与 Vite 开发前端（端口 5173）。执行失败通常是由于底层的 API 服务因环境问题未能成功拉起。请在同一个终端中查看前置打印的 API 错误堆栈。在生产模式下，API 需要持久化存储底座、`JWT_SECRET` 与 `ADMIN_PASSWORD`；在本地开发模式下默认回退到 SQLite。常见原因还包括端口被占用，或未在仓库根目录下执行命令。

### 工具调用被沙箱安全拦截阻断

默认情况下，Commander 在宿主机未检测到可用系统级沙箱时会遵循安全闭环原则拒绝执行高风险工具。若在可信的本地调试环境中确需放行，可声明 `COMMANDER_ALLOW_NO_SANDBOX=true`（生产环境严禁配置）。

若显式配置沙箱隔离机制，环境变量 `COMMANDER_SANDBOX_ISOLATION` 仅接受 `process`、`docker` 或 `gvisor`，且生产环境严禁使用 `process`。macOS Seatbelt 与 Linux bubblewrap 是系统底层自动嗅探的机制，不支持通过该变量手动声明。

### `commander action` 立即报错

`commander action` 命令依赖有效的 `COMMANDER_API_KEY` 以及能够正常连通的 `COMMANDER_ACTION_GATEWAY_URL`。同时请核对子命令拼写：存证验签命令应为 `action evidence verify <runId>`（而非 `action evidence <runId>`）。

## SDK 与客户端排错

### Python 客户端请求了错误的端口

推荐使用官方主推的网关客户端 `CommanderGatewayClient`，它会自动读取环境变量 `COMMANDER_API_URL`（缺省连接到 `http://127.0.0.1:4000`）。旧版遗留客户端 `CommanderClient` / `CommanderClientSync` 不会读取该环境变量，且会回退到监控端口。使用旧版客户端时请务必显式传入 `base_url` 参数，或全面迁移至 `CommanderGatewayClient`。

### TypeScript 客户端 `@commander/sdk` 提示找不到 `@commander/core`

`CommanderClient` 进程内客户端会动态导入 `@commander/core`（作为 Peer Dependency 依赖）。若在纯客户端应用中使用，请安装该前置依赖，或者直接改用无本地运行时依赖的轻量网关客户端 `CommanderGatewayClient`。

## 进一步获取支持与反馈

- 遇到常规使用疑问、优化建议或可复现的缺陷，欢迎提交 [GitHub Issue](https://github.com/PStarH/Commander/issues)。
- 若发现与权限越权、沙箱逃逸相关的安全漏洞，请通过 [GitHub 私密安全通报](https://github.com/PStarH/Commander/security/advisories/new) 渠道联系核心团队，切勿公开提交漏洞 Issue。