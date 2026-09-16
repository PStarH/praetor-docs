# SDKs and API

> This page is synchronized from the canonical English documentation. 한국어 navigation is available; commands and product limits are identical in every locale.

## Interfaces

| Interface | Entry point | Status |
| --- | --- | --- |
| Local CLI | `commander <task>` | Primary supported interface |
| HTTP API | `http://localhost:4000` | Supported locally |
| Gateway `/v1` API | `POST /v1/runs` | Alpha |
| TypeScript SDK | `@commander/sdk` | Alpha |
| Python SDK | `commander-ai` (import `commander`) | Alpha |
| MCP server | `commander-mcp-server` | Alpha |

Full command list: [CLI reference](/cli). Endpoint list: [HTTP API](/api).

## OpenAPI document

The running server publishes its OpenAPI 3.1 document at:

```bash
curl http://localhost:4000/v1/openapi.json
```

The standard profile also exposes `http://localhost:4000/api/openapi.json`,
which is marked deprecated and returns `410 Gone` in the enterprise profile.
There is no plain `/openapi.json` path.

## TypeScript SDK

`@commander/sdk` ships two clients:

- `CommanderGatewayClient` — HTTP client for the `/v1` Gateway API. Needs no
  local runtime. This is the current server path.
- `CommanderClient` — in-process client that dynamically imports
  `@commander/core`. Alpha; it can initialize local state and configured tools.

```typescript
import { CommanderGatewayClient } from '@commander/sdk';

const client = new CommanderGatewayClient({
  baseUrl: process.env.COMMANDER_API_URL!,
  apiKey: process.env.COMMANDER_API_KEY!,
});

const result = await client.submitRun({
  goal: 'Review the proposed change',
  policySnapshotId: 'review-policy-v1',
  idempotencyKey: crypto.randomUUID(),
});
```

## Python SDK

The Python package contains a legacy client and a Gateway client. Use the
Gateway client (`CommanderGatewayClient`) for the current server path: it reads
`COMMANDER_API_URL` and defaults to `http://127.0.0.1:4000`.

```python
from commander import CommanderGatewayClient

client = CommanderGatewayClient(base_url="http://127.0.0.1:4000")
```

The legacy `CommanderClient` / `CommanderClientSync` pair does **not** read
`COMMANDER_API_URL`; it still defaults to port `3001`, which is **not** a
Commander API port — that port belongs to Grafana in the observability profile.
Always pass an explicit `base_url` when using the legacy client.

## Boundaries

Treat legacy API material as a compatibility-only implementation detail, not a
public integration contract. Some product routes are also mounted under a legacy
versioned alias for backward compatibility; those aliases are not documented
here and are not an integration surface. Use the `/v1` Gateway instead.