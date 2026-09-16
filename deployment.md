# Deployment

## Supported local deployment

Copy the environment template and set the required startup credentials plus at
least one provider key, then start the local stack:

```bash
cp .env.example .env
# Required: COMMANDER_API_KEY, COMMANDER_MASTER_KEY, JWT_SECRET,
# COMMANDER_CAPABILITY_TOKEN_KEY, COMMANDER_INTEGRITY_KEY, ADMIN_PASSWORD.
# Generate each secret with `openssl rand -hex 32`.
# Also set at least one provider key (for example OPENAI_API_KEY).
docker compose up
```

`docker compose up` with no profile starts **only the API**:

- API — `http://localhost:4000`, bound to loopback (`127.0.0.1:4000:4000`)

The base stack is explicitly local: `NODE_ENV=development`,
`COMMANDER_KERNEL_ENABLED=0`, and `API_STORE_BACKEND=sqlite`. It needs no
database and starts no kernel, which is why it can boot without PostgreSQL.

The web console is behind a profile. Add it explicitly:

```bash
docker compose --profile web up
```

- Web console — `http://localhost:3000` (nginx, reverse-proxying to the API),
  also bound to loopback

The web service waits for the API to pass its health check
(`depends_on: condition: service_healthy`), so it starts in dependency order.

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

Grafana uses port `3001`. It is **not** a Commander API port. PostgreSQL and
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
Compose file marks `COMMANDER_CAPABILITY_PRIVATE_KEY_PEM`,
`COMMANDER_CAPABILITY_KEY_ID`, `COMMANDER_CAPABILITY_JWKS_JSON`,
`COMMANDER_EVIDENCE_SIGNING_PRIVATE_KEY_PEM`, and
`COMMANDER_EVIDENCE_SIGNING_KEY_ID` as required with `${VAR:?}`. It is not part
of the simple local path.

## Enterprise Gateway boundary

The `/v1` Gateway needs a PostgreSQL DSN and is alpha. Do not present it as a
complete production multi-tenant SaaS or rely on it for strict tenant-isolation
requirements without your own validation and controls.

## Production prerequisites

- Terminate TLS and set explicit CORS origins (`CORS_ORIGINS`; never `*`).
- Generate a strong `COMMANDER_API_KEY` and the other required startup secrets,
  and store provider credentials outside source control.
- Change default observability credentials before exposing any dashboard.
- Back up durable state and rehearse recovery before relying on it.
- Use the `distributed` profile when running more than one API replica.

See [Configuration](/configuration) for the environment-variable reference and
[Operations and rollback](/operations) for recovery and rollback limits.
