# Web console

> This page is synchronized from the canonical English documentation. Français navigation is available; commands and product limits are identical in every locale.

The web console is a React single-page app served by nginx. Start it one of two
ways:

| Mode | Command | URL |
| --- | --- | --- |
| Development | `pnpm gui` | `http://localhost:5173` (API on `4000`) |
| Compose | `docker compose --profile web up` | `http://localhost:3000` |

`pnpm gui` spawns two child processes from your source checkout — the API server
on port `4000` and the Vite dev server on port `5173` — then opens the browser.
It performs no database or credential checks of its own; whatever the API server
requires at startup applies. In development the API defaults to SQLite and only
warns about missing secrets. If you run it with a production environment
(`NODE_ENV=production` or `PRAETOR_ENV=production`), the API needs a durable
store plus `JWT_SECRET` and `ADMIN_PASSWORD`, and starts no SQLite fallback.

In the Compose deployment the console is served on port `3000` and nginx
reverse-proxies `/api` and `/v1` to the `api` service. Port `3001` is Grafana,
not the console.

## Routes

| Route | Page |
| --- | --- |
| `/` | Dashboard — battle report, token trends, live topology, agent roster, mission board |
| `/agents` | Agent roster |
| `/missions` | Mission board and approvals |
| `/execution` | Real-time execution feed |
| `/memory` | Memory browser and search |
| `/governance` | Approval queue and unified policy configuration |
| `/security` | Security posture (ISO 42001 / NIST AI RMF reporting, not certification) |
| `/slo` | SLO panel |
| `/chat` | Conversational interface with real-time agent streaming |
| `/dlq` | Dead letter queue management with replay |
| `/audit` | Audit log |
| `/cost` | Cost and token reporting |
| `/knowledge` | Knowledge base |
| `/alerts` | Alerts |
| `/onboarding` | First-run onboarding and provider test |
| `/users` | User administration |
| `/settings` | Settings |
| `/settings/sso` | OIDC / SSO configuration |
| `/workflows` | Workflow list and scheduling |
| `/poc` | POC / demo views |
| `/research` | Research view |
| `/actions` | Action Gateway queue — approve, reject, compensate |

## Sign-in

The console authenticates against the same API as everything else: API key or
JWT. Configure OIDC under `/settings/sso` to use single sign-on.

Data shown in the console is read from the API. Where a value is simulated or
POC-derived, the UI labels it — treat onboarding results as real only when the
API reports `source=real`.