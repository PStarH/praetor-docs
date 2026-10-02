# Quick start

> This page is synchronized from the canonical English documentation. 한국어 navigation is available; commands and product limits are identical in every locale.

## Prerequisites

- **Node.js 22.x** and **pnpm 9** (Corepack selects the pinned version).
- No provider credentials are needed for the first simulated demo.

Enterprise customers should start with [Shadow Phase A](https://github.com/PStarH/Commander/blob/shadow-phase-a-0.1.0-alpha.20260910/docs/pilot/shadow/README.md),
which evaluates historical observations without external actions.

## Choose your first experience

| What you want to do | Path | Credentials needed |
| --- | --- | --- |
| **Experience multi-agent deliberation & quality gates** | [1. Simulated demo](#_1-install-and-run-the-simulated-demo) | None (in-memory simulation) |
| **Review real Git diffs with LLM-as-a-judge** | [2. Provider read-only review](#_2-provider-backed-read-only-review-recommended-first-trial) | 1 API Key (OpenAI / Anthropic / DeepSeek) |
| **Test network response-loss recovery & idempotency** | [3. GitHub pilot offline tests](#_3-github-action-pilot-governed-writes-recovery) | None (mocked offline harness) |
| **Launch the visual control center** | [4. Local interfaces](#_4-local-interfaces) | None (`pnpm gui` starts local dev console) |

## 1. Install and run the simulated demo

```bash
git clone https://github.com/PStarH/Commander.git
cd Commander
corepack enable
pnpm install --frozen-lockfile
pnpm build

pnpm exec tsx packages/core/src/cliEntry.ts --help
pnpm exec tsx packages/core/src/cliEntry.ts doctor --offline
pnpm demo:l4-a
```

`doctor --offline` checks local prerequisites without contacting a provider.
`demo:l4-a` uses simulated in-memory dependencies and loopback servers: no
provider call, no external write. The clone, install, and build still write to
your checkout, dependency cache, and build output.

This path is development/demo evidence only. It is not a published-package
install, an E1 governed-write proof, or evidence of production readiness.

## 2. Provider-backed read-only review (recommended first trial)

For your first real-provider test, use the bounded read-only code review rather than general autonomous execution. The model receives no execution tools, preventing unintended commands, file edits, or external writes:

```bash
# Choose one provider explicitly
export OPENAI_API_KEY=sk-...
pnpm exec tsx packages/core/src/cliEntry.ts review \
  --commit HEAD --real --provider=openai
```

This command reads the selected Git diff and local review guidelines, sends at most 15,000 diff characters to the selected provider, and caps the response at 4,000 tokens and 8 MiB. Transport aborts after 120 seconds. Read [Security and privacy](/security) before sending repository material.

## 3. GitHub action pilot (governed writes & recovery)

To inspect the governed write lifecycle (propose → approve → inspect → recover) without external credentials, run the offline contract tests:

```bash
pnpm test:github:offline
pnpm demo:github --help
```

See the [GitHub pilot guide](https://github.com/PStarH/Commander/blob/master/docs/pilot/github/README.md) for running against a configured Enterprise Gateway.

## 4. Local interfaces

| Interface | Command | URL |
| --- | --- | --- |
| Web console (dev) | `pnpm gui` | `http://localhost:5173` (API on `4000`) |
| Web console (Compose) | `docker compose --profile web up` | `http://localhost:3000` |
| API | any of the above | `http://localhost:4000` |

`pnpm gui` starts the API and the Vite dev server from your checkout. In
development the API defaults to SQLite and only warns about missing secrets; run
it with a production environment and it instead requires a durable store plus
`JWT_SECRET` and `ADMIN_PASSWORD`.

Grafana, when the `observability` profile is enabled, uses port `3001`. It is
not a Commander API port.

## Next steps

- [CLI reference](/cli) — every command and flag.
- [HTTP API](/api) — endpoints, authentication, and the `/v1` Gateway.
- [Configuration](/configuration) — environment variables and storage backends.
- [Deployment](/deployment) for local configuration and health checks.
- [Security and privacy](/security) before connecting external systems.
- [Support and limits](/support) for the current product boundary.