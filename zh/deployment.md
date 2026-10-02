# 部署指南 (Deployment)

## 官方支持的部署架构

Commander API 服务的身份认证子系统（包括用户鉴权、API Key 校验、Refresh Token 轮换、防暴力破解限制与细粒度流控）由 PostgreSQL 统一承载：`apps/api/src/authDb.ts` 遵循安全闭环原则，在检测到未声明 `DATABASE_URL` 时会直接抛出 `AUTH_DATABASE_URL_REQUIRED` 并快速失败退出。因此，直接在不包含 PostgreSQL 的裸环境下执行 `docker compose up` 无法成功启动。

如果你仅需要在无 Docker、无 PostgreSQL 的轻量化单机环境快速体验交互界面，请在源码检出目录中直接执行 `pnpm gui`（该命令将在本地开发模式下拉起 API 服务并使用本地 SQLite 存储，API 监听 `4000` 端口，Vite 前端监听 `5173` 端口）。

### 包含 PostgreSQL 的完整 V2 容器化技术栈

启动包含所需 PostgreSQL 数据库、分布式执行内核以及 Worker 执行面的标准容器化集群：

```bash
cp .env.example .env
# 在 .env 中填入必需的安全启动凭据：
# COMMANDER_API_KEY, COMMANDER_MASTER_KEY, JWT_SECRET,
# COMMANDER_CAPABILITY_TOKEN_KEY, COMMANDER_INTEGRITY_KEY, ADMIN_PASSWORD。
# 可使用命令 `openssl rand -hex 32` 生成各高强度随机密钥。
# 同时需配置 COMMANDER_EVIDENCE_JWKS_JSON（用于操作存证验签的公钥 JWKS）
# 以及至少一项大模型提供商凭据（例如 OPENAI_API_KEY）。

# 为数据库连接池生成并配置自签名 TLS 证书与公钥指纹：
sh deploy/docker/kernel-tls/generate-certificates.sh ./.commander/db-tls
export COMMANDER_DATABASE_TLS_HOST_DIR="$PWD/.commander/db-tls"
export COMMANDER_DATABASE_TLS_EXPECTED_SERVER_SPKI_SHA256=<终端生成的证书指纹>

# 启动带有数据库与内核拓扑的 V2 服务集群：
docker compose -f docker-compose.yml -f docker-compose.v2.yml -f docker-compose.kernel-tls.yml --profile v2 up -d --build
```

若需同时挂载 Web 前端管理控制台（监听宿主机 `3000` 端口），追加 `--profile web` 画像即可：

```bash
docker compose -f docker-compose.yml -f docker-compose.v2.yml -f docker-compose.kernel-tls.yml --profile v2 --profile web up -d --build
```

Web 前端服务内置了就绪感知依赖，会在 API 服务的就绪探针成功通过后才会开放流量 (`depends_on: condition: service_healthy`)。

服务集群拉起后，可通过探针端点验证运行健康状态：

```bash
curl http://localhost:4000/health          # 进程存活探针 (Liveness)
curl http://localhost:4000/ready           # 依赖就绪探针 (Readiness)
curl http://localhost:4000/health/detailed # 各组件与内核运行明细
curl http://localhost:4000/v1/health       # 网关收敛就绪校验
curl http://localhost:4000/metrics         # Prometheus 性能指标导出
```

> [!NOTE]
> Commander API 原生健康与就绪检查端点分别为 `/health` 与 `/ready`。

## 可选拓扑画像 (Compose Profiles)

除核心 API 之外，所有周边扩展组件均通过 Compose Profile 机制按需激活：

| 画像 Profile | 激活的组件与端口 |
| --- | --- |
| `web` / `gui` | Web 管理控制台前端（监听端口 `3000`） |
| `database` | PostgreSQL 关系型数据库 |
| `worker` | `worker` 节点、`kernel-migrate` 迁移器、`kernel-ops` 运维守护进程、`adapter-ops` 补偿守护进程**以及 PostgreSQL**（Worker 执行面以 Postgres 为底座，因此该画像是自包含完整的） |
| `distributed` | Redis 缓存与分布式 EventBus 事件广播总线 |
| `observability` | Prometheus（指标采集端口 `9090`）与 Grafana 监控大屏（可视化端口 `3001`） |
| `tracing` | Jaeger 链路追踪（UI 界面 `16686`、OTLP HTTP `4318`、OTLP gRPC `4317`） |

> [!WARNING]
> 请注意：Grafana 监控看板使用端口 `3001`，该端口**绝非** Commander API 的服务端口。PostgreSQL 与 Redis 默认不向宿主机公网暴露端口——如果本地开发工具需要直接连接，请显式绑定到 `127.0.0.1` 环回地址。

根目录的 `docker-compose.yml` 同样定义了简化的 `v2` profile（仅包含 4 个 worker 服务而未捆绑 Postgres 容器）。若需构建企业级完整的 V2 运行时环境，推荐使用多文件组合：

```bash
docker compose -f docker-compose.yml -f docker-compose.v2.yml --profile v2 up -d --build
```

| 编排文件 | 拓展的技术栈架构 |
| --- | --- |
| `docker-compose.v2.yml` | 完整的 V2 拓扑栈：分布式内核、Worker 执行面、PostgreSQL 存储底座 |
| `docker-compose.cell.yml` | 单元化多租户隔离架构 (Cell Topology) |

Worker 画像强依赖 PostgreSQL 以及 Ed25519 权能令牌与数字存证密钥对——Compose 模板中已针对 `COMMANDER_CAPABILITY_PRIVATE_KEY_PEM`、`COMMANDER_CAPABILITY_KEY_ID`、`COMMANDER_CAPABILITY_JWKS_JSON`、`COMMANDER_EVIDENCE_SIGNING_PRIVATE_KEY_PEM` 以及 `COMMANDER_EVIDENCE_SIGNING_KEY_ID` 配置了严格的 `${VAR:?}` 变量检查。该画像适用于自动化测试与生产级分布式演练，不建议用于最基础的单机本地首试。

## 企业网关边界与成熟度声明

挂载在 `/v1` 路径下的企业级 Action Gateway 严格依赖 PostgreSQL 数据底座，目前该特性处于 Alpha 试验阶段。在未经全面严格的企业自建评估与隔离测试之前，不应将其直接视作绝对坚固的多租户 SaaS 商业服务，亦不可在无外围安全加固的场景下直接承载跨租户强隔离业务。

## 生产环境上线前置清单 (Prerequisites)

- 在反向代理层（如 Nginx、Traefik、Cloudflare）统一完成 TLS 终结，并显式配置严格的 CORS 允许来源（配置 `CORS_ORIGINS`，严禁在生产中开放通配符 `*`）。
- 使用密码学真随机数生成强健的 `COMMANDER_API_KEY` 及其他必需启动凭据，大模型提供商的 API Key 必须通过加密密钥库或安全 KMS 注入，严禁硬编码进代码版本管理中。
- 在公网或企业内网暴露任何监控面板之前，务必修改默认的可观测性认证凭据（如 `GRAFANA_ADMIN_PASSWORD`）。
- 建立对持久化存储卷的定期冷备与容灾备份机制，并在正式承载流量前至少完成一次全流程宕机恢复演练。
- 当 API 服务部署多副本（`COMMANDER_API_REPLICAS > 1`）时，必须启用 `distributed` 画像挂载 Redis，以保障事件广播与锁的一致性。

详细的环境变量配置规范请参阅 [配置指南](/zh/configuration)，分布式故障恢复与版本回滚边界请参阅 [生产运维与故障回滚](/zh/operations)。