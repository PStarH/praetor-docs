# Configuration

> This page is synchronized from the canonical English documentation. Français navigation is available; commands and product limits are identical in every locale.

Copy `.env.example` to `.env` and fill it in.

Where this page says a variable has a **code default**, that is the value the
application uses when the variable is unset. Where it says a **deployment
default**, the value comes from the shipped Compose or Helm manifests and the
code has no default of its own.

## Required startup credentials

| Variable | Purpose |
| --- | --- |
| `COMMANDER_API_KEY` | Required startup secret in production, and Commander's credential toward the Action Gateway. Not the inbound request key |
| `COMMANDER_MASTER_KEY` | Master key for the encrypted secrets vault. Minimum 32 characters |
| `JWT_SECRET` | HS256 signing key for access and refresh tokens. Minimum 32 characters; known public defaults are rejected. **Always required**, in every environment |
| `COMMANDER_CAPABILITY_TOKEN_KEY` | HMAC key for API-surface capability tokens |
| `COMMANDER_INTEGRITY_KEY` | HMAC key for WAL event signing. Distinct from `COMMANDER_AUDIT_CHAIN_KEY` |
| `COMMANDER_EVIDENCE_JWKS_JSON` | Public JWKS string used by the API to verify Ed25519-signed action evidence. Required by the base Compose file (`${COMMANDER_EVIDENCE_JWKS_JSON:?}`) |
| `ADMIN_PASSWORD` | Initial admin password. Minimum 16 characters; the default value is rejected |

**Enforcement differs by environment.** In production, a missing or weak value for
these aborts startup with `process.exit(1)`. Outside production, a missing value
produces a warning and startup continues — except `JWT_SECRET`, which is always
required. `ADMIN_PASSWORD` is required only in production or when
`COMMANDER_API_REPLICAS > 1`. `DATABASE_URL` (connecting as role `commander_app`)
is strictly required by the API server's auth subsystem in all environments.

Generate each secret with `openssl rand -hex 32`.

## Profile and environment

These decide which of the guards above apply, so set them deliberately.

| Variable | Default | Purpose |
| --- | --- | --- |
| `COMMANDER_PROFILE` | resolved | `enterprise` or `standard`. Explicit value **always wins**, even over production detection |
| `COMMANDER_ENV` | — | `production` or `prod` marks a production environment |
| `NODE_ENV` | — | `production` marks a production environment |

Resolution order when `COMMANDER_PROFILE` is unset: production detection
(`NODE_ENV=production` or `COMMANDER_ENV=production|prod`) resolves to
`enterprise`; otherwise `standard`.

The `enterprise` profile changes several behaviours: `/api/openapi.json` returns
`410`, legacy execution is blocked, and tenant headers cannot establish identity.

## Server

| Variable | Code default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | API listen port |
| `API_HOST` | `127.0.0.1` | Listen interface. Docker and Helm set `0.0.0.0` |
| `WEB_PORT` | `5173` | CORS allowlist and OIDC redirect origin only — never a listen port |
| `WEB_ORIGIN` | `http://localhost:$WEB_PORT` | Overrides the OIDC redirect origin |
| `CORS_ORIGINS` | localhost only | Comma-separated origins. Never `*` in production. Unset warns |
| `TRUST_PROXY_HOPS` | trust no proxy | Number of reverse-proxy hops to trust. A malformed value aborts startup. Set it behind a load balancer or rate limiting keys on the proxy IP |
| `COMMANDER_LOG_PERSIST` | `false` | Persist structured logs to SQLite |
| `COMMANDER_AUTH_PROTECT_HEALTH` | `false` | Require auth on `/health`, `/health/detailed`, `/ready`, and `/metrics` |
| `COMMANDER_API_REPLICAS` | — | Replica count. Above 1 forces `ADMIN_PASSWORD` |

**Logging levels and format.** The logger's built-in level default is `info` and
its format default is **`pretty`**. The format is read from `LOGFORMAT` (no
underscore); `LOG_FORMAT` is not read. `LOG_LEVEL` is **not wired to the
environment** in the current code — deploy manifests set `COMMANDER_LOG_LEVEL`,
which the logger also does not read. To control log verbosity today you must set
it programmatically.

Log persistence degrades under backpressure: once the queue exceeds 10,000
entries, `debug` and `info` are dropped while `warn`, `error`, and `critical` are
retained; at twice the threshold the oldest entries are also dropped.

## Rate limiting

The window is fixed at 60 seconds.

| Variable | Default | Purpose |
| --- | --- | --- |
| `API_RATE_LIMIT` | `120` | Requests per window, default for every scope |
| `API_RATE_LIMIT_USER` | `API_RATE_LIMIT` | Per-user limit |
| `API_RATE_LIMIT_TENANT` | `API_RATE_LIMIT` | Per-tenant limit |
| `AUTH_MAX_FAILURES` | `5` | Failed auth attempts before IP lockout |
| `AUTH_LOCKOUT_MS` | `300000` | Lockout duration (5 minutes) |

Tier multipliers are applied on top: health endpoints ×10, reads ×1, writes
×0.25.

The CLI separately limits costly commands to 10 LLM-costly invocations per
minute across processes.

## Providers

Set at least one provider key. Commander detects which provider you configured.
See [Providers](/providers) for the full list of 25 and the exact variable for
each — several are not what you would guess (Cohere uses `CO_API_KEY`, GLM uses
`ZHIPU_API_KEY`, Replicate uses `REPLICATE_API_TOKEN`).

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, … | Provider credentials |
| `OPENAI_BASE_URL`, `OPENAI_MODEL` | Override endpoint and model |
| `AZURE_OPENAI_BASE_URL`, `AZURE_OPENAI_MODEL`, `AZURE_OPENAI_API_VERSION` | Azure OpenAI |
| `OLLAMA_HOST`, `VLLM_BASE_URL` | Local / self-hosted providers |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | AWS Bedrock |
| `COMMANDER_MIN_SENSITIVE_MODEL_TIER` | Model-tier floor for sensitive steps: `eco` \| `standard` \| `power` \| `consensus` (default `standard`) |

Adding a provider is one step: append a `registerProvider()` call in
`packages/core/src/runtime/providers/providerRegistry.ts`. The registry derives
the order, env map, default URLs, default models, display names, and API type
automatically.

## Storage

| Variable | Default | Purpose |
| --- | --- | --- |
| `API_STORE_BACKEND` | `sqlite` | `sqlite` \| `memory` \| `postgres` |
| `DATABASE_URL` | — | PostgreSQL DSN; implies the `postgres` backend when `API_STORE_BACKEND` is unset |
| `COMMANDER_KERNEL_ENABLED` | **auto** | Enable the Postgres-backed shared execution kernel |
| `COMMANDER_KERNEL_DATABASE_URL` | `DATABASE_URL` | Kernel DSN |
| `COMMANDER_EVENT_SOURCING_WAL` | `.commander_state/event-sourcing.wal` | WAL path for deterministic replay |
| `COMMANDER_ALLOW_MEMORY_STORE` | — | Explicit opt-in for in-memory stores in production |

`COMMANDER_KERNEL_ENABLED` is **not** off by default. It is enabled
automatically when `NODE_ENV=production`, when `COMMANDER_V2_MODE=1`, or when a
kernel DSN is present. An explicit `0` or `1` overrides that — and production
refuses an explicit `0`.

In production the API fails closed (`StoreBackendConfigError`) when neither
`API_STORE_BACKEND` nor `DATABASE_URL` is set. Local state lives under
`.commander_state/`; `commander_state` holds the WAL and is the source of truth
for crash recovery.

## Multi-tenancy

| Variable | Default | Purpose |
| --- | --- | --- |
| `TENANT_CONFIG_PATH` | — | Path to the tenant config file |
| `COMMANDER_DEFAULT_TENANT_ID` | `local` | Default tenant claim |

Tenant mode is selected by the **presence of `TENANT_CONFIG_PATH`**: unset or
missing file gives the null (single-tenant) provider; a readable file gives the
simple static provider. `TENANT_PROVIDER` is not read by the application — it
only appears in the Helm chart, which passes it through.

## Event bus and observability

| Variable | Default | Purpose |
| --- | --- | --- |
| `COMMANDER_EVENT_BUS_BACKEND` | `memory` | `memory` or `redis` |
| `COMMANDER_EVENT_BUS_REDIS_URL` | none | Redis URL. `redis://redis:6379` is a **Compose default**, not a code default |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | OTLP collector endpoint (e.g. `http://jaeger:4318`) |
| `COMMANDER_OTEL_ENABLED` | enabled | Set to `false` to disable the OTLP exporter |
| `COMMANDER_AUDIT_CHAIN_KEY` | — | Enables HMAC hash-chaining of the security audit log. Opt-in |
| `COMMANDER_AUDIT_MANIFEST_DIR` | — | Enables the RSA-PSS L2 audit manifest. Opt-in |
| `GRAFANA_ADMIN_PASSWORD` | `admin` | Deployment-only. Change before exposing a dashboard |

## Worker plane

| Variable | Purpose |
| --- | --- |
| `COMMANDER_WORKER_BOOTSTRAP` | Module path exporting `createWorkerService()`. Required — there is no permissive fallback |
| `COMMANDER_WORKER_AUTH_TOKEN` | Worker registration identity. **Required by bootstrap**, not merely optional |
| `COMMANDER_WORKER_AUTH_SUBJECT` | Default `worker:<workerId>` |
| `COMMANDER_WORKER_CAPABILITIES` | Code default `agent`; Compose and Helm set `agent,tool,connector` |
| `COMMANDER_WORKER_TENANTS` | Explicit tenant allowlist. `*` and empty are rejected at bootstrap |
| `COMMANDER_WORKER_MAX_CONCURRENCY` | Concurrent step executions per worker (default `10`) |
| `COMMANDER_WORKER_LEASE_TTL_MS` | Lease duration (default `30000`) |
| `COMMANDER_WORKER_HEARTBEAT_MS` | Heartbeat interval (default `10000`) |
| `COMMANDER_WORKER_POLL_MS` | Poll interval (default `250`) |
| `COMMANDER_WORKER_ID` | Default `worker-<8 hex>` |
| `COMMANDER_WORKER_KIND` | Default `agent` |
| `COMMANDER_OPS_HEALTH_PORT` | `kernel-ops` health port (default `8081`) |
| `COMMANDER_ADAPTER_OPS_HEALTH_PORT` | `adapter-ops` health port (default `8082`) |
| `COMMANDER_WORKER_HEALTH_PORT` | `worker` health port. **No code default — unset disables the health server.** `8083` is a Compose/Helm default |
| `COMMANDER_EFFECT_BROKER_SEED` | Effect broker seed material |

Worker and adapter-ops authority uses Ed25519 PEM/JWKS/key-id
(`COMMANDER_CAPABILITY_PRIVATE_KEY_PEM`, `COMMANDER_CAPABILITY_KEY_ID`,
`COMMANDER_CAPABILITY_JWKS_JSON`, `COMMANDER_EVIDENCE_SIGNING_PRIVATE_KEY_PEM`,
`COMMANDER_EVIDENCE_SIGNING_KEY_ID`) — never the HMAC env used by the API
surface. See [Security and privacy](/security#capability-tokens).

## Sandbox and safety

| Variable | Default | Purpose |
| --- | --- | --- |
| `COMMANDER_ALLOW_NO_SANDBOX` | `false` | Fail closed when no OS-level sandbox is available. Forbidden in production |
| `COMMANDER_SANDBOX_ISOLATION` | `docker` in prod/staging, `process` otherwise | Only `process`, `docker`, or `gvisor`. `process` is rejected in production |
| `COMMANDER_SANDBOX_MODE` | — | Selects a sandbox profile. Can never select `full-access` |
| `COMMANDER_MCP_ALLOWED_COMMANDS` | see below | Extra allowed base commands for MCP stdio servers |
| `COMMANDER_MCP_ALLOW_UVX` | unset | Allows `uvx`. Not in the default allowlist despite what `.env.example` says |

The core MCP client allows `node`, `nodejs`, `python`, `python3`, `bun`, and
`deno` by default. **`npx` is always forbidden** and `uvx` requires
`COMMANDER_MCP_ALLOW_UVX=1`. The API `/mcp` discovery path uses a separate
hardcoded allowlist of `node`, `python`, and `python3`, and does **not** read
`COMMANDER_MCP_ALLOWED_COMMANDS`.

## Execution mode and legacy surfaces

| Variable | Default | Purpose |
| --- | --- | --- |
| `COMMANDER_LEGACY_EXECUTION` | unset | Set to `1` to allow legacy `/api/runs` and `/api/orchestrator` |
| `COMMANDER_V2_MODE` | unset | Forces the V2 kernel on and disables legacy execution |
| `COMMANDER_V2_BENCH_HARNESS` | unset | Mounts the `/v2` benchmark routes. Never enable in production |
| `COMMANDER_ALLOW_ANON` | unset | Allows anonymous API access. Default is deny |
| `AUTH_DISABLED` | unset | Returns **500** in production by design; outside production still requires `COMMANDER_ALLOW_ANON=1` |

Legacy execution requires **all** of: `COMMANDER_LEGACY_EXECUTION=1`,
`NODE_ENV` not `production`, `COMMANDER_V2_MODE` not `1`, and a non-enterprise
profile. Otherwise `/api/runs` returns `410 LEGACY_EXECUTION_GONE` and
`/api/orchestrator` is not mounted at all.

## Action Gateway and protocols

| Variable | Purpose |
| --- | --- |
| `COMMANDER_ACTION_GATEWAY_URL` | Gateway base URL. Required in production and enterprise MCP mode, and required by `commander action` |
| `COMMANDER_A2A_AUTH_TOKEN` | A2A bearer token, minimum 16 characters. Missing it returns 500 |

## OIDC

| Variable | Default | Purpose |
| --- | --- | --- |
| `OIDC_ENABLED` | persisted config | Enable or disable OIDC |
| `OIDC_ISSUER` | — | Issuer URL. Must be HTTPS |
| `OIDC_CLIENT_ID` | — | Client identifier |
| `OIDC_ROLE_CLAIM` | `roles` | Claim carrying roles |
| `OIDC_ADMIN_ROLES` | `['admin']` | Roles mapped to admin |
| `OIDC_OPERATOR_ROLES` | `['operator','developer']` | Roles mapped to operator |
| `OIDC_TENANT_CLAIM` | `tenant_id` | Claim carrying the tenant |
| `OIDC_DEFAULT_TENANT_ID` | — | Fallback tenant |
| `OIDC_ISSUER_HOST_ALLOWLIST` | — | Optional issuer host restriction |

Configuration is persisted at `.commander/oidc-config.json`. Linking an OIDC
identity to a local user by email requires `email_verified` to be true.

## Database TLS

| Variable | Purpose |
| --- | --- |
| `COMMANDER_DATABASE_TLS_CA_FILE` | CA bundle |
| `COMMANDER_DATABASE_TLS_EXPECTED_SERVER_SPKI_SHA256` | Pinned server SPKI SHA-256 (64 hex chars) |

The Postgres DSN must carry exactly `sslmode=verify-full`. Any other `ssl*`
parameter is rejected, `rejectUnauthorized` is forced on, and both the CA file
and the SPKI pin are required.