# Deployment

> This page is synchronized from the canonical English documentation. 日本語 navigation is available; commands and product limits are identical in every locale.

## Supported deployment

The API server's authentication authorities (users, API keys, refresh tokens, auth failures, rate limits) are backed by PostgreSQL: `apps/api/src/authDb.ts` fails closed with `AUTH_DATABASE_URL_REQUIRED` when `DATABASE_URL` is absent. A bare `docker compose up` without PostgreSQL will fail on startup.

For a lightweight local interface without Docker or PostgreSQL, run `pnpm gui` from the source checkout (starts the API in local development mode on port `4000` with SQLite storage, and the Vite dev server on port `5173`).

### Complete V2 stack with PostgreSQL

To boot the containerized deployment with its required PostgreSQL backend, kernel, and worker plane:

```bash
cp .env.example .env
# Required credentials in .env:
# PRAETOR_API_KEY, PRAETOR_MASTER_KEY, JWT_SECRET,
# PRAETOR_CAPABILITY_TOKEN_KEY, PRAETOR_INTEGRITY_KEY, ADMIN_PASSWORD.
# Generate each secret with `openssl rand -hex 32`.
# Also set PRAETOR_EVIDENCE_JWKS_JSON (public JWKS for action evidence verification)
# and at least one provider key (for example OPENAI_API_KEY).

# Generate database TLS certificates for the verified pool:
sh deploy/docker/kernel-tls/generate-certificates.sh ./.commander/db-tls
export PRAETOR_DATABASE_TLS_HOST_DIR="$PWD/.commander/db-tls"
export PRAETOR_DATABASE_TLS_EXPECTED_SERVER_SPKI_SHA256=<printed by generator>

docker compose -f docker-compose.yml -f docker-compose.v2.yml -f docker-compose.kernel-tls.yml --profile v2 up -d --build
```

Add `--profile web` to include the web console on port `3000`:

```bash
docker compose -f docker-compose.yml -f docker-compose.v2.yml -f docker-compose.kernel-tls.yml --profile v2 --profile web up -d --build
```

The web service waits for the API to pass its health check (`depends_on: condition: service_healthy`).

Check the API after startup:

```bash
curl http://localhost:4000/health          # liveness
curl http://localhost:4000/ready           # readiness
curl http://localhost:4000/health/detailed # per-component detail
curl http://localhost:4000/v1/health       # Gateway-narrowed readiness
curl http://localhost:4000/metrics         # Prometheus
```

There is no `/readyz` or `/livez` alias.

## Optional stacks (Compose profiles)

Everything beyond the API is opt-in through profiles:

| Profile | Adds |
| --- | --- |
| `web` / `gui` | Web console on port `3000` |
| `database` | PostgreSQL |
| `worker` | `worker`, `kernel-migrate`, `kernel-ops`, `adapter-ops`, **and PostgreSQL** — the worker plane is Postgres-backed, so this profile is self-contained |
| `distributed` | Redis for cross-node EventBus fan-out |
| `observability` | Prometheus (`9090`) and Grafana (`3001`) |
| `tracing` | Jaeger (UI `16686`, OTLP HTTP `4318`, OTLP gRPC `4317`) |

Grafana uses port `3001`. It is **not** a Praetor API port. PostgreSQL and
Redis are not published on the host by default — bind loopback explicitly if
you need local tooling to reach them.

The root Compose file also defines a `v2` profile, which selects the four
worker services without PostgreSQL. For a complete V2 stack, use the dedicated
Compose file below rather than the bare `v2` profile. Two further stacks live in
separate Compose files and must be passed with `-f`:

```bash
docker compose -f docker-compose.yml -f docker-compose.v2.yml --profile v2 up -d --build
```

| File | Adds |
| --- | --- |
| `docker-compose.v2.yml` | Full V2 stack: kernel, worker plane, Postgres |
| `docker-compose.cell.yml` | Cell topology |

The worker profile needs PostgreSQL and Ed25519 capability/evidence keys — the
Compose file marks `PRAETOR_CAPABILITY_PRIVATE_KEY_PEM`,
`PRAETOR_CAPABILITY_KEY_ID`, `PRAETOR_CAPABILITY_JWKS_JSON`,
`PRAETOR_EVIDENCE_SIGNING_PRIVATE_KEY_PEM`, and
`PRAETOR_EVIDENCE_SIGNING_KEY_ID` as required with `${VAR:?}`. It is not part
of the simple local path.

## Enterprise Gateway boundary

The `/v1` Gateway needs a PostgreSQL DSN and is alpha. Do not present it as a
complete production multi-tenant SaaS or rely on it for strict tenant-isolation
requirements without your own validation and controls.

## Production prerequisites

- Terminate TLS and set explicit CORS origins (`CORS_ORIGINS`; never `*`).
- Generate a strong `PRAETOR_API_KEY` and the other required startup secrets,
  and store provider credentials outside source control.
- Change default observability credentials before exposing any dashboard.
- Back up durable state and rehearse recovery before relying on it.
- Use the `distributed` profile when running more than one API replica.

See [Configuration](/configuration) for the environment-variable reference and
[Operations and rollback](/operations) for recovery and rollback limits.