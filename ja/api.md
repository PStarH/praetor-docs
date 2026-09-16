# HTTP API

> This page is synchronized from the canonical English documentation. 日本語 navigation is available; commands and product limits are identical in every locale.

The API is an Express 5 server. It listens on `PORT` (default `4000`) and binds
`API_HOST` (default `127.0.0.1`; Docker and Helm set `0.0.0.0`).

`WEB_PORT` (default `5173`) is used only for the CORS allowlist and the OIDC
redirect origin — it is not a server port.

## Service endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness: status, uptime, memory, version. `200` / `503` |
| `GET` | `/ready` | Readiness probes: database, kernel, stores. `200` / `503` |
| `GET` | `/v1/health` | Gateway-narrowed readiness (`kernel`, `evidenceRepository`) |
| `GET` | `/health/detailed` | Component and module detail |
| `GET` | `/metrics` | Prometheus / OpenMetrics text |
| `GET` | `/system/status` | Uptime, memory, module map |
| `GET` | `/v1/openapi.json` | OpenAPI 3.1 document (canonical) |
| `GET` | `/api/openapi.json` | Standard-profile alias; deprecated, `410` in enterprise |

There is no `/readyz` or `/livez` route.

## Authentication

| Mechanism | How |
| --- | --- |
| API key | `X-API-Key: <key>` or `Authorization: Bearer <key>`. Keys are `cmdr_`-prefixed, SHA-256-hashed, and stored in PostgreSQL |
| JWT | `Authorization: Bearer <jwt>`. HS256 signed with `JWT_SECRET`; access tokens 24h, refresh 7d |
| OIDC | `OIDC_*` configuration; config persisted at `.commander/oidc-config.json` |
| SCIM | Requires JWT role `admin`/`super_admin`, or an API-key scope of `scim`/`admin`/`*` |
| A2A | `COMMANDER_A2A_AUTH_TOKEN` bearer, minimum 16 characters |

`COMMANDER_API_KEY` is a **required startup secret** and Commander's own
credential toward the Action Gateway — it is not the inbound key store.

`X-Tenant-ID` is accepted but never authoritative: it may only match the
authenticated tenant, never widen it.

Public (unauthenticated) paths: `/health`, `/health/detailed`, `/ready`,
`/system/status`, `/api/openapi.json`, `/a2a/.well-known/agent-card`,
`/mcp/.well-known/mcp`, and the `/api/auth/{login,register,refresh,logout}`
family. Everything else is default-deny: anonymous access requires an explicit
`COMMANDER_ALLOW_ANON=1`.

Note that **`/metrics`, `/v1/health`, and `/v1/openapi.json` are not in that
public list**. They are exempted by the JWT and tenant layers, but the API's
default-deny auth middleware still requires a credential for them. If you scrape
`/metrics` or probe `/v1/health`, either present a credential or set
`COMMANDER_ALLOW_ANON=1`.

## Gateway `/v1` (alpha)

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/v1/runs` | Submit a run |
| `GET` | `/v1/runs/:runId` | Run detail |
| `GET` | `/v1/runs/:runId/events` | Run event stream |
| `GET` | `/v1/runs/:runId/status` | Run status |
| `POST` | `/v1/runs/:runId/pause` \| `/resume` \| `/cancel` | Run control |
| `POST` | `/v1/privacy/erasure` | Erasure request |

### Governed actions

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/v1/actions/kill-switches` | List kill switches |
| `PUT` / `DELETE` | `/v1/actions/kill-switches/:scope/:value` | Set / clear a kill switch |
| `POST` | `/v1/actions/simulate` | Simulate without executing |
| `POST` | `/v1/actions` | Propose an action |
| `GET` | `/v1/actions/:runId` | Action state for a run |
| `GET` | `/v1/actions/:runId/evidence` | Signed evidence bundle |
| `POST` | `/v1/actions/:runId/approve` \| `/reject` | Decision |
| `POST` | `/v1/actions/:runId/compensations` | Request compensation |
| `POST` | `/v1/actions/:runId/compensations/:authorizationId/approve` | Approve compensation |
| `POST` | `/v1/actions/:runId/reconcile` | Reconcile |

### Read-only projects

`/v1/projects` exposes GET-only project views (agents, agent state, war room,
run context, memory, memory search, governance stats/alerts/weekly report).
Write routes are compiled out and return `404`.

## Product API families

All families below are mounted under `/api` unless noted.

| Family | Base | Covers |
| --- | --- | --- |
| Auth and users | `/api/auth` | Register, login, refresh, logout, `me`, user CRUD, roles, password reset |
| OIDC | `/api/auth/oidc` | SSO config, code exchange, settings |
| Projects | `/projects` | Project views, agents, missions, war room, memory, governance |
| Missions and logs | `/projects/:projectId/missions` | Create, approve, mission logs |
| Memory index | `/projects/:projectId/memory-index` | Domains, entries, reconcile |
| Namespaced memory | `/api/namespaced-memory` | Namespaced write/read/search/stats/audit, ACL |
| Conflict detection | `/projects/:projectId/conflict-detection` | Proactive and reactive conflict scans, summary |
| Confidence | `/projects/.../confidence`, `/api/confidence/thresholds` | Confidence reports and alerts |
| Quality | `/api/quality`, `/api/consistency` | Hallucination checks, consistency records |
| Hallucination / lineage | `/api/hallucination`, `/api/lineage` | Per-run risk and lineage trees |
| Security | `/api/security` | Content scans, memory poisoning detection, credibility, posture, history |
| Pipeline and state machine | `/api/pipeline`, `/api/state-machine` | Pipeline execution, machine transitions, approvals |
| Workflows | `/api/workflows` | CRUD plus `POST /api/workflows/:id/execute` |
| Cost | `/api/cost` | Summary, records, budget, dashboard |
| Replay | `/api/replay` | Runs, run detail, events, checkpoint |
| Teams | `/api/teams` | Run status, work, agents, reassign |
| Dead letter queue | `/api/dlq` | Stats, categories, entries, replay |
| Approvals | `/api/approval` | Config, audit log, sandbox mode, policy patterns |
| Knowledge | `/api/knowledge`, `/api/knowledge-base` | Documents, search, query, upload, enable/disable |
| Saga | `/api/saga` | Runs, run detail, timeline, SSE stream (`/api/saga/stream/:runId`) |
| Evaluation | `/api/eval`, `/api/evaluation` | Datasets, judge, A/B compare, Wilcoxon, criteria, trends, `grade`, `pass-at-k` |
| Agent self-assessment | `/api/agents/:agentId` | `self-assess`, `self-model` |
| Agent cards | `/api/agent-cards` | List, fetch by id, create |
| Reasoning config | `/api/reasoning` | `select-mode`, `confidence-action` |
| Reporting | `/api/reporting` | Status, enable/disable, render |
| Consensus | `/api/consensus` | Topology, BPD detection, reputation, stopping |
| Audit | `/api/audit`, `/api/audit-logs` | Logs, export, stats, sources, categories |
| Governance | `/api/governance` | Checkpoints, approvals, expirations, risk score |
| Onboarding | `/api/onboarding` | Status, sample tasks, provider test, save config, first task |
| Settings | `/api/settings` | Read and update settings |
| API keys | `/api/admin/api-keys` | List, create, revoke |
| Outgoing webhooks | `/api/outgoing-webhooks` | CRUD, stats, deliveries |
| Streaming | `/projects/:projectId/events`, `/events`, `/api/messages/stream` | SSE event streams |
| Observability | `/api/v1/observability` | Runs, timeline, tree, cost, decisions, agents, tools, SLOs, search, replay, feedback |
| Cost dashboard | `/api/cost/dashboard` | Dashboard-shaped cost and token views |

### Versioned aliases

Some product families are mounted a second time under a legacy versioned prefix
for backward compatibility. Those aliases are **not** a documented integration
surface and are deliberately not enumerated here. Build against the `/api` form
for product routes and against `/v1` (with no `/api` prefix) for the Gateway.

## Protocols

| Mount | Protocol |
| --- | --- |
| `/a2a` | Agent-to-Agent: agent cards, tasks, artifacts. `/.well-known/agent-card` is public; the rest requires auth |
| `/a2a/v2` | A2A v2 with `/.well-known/agent-card.json`, plus `POST /` and `POST /stream` |
| `/mcp` | Model Context Protocol: `POST /` JSON-RPC, `/.well-known/mcp`, `/status`, `/discover`, `/connect` |
| `/mcp/client` | Client-side MCP connect endpoint |
| `/scim/v2` | SCIM 2.0 provisioning for Users and Groups |

The `/mcp` HTTP endpoint is a management and discovery surface. To expose
Commander tools to an MCP *client*, run the `commander-mcp-server` stdio
process instead — see [MCP](/mcp).

## Removed and gated routes

Legacy execution is allowed only when **all** four conditions hold:

1. `COMMANDER_LEGACY_EXECUTION=1`
2. `NODE_ENV` is not `production`
3. `COMMANDER_V2_MODE` is not `1`
4. the resolved profile is not `enterprise`

If any condition fails, every surface below is unavailable.

- `POST`-style execution under `/api/runs` is gone: it returns **`410
  LEGACY_EXECUTION_GONE`** unless legacy execution is allowed.
- `/api/orchestrator` (`execute`, `deliberate`, `stream`) is legacy-gated: the
  router is **not mounted at all** unless legacy execution is allowed, so it
  returns `404` rather than `410`. When mounted it still self-guards with `410
  LEGACY_EXECUTION_DISABLED`. It is not an integration surface.
- `/api/state-machine` and `/api/pipeline` are always mounted, but a
  router-level guard returns `410 LEGACY_EXECUTION_DISABLED` unless legacy
  execution is allowed. `POST /:taskId/approve` and `/reject` are exempt so that
  authentication fails before the legacy check.
- `/v2` bench routes (`/v2/runs`, `/v2/runs/batch`, `/v2/runs/status`,
  `/v2/effects`, `/v2/bench/anomalies`) are a benchmark harness. They are
  mounted only when `COMMANDER_V2_BENCH_HARNESS=1` and must not be enabled in a
  production topology.
- The orchestrator is also mounted under a legacy versioned prefix. That alias
  is not a documented integration surface — use `/v1/*` instead.

### Routers that are never mounted

`createChatRouter` and `createWebhookRouter` exist in the codebase but are
exercised only by tests. `/api/chat` and `/api/webhook/*` are **not** on the
running server. Do not build against them.

## Discovery

The OpenAPI document is generated from the registered routers, so the
top-level `app.get` routes (`/health`, `/ready`, `/metrics`, `/system/status`,
`/health/detailed`, `/api/openapi.json`) are not present in it. Treat the
document as the router-level contract, not an exhaustive list.