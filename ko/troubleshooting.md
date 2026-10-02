# Troubleshooting

> This page is synchronized from the canonical English documentation. 한국어 navigation is available; commands and product limits are identical in every locale.

Run `commander doctor` first — it checks Node, the API key, packages, git, the
workspace, and provider connectivity. Add `--offline` to skip the provider
network check.

## Install

### `better-sqlite3` fails to build

It needs a native compile step.

1. Confirm your Node version matches `.node-version` (Node 22).
2. Install Python 3 and a C++ toolchain:
   - macOS: `xcode-select --install`
   - Windows: Visual Studio Build Tools
   - Linux: `build-essential`

If it still fails, switch to an in-memory store with
`API_STORE_BACKEND=memory`. In production you must also set
`COMMANDER_ALLOW_MEMORY_STORE=1`, because the API otherwise fails closed. An
in-memory store persists nothing — use it for development only.

### `npm install` reports `UNMET DEPENDENCY`

Use pnpm. The repository is a pnpm workspace; `npm install` produces unresolved
workspace links.

```bash
corepack enable
pnpm install --frozen-lockfile
```

## Starting the API

### The API exits immediately on startup

A required startup secret or the database connection is missing. The API refuses to start without `COMMANDER_API_KEY`, `COMMANDER_MASTER_KEY`, `JWT_SECRET`, `COMMANDER_CAPABILITY_TOKEN_KEY`, `COMMANDER_INTEGRITY_KEY`, `COMMANDER_EVIDENCE_JWKS_JSON`, and `ADMIN_PASSWORD`.

Additionally, the authentication subsystem strictly requires PostgreSQL: if `DATABASE_URL` is absent, the API exits with `AUTH_DATABASE_URL_REQUIRED`. In containerized deployments, boot the PostgreSQL-backed stack using `-f docker-compose.yml -f docker-compose.v2.yml -f docker-compose.kernel-tls.yml --profile v2 up -d --build`.

### `StoreBackendConfigError` in production

Neither `API_STORE_BACKEND` nor `DATABASE_URL` is set. Configure a durable
store, or opt into the in-memory store explicitly with
`COMMANDER_ALLOW_MEMORY_STORE=1`.

### Requests return `401`

The API is default-deny. Either present a credential — `X-API-Key: <key>` or
`Authorization: Bearer <key>` / `<jwt>` — or, for local development only, set
`COMMANDER_ALLOW_ANON=1`. Note that `AUTH_DISABLED=true` returns `500` in
production by design; outside production it still requires
`COMMANDER_ALLOW_ANON=1`.

`COMMANDER_API_KEY` is a startup secret, not the inbound request key. Inbound
keys are issued into PostgreSQL.

`/metrics`, `/v1/health`, and `/v1/openapi.json` are **not** in the public path
list, so an unauthenticated scrape or probe returns `401`. Present a credential
or allow anonymous access locally.

Behind a reverse proxy, `TRUST_PROXY_HOPS` defaults to trusting no proxy. Leave
it unset and every request appears to come from the proxy, which breaks
rate-limit and lockout accounting.

### Requests return `403` or `404` under `/v1`

Tenant claims are missing or do not match. `X-Tenant-ID` may only match the
authenticated tenant — it can never widen access. Cross-tenant reads return
`404` rather than `403` so they do not confirm existence.

### `/ready` returns `503` but `/health` is fine

Readiness runs real probes. A `503` means the database, kernel, or
evidence-repository check failed. Check the response body for the failing check
name. A `kernel-ops` instance in probe-only wiring also returns `503` from
`/ready` by design.

## Docker Compose
 
### Container exits with AUTH_DATABASE_URL_REQUIRED

The base `docker-compose.yml` deliberately injects no database DSN. Running `docker compose up` by itself causes the API container to fail fast on missing auth database configuration. Always use the `v2` profile with its accompanying files to launch PostgreSQL and verified TLS:

```bash
docker compose -f docker-compose.yml -f docker-compose.v2.yml -f docker-compose.kernel-tls.yml --profile v2 up -d --build
```

### Compose asks for variables that are not in `.env`

The Compose files mark several secrets as required with `${VAR:?}`, including `COMMANDER_EVIDENCE_JWKS_JSON`. Generate each secret and populate your `.env` file before starting Compose.

## CLI

### `Rate limit exceeded`

Costly commands are limited to 10 LLM-costly invocations per minute across
processes. Wait and retry.

### `commander gui` fails

`gui` itself only spawns the API and the web dev server, so the failure is
almost always the API refusing to start. Check the API output in the same
terminal. In a production environment the API needs a durable store plus
`JWT_SECRET` and `ADMIN_PASSWORD`; in development it defaults to SQLite and only
warns, so a hard failure there usually means a missing startup secret in
production mode, a port already in use, or a missing `apps/api/src/index.ts`
(if you are not at the repository root).

### A tool call is blocked with a sandbox error

By default Commander fails closed when no OS-level sandbox is available. Set
`COMMANDER_ALLOW_NO_SANDBOX=true` only for trusted local development — it is
forbidden in production.

If you are selecting an isolation mechanism, `COMMANDER_SANDBOX_ISOLATION`
accepts **only** `process`, `docker`, or `gvisor`, and `process` is rejected in
production. Seatbelt and bwrap are auto-discovered mechanisms, not values you
can request here.

### `commander action` fails immediately

`commander action` requires both `COMMANDER_API_KEY` and a reachable
`COMMANDER_ACTION_GATEWAY_URL`. Also check the subcommand spelling: evidence is
`action evidence verify <runId>`, not `action evidence <runId>`, and there is no
`action commands` subcommand.

## SDKs

### The Python client hits the wrong port

`CommanderGatewayClient` reads `COMMANDER_API_URL` and defaults to
`http://127.0.0.1:4000`. The legacy `CommanderClient` / `CommanderClientSync`
ignores `COMMANDER_API_URL` and still defaults to port `3001`, which is not an
API port. Always pass an explicit `base_url`, or use the Gateway client.

### `@commander/sdk` in-process client cannot find `@commander/core`

`CommanderClient` dynamically imports `@commander/core`, which is a peer
dependency. Install it alongside the SDK, or use `CommanderGatewayClient`, which
needs no local runtime.

## Still stuck

Open a [GitHub issue](https://github.com/PStarH/Commander/issues) for questions, proposals, and reproducible bugs. Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/PStarH/Commander/security/advisories/new) as described in `SECURITY.md`.