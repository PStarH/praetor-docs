# Packages, SDKs, and extensions

> This page is synchronized from the canonical English documentation. Español navigation is available; commands and product limits are identical in every locale.

Commander is a pnpm monorepo. This page lists what each workspace package is
for and how to consume it.

## Runtime

### `@commander/core`

The agent runtime: agent loop, orchestration and topologies, memory, security,
tools, plugins, LLM providers, and the CLI.

- Binary: `commander`
- Import: `import { Commander } from '@commander/core'`
- Subpath exports: `./runtime`, `./saga`, `./security`, `./observability`, and
  `./plugins/im/{dingtalk,feishu,wecom,slack,teams,discord}`
- Contains **18 built-in tools** and **25 LLM providers**

Built-in tools: `file`, `memory`, `web`, `browser`, `code`, `checkpoint`,
`handoff`, `exec`, `media`, `system` (the ten STRAP resource tools) plus `git`,
`verify`, `apply_patch`, `file_hash_edit`, `lsp`, `verify_answer`, `skill_view`,
`search_conversations`. Meta-tools are opt-in and not part of the 18.

### `@commander/contracts`

Versioned shared contracts: types, error codes, state machine, event envelope,
JSON schemas, and the OpenAPI V1 spec. Pure — it must not import runtime code
from core, kernel, providers, or tools.

### `@commander/kernel`

Sole authority for durable run and step lifecycle: `PostgresKernelRepository`,
`SqliteKernelRepository`, migrations, outbox publisher, reclaim/timer workers,
capability authority, and the evidence repository.

### `@commander/effect-broker`

Zero-trust broker for external writes. `EffectBroker` implements two-phase
`admit()` → `executeAdmitted()`, verifying Ed25519 capability tokens, request-hash
binding, policy decisions, quotas, worker fencing, and fail-closed durable
replay/revocation stores. Also issues capability tokens and builds signed
evidence bundles.

### `@commander/worker-plane`

The distributed worker plane and the only place a leased step executes.
Provides `PostgresWorkerRegistry` / `InMemoryWorkerRegistry`, `WorkerService`,
and pluggable step executors.

- Binary: `commander-worker`
- Requires `COMMANDER_WORKER_BOOTSTRAP` pointing at a module that exports
  `createWorkerService()`. There is no permissive dev fallback.

### `@commander/adapter-ops`

Compensation and reconciliation drain daemon, backed by the effect broker.
Health server on port `8082`.

### `@commander/postgres-runtime`

Hardened `pg.Pool` factory: requires `sslmode=verify-full`, loads a CA from
`COMMANDER_DATABASE_TLS_CA_FILE`, and pins the server SPKI SHA-256.

### `@commander/action-adapters`

External-mutation adapters (GitHub pull request, ServiceNow incident, Kubernetes
deployment rollback), an adapter registry, an environment credential provider,
and a reusable conformance suite.

### `@commander/shadow-plane`

Read-only historical policy evaluation for Shadow pilots: signed policy
manifests, NDJSON observation import, batch closure, hypothetical policy
evaluation, and signed campaign report export/verification.

- Binary: `commander-shadow`
- Commands: `manifest register`, `import`, `batch close`, `report export`,
  `report verify`, `campaign withdraw`, `retention run`, `status`

### `@commander/python-sdk`

The Python client is built from the `packages/python-sdk` workspace package and
published to PyPI as `commander-ai`.

## SDKs

### `@commander/sdk` (TypeScript)

Two clients:

- `CommanderGatewayClient` — HTTP client for the `/v1` Gateway API. No local
  runtime required. This is the current server path.
- `CommanderClient` — in-process client that dynamically imports
  `@commander/core` (peer dependency). Alpha.

Also exports `verifyActionEvidence()` for Ed25519 JWS receipts.

> The `Topology` enum exported by the SDK is **stale**. It still lists
> `SINGLE`, `SEQUENTIAL`, `PARALLEL`, `HIERARCHICAL`, `HYBRID`, `DEBATE`,
> `ENSEMBLE`, and `EVALUATOR_OPTIMIZER`, and does not include the canonical
> `CHAIN`, `DISPATCH`, `ORCHESTRATOR`, or `REVIEW` values. If you set a topology
> through the SDK, use a raw string with a canonical value and verify it against
> the server rather than trusting the enum.

### `commander-ai` (Python)

Install with `pip install commander-ai`; import as `commander`. Python ≥ 3.10.

- `CommanderGatewayClient` — reads `COMMANDER_API_URL`, defaults to
  `http://127.0.0.1:4000`. Use this one.
- `CommanderClient` / `CommanderClientSync` — legacy; does not read
  `COMMANDER_API_URL` and defaults to port `3001`, which is not an API port.
  Always pass `base_url`.

## Extensions

### `@commander/mcp-server`

Publishable MCP server that exposes Commander's Action Gateway tools over
stdin/stdout JSON-RPC.

- Binary: `commander-mcp-server`
- Exposes 8 tools: `commander_action_simulate`, `propose`, `get`, `approve`,
  `compensation_request`, `compensation_approve`, `reconcile`, `evidence`
- Fails closed without `COMMANDER_ACTION_GATEWAY_URL`
- `COMMANDER_MCP_LOCAL_RUNTIME=1` adds dev tools (`execute_agent`,
  `list_models`, `route_task`)

Client configuration:

```json
{
  "mcpServers": {
    "commander": {
      "command": "commander-mcp-server",
      "args": [],
      "env": {
        "COMMANDER_ACTION_GATEWAY_URL": "https://commander.example",
        "COMMANDER_API_KEY": "replace-with-a-scoped-key"
      }
    }
  }
}
```

### `@commander/plugin-sdk`

Plugin authoring surface. A plugin is a default export from `createPlugin`:

```typescript
import { createPlugin, defineTool, createHookSubscriptions } from '@commander/plugin-sdk';

export default createPlugin({
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  async register(api) {
    api.registerTool(
      defineTool({
        definition: { name: 'greet', description: 'Say hello', inputSchema: {} },
        execute: async () => 'hello',
      }),
    );
    createHookSubscriptions().onAgentComplete(() => {}).subscribeTo(api);
  },
});
```

Helpers `schema()`, `stringProperty()`, `numberProperty()`, and
`booleanProperty()` build JSON Schemas. Install plugins with
`commander plugin install <source>`.

### `@commander/openai-agents-mcp`

An independent process boundary that consumes the published Commander MCP server
over stdio using the public `@openai/agents` SDK. It does not import Commander
packages or call Commander internals. The deterministic mode is the CI path and
makes no model-network request; `live` mode is opt-in.

## Apps and integrations

The workspace globs are `apps/*`, `packages/*`, and `integrations/*`.

| App | Package | Purpose |
| --- | --- | --- |
| `apps/api` | `@commander/api` | Express 5 HTTP API |
| `apps/web` | `@commander/web` | React web console |

| Integration | Package | Purpose |
| --- | --- | --- |
| `integrations/openai-agents-mcp` | `@commander/openai-agents-mcp` | Consumes the published Commander MCP server over stdio |

`apps/memory/` is a data directory holding JSON memory records
(`decisions.json`, `lessons.json`, `patterns.json`, `preferences.json`,
`project-context.json`, `issues.json`, `index.json`). It is not a workspace
package and is not built or deployed.