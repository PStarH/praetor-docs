# MCP (Model Context Protocol)

> This page is synchronized from the canonical English documentation. 日本語 navigation is available; commands and product limits are identical in every locale.

Praetor participates in MCP in two different ways, and it is easy to confuse
them:

1. **`commander-mcp-server`** — a publishable **stdio** server you run alongside
   an MCP client (Claude Desktop, Cursor, and similar). This is how you expose
   Praetor to an external agent.
2. **The `/mcp` HTTP endpoints on the API** — a management and discovery surface
   (`POST /mcp`, `/mcp/discover`, `/mcp/connect`, `/mcp/status`,
   `/.well-known/mcp`). This is **not** the transport an MCP client uses. See
   [HTTP API](/api#protocols).

This page covers the stdio server.

## Install and run

```bash
npx -y @praetor/mcp-server
# or, after install:
commander-mcp-server
```

The server speaks line-delimited JSON-RPC over stdin/stdout. It reports its
tools through the standard MCP `tools/list` capability.

## Two operating modes

The mode is chosen by `PRAETOR_MCP_LOCAL_RUNTIME`, and it changes the tool set
entirely — it is not an additive flag.

### Gateway mode (default)

Used when `PRAETOR_MCP_LOCAL_RUNTIME` is not `1`. Registers the eight governed
action tools. Every one of them talks to the Action Gateway, so external writes
stay behind policy, approvals, and evidence.

| Tool | Call |
| --- | --- |
| `commander_action_simulate` | `POST /v1/actions/simulate` |
| `commander_action_propose` | `POST /v1/actions` |
| `commander_action_get` | `GET /v1/actions/:runId` |
| `commander_action_approve` | `POST /v1/actions/:runId/approve` |
| `commander_action_compensation_request` | `POST /v1/actions/:runId/compensations` |
| `commander_action_compensation_approve` | `POST /v1/actions/:runId/compensations/:authorizationId/approve` |
| `commander_action_reconcile` | `POST /v1/actions/:runId/reconcile` |
| `commander_action_evidence` | `GET /v1/actions/:runId/evidence` |

### Local runtime mode

Used when `PRAETOR_MCP_LOCAL_RUNTIME=1`. Registers a different set:

- **Model-router tools:** `execute_agent`, `list_models`, `route_task`.
- **Praetor's built-in tools**, exposed through `registerCommanderTools`.

This mode is for local development against your own machine. It is not the
governed path.

## Tool safety filtering

In local runtime mode, dangerous tools are filtered out unless the caller
explicitly opts in with `allowDangerousTools`. The filtered set includes:

`exec`, `git`, `apply_patch`, `file`, `file_hash_edit`, `system`, `verify`,
`code`, `refine_code`, plus the legacy names `shell_execute`, `file_delete`,
`file_write`, `python_execute`, and `execute_script`.

Even with the opt-in, a tool that requires an external write still returns an
`ACTION_GATEWAY_REQUIRED` error unless `PRAETOR_ACTION_GATEWAY_URL` is
configured — non-read-only tools cannot execute purely locally. They must be
proposed through `/v1/actions`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `PRAETOR_ACTION_GATEWAY_URL` | Gateway base URL. **Required** in enterprise/production mode and whenever dangerous tools are allowed. Missing it fails closed |
| `PRAETOR_API_KEY` | Credential presented to the gateway |
| `PRAETOR_MCP_LOCAL_RUNTIME` | Set to `1` to switch from gateway mode to local runtime mode |

Client configuration:

```json
{
  "mcpServers": {
    "commander": {
      "command": "commander-mcp-server",
      "args": [],
      "env": {
        "PRAETOR_ACTION_GATEWAY_URL": "https://commander.example",
        "PRAETOR_API_KEY": "replace-with-a-scoped-key"
      }
    }
  }
}
```

## Command execution allowlist

When the core MCP client launches a stdio MCP server, only certain base commands
are permitted:

- Allowed by default: `node`, `nodejs`, `python`, `python3`, `bun`, `deno`.
- **`npx` is always forbidden.**
- `uvx` is forbidden unless `PRAETOR_MCP_ALLOW_UVX=1`.
- Extend the list with `PRAETOR_MCP_ALLOWED_COMMANDS`.
- Inline-evaluation and module-loader flags are rejected: `-e`, `-c`, `--eval`,
  `--require`, `--loader`, `--inspect*`, and short-option clusters such as `-pe`.

The API `/mcp` discovery path uses its own **hardcoded** allowlist of `node`,
`python`, and `python3`, and does not read `PRAETOR_MCP_ALLOWED_COMMANDS`.

## Related integrations

`@praetor/openai-agents-mcp` is an independent process boundary that consumes
the published MCP server over stdio using the public `@openai/agents` SDK. It
imports no Praetor packages and calls no Praetor internals. Its
deterministic mode is the CI path and makes no model-network request; `live`
mode is opt-in.