# 生产运维与故障回滚 (Operations & Rollback)

## 生产健康检查与探针体系 (Health Checks)

在生产环境中，应合理配置探针以准确区分**进程存活 (Liveness)** 与**业务依赖就绪 (Readiness)**：

```bash
curl http://localhost:4000/health          # 存活探针：汇报进程可用性与堆内存压力（返回 200 或 503）
curl http://localhost:4000/ready           # 就绪探针：真实检测数据库、执行内核与存储后端（返回 200 或 503）
curl http://localhost:4000/health/detailed # 全量组件与子系统状态透视
curl http://localhost:4000/v1/health       # 网关收敛就绪校验
curl http://localhost:4000/system/status   # 运行时已加载模块与系统状态摘要
curl http://localhost:4000/metrics         # Prometheus / OpenMetrics 监控指标
```

`/health` 仅探测进程生命周期存活与堆内存是否健康；`/ready` 则会真实执行全套探针，当检测到数据库连接池异常、分布式内核失联或存证仓库不可写时，遵循安全闭环原则直接返回 `503`。

> [!NOTE]
> Commander API 服务的标准就绪探针为 `/ready`。分布式运维组件的探针端口定义如下表所示。

分布式后台守护组件分别暴露了独立的探针服务端口：

| 运维组件 | 监听端口 | 暴露的端点 |
| --- | --- | --- |
| `kernel-ops` | `8081` (`COMMANDER_OPS_HEALTH_PORT`) | `/health`, `/ready` |
| `adapter-ops` | `8082` (`COMMANDER_ADAPTER_OPS_HEALTH_PORT`) | `/health`, `/ready`, `/livez` |
| `worker` | `8083` (`COMMANDER_WORKER_HEALTH_PORT`) | `/health`, `/ready` |

`8081` 与 `8082` 在代码中包含默认值；而 `8083` **没有代码默认值**——若环境变量 `COMMANDER_WORKER_HEALTH_PORT` 未声明，Worker 节点将彻底关闭健康检查服务（该端口值由官方 Compose 和 Helm 模板显式注入）。

### 各运维组件的“就绪 (Ready)”语义判定标准

- **kernel-ops**：其 `/ready` 探针严格守护其自身所持有的后台核心循环（包括租约回收 Reclaim、定时唤醒 Timer Wakeup、发件箱消息推送 Outbox Publishing 以及逆向补偿探测 Compensation Probe），**同时**挂钩数据库连通性。请注意：补偿消费排空（Compensation Drain）在设计上**未**作为就绪判定的阻塞条件——由于排空逻辑由 `adapter-ops` 独立承担，如果将其纳入 `kernel-ops` 的就绪检查，会导致容器因历史积压而长期处于 `503`，进而使 `helm --wait` 永远无法收敛就绪。因此，排空状态仅作为响应体中的观察字段输出；只要核心循环与数据库健康，探针即返回 **200**。
- **adapter-ops**：其 `/health` 与 `/ready` 真实反映了补偿运维循环的健康度；而 `/livez` 则表示**仅代表进程本身存活**的端点，只要底层 HTTP 服务未崩溃即响应 `200`（即使 `/health` 与 `/ready` 返回 `503`）。在 Kubernetes 部署中，强烈建议将 Liveness 探针指向 `/livez`，而将 Readiness 探针指向 `/ready`，这样即便在数据库抖动或索赔排队期间，也不会诱发 Pod 级联重启风暴。
- **worker**：其 `/ready` 探针直接反映 Worker 节点在注册表中的心跳活跃度以及步骤执行流水线的承载状态。

## 安全回滚机制 (Rollback)

在工程实践中，应将系统配置、模型提供商凭据以及容器镜像作为一个原子的**版本发布单元**对待。在执行任何变更前，必须记录上一稳定版本的快照并预先验证其可恢复性。一旦就绪探针失败或关键的受治理写操作无法在预期时间内对账，应立即中止发布流程。

在涉及租户权威管理的 Kubernetes 集群中，整体生命周期采用了分阶段编排，因此**不支持**直接执行原生的 `helm rollback`（在此拓扑下该命令不被支持）。请使用官方提供的原子切割入口：
```bash
helm:tenant-cutover
```
该入口内部封装了 Helm 核心参数 `--atomic --wait --wait-for-jobs --timeout 10m`。官方提供的相关配套运维入口还包括：`helm:recover-tenant-authority`、`helm:stamp-chart-content-digest` 以及 `helm:adopt-database-secret`。

## 数据耐用性与灾难恢复 (Data Recovery)

在执行任何版本升级或架构迁移前，务必对持久化状态进行完整冷备。基于 Compose 启动的集群将关键数据持久化于命名卷中：
- `commander_state`：保存事件溯源 (Event Sourcing) 的核心 WAL 预写日志，是单节点宕机崩溃恢复与确定性回放的**唯一真实数据源 (Source of Truth)**。
- `commander_local_state`、`commander_traces`、`commander_memory`、`commander_results`：本地运行时文件缓存与链路跟踪日志。
- `postgres-data`、`redis-data`、`adapter-ops-claim-secrets`：数据库持久化卷、分布式总线状态及索赔凭据安全卷。

请注意：本地单机文件存储无法作为多副本强一致性的仲裁依据。实际生产环境中的恢复时间目标 (RTO) 与恢复点目标 (RPO) 取决于所采用的数据库备份拓扑与运维演练频次，官方文档不作无条件的通用 RTO/RPO 承诺。

## 应急响应与故障升级 (Escalation)

企业团队应指定明确的专职运维工程师，统筹负责版本回滚、密钥凭据轮换以及内部/外部沟通。若发现潜在的安全漏洞或提权隐患，请严格遵循仓库 `SECURITY.md` 中约定的私密披露渠道提交，切勿通过公开渠道公开漏洞细节。