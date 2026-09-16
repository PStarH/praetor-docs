# Operations and rollback

> This page is synchronized from the canonical English documentation. 简体中文 navigation is available; commands and product limits are identical in every locale.

## Health checks

Use the API health endpoints to distinguish process availability from readiness:

```bash
curl http://localhost:4000/health          # liveness — 200 or 503
curl http://localhost:4000/ready           # readiness — 200 or 503
curl http://localhost:4000/health/detailed # all components
curl http://localhost:4000/v1/health       # Gateway-narrowed readiness
curl http://localhost:4000/system/status   # runtime module summary
curl http://localhost:4000/metrics         # Prometheus
```

`/health` reports process liveness and heap pressure. `/ready` runs the
readiness probes and fails closed on database, kernel, and evidence-repository
checks.

There is no `/readyz` route anywhere. `/livez` exists in exactly one place —
**adapter-ops** — and is not an alias for `/ready`; see the table below.

Background deploy units expose their own ports:

| Unit | Port | Endpoints |
| --- | --- | --- |
| `kernel-ops` | `8081` (`COMMANDER_OPS_HEALTH_PORT`) | `/health`, `/ready` |
| `adapter-ops` | `8082` (`COMMANDER_ADAPTER_OPS_HEALTH_PORT`) | `/health`, `/ready`, `/livez` |
| `worker` | `8083` (`COMMANDER_WORKER_HEALTH_PORT`) | `/health`, `/ready` |

`8081` and `8082` are code defaults. `8083` is **not** — if
`COMMANDER_WORKER_HEALTH_PORT` is unset the worker health server is disabled
entirely. The `8083` value comes from the Compose and Helm manifests.

### What "ready" means for each unit

- **kernel-ops** `/ready` gates on the loops it owns (reclaim, timer wakeup,
  outbox publishing, and the compensation *probe*) **plus** database health.
  Compensation drain is deliberately **not** part of the predicate: draining is
  owned by adapter-ops, and gating on it produced a permanent `503` that stopped
  `helm --wait` from ever converging. Drain state is reported in the `/ready`
  body as a detail field and never changes the status code. So a probe-only
  kernel-ops instance returns **200** as long as its loops and database are
  healthy.
- **adapter-ops** `/health` and `/ready` reflect its ops-loop health. `/livez` is
  **process-only liveness** and answers `200` as long as the HTTP server is up,
  even while `/health` and `/ready` return `503`. Point Kubernetes liveness at
  `/livez` and readiness at `/ready` so a database or claim outage does not cause
  a restart storm.
- **`worker`** `/ready` reflects worker registration and step-execution health.

## Rollback

Treat configuration, provider credentials, and deployment images as a single
release unit. Before changing one, record the prior version and verify that it
can be restored. Stop a rollout when readiness fails or a consequential action
cannot be reconciled.

The tenant-authority Kubernetes path is a staged lifecycle and does **not**
support a raw `helm rollback` — that command is unsupported here. Use the
supplied cutover entrypoint, `helm:tenant-cutover`, which invokes Helm with
`--atomic --wait --wait-for-jobs --timeout 10m`. companion entrypoints include
`helm:recover-tenant-authority`, `helm:stamp-chart-content-digest`, and
`helm:adopt-database-secret`.

## Data recovery

Back up durable state before upgrades. The Compose deployment keeps state in
named volumes — `commander_state`, `commander_local_state`, `commander_traces`,
`commander_memory`, `commander_results`, plus `postgres-data`, `redis-data`, and
`adapter-ops-claim-secrets`. `commander_state` holds the event-sourcing WAL and
is the source of truth for crash recovery. Local file-backed state is not a
multi-replica authority. Recovery objectives depend on the storage topology and
operational drill; this site does not promise a universal RPO or RTO.

## Escalation

Keep an operator responsible for rollback, credential rotation, and customer
communications. For security incidents, use the private disclosure route in
`SECURITY.md`.