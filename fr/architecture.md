# Architecture

> This page is synchronized from the canonical English documentation. Français navigation is available; commands and product limits are identical in every locale.

Commander has two layers: the **agent runtime** (deliberation, topologies,
quality gates) and the **Architecture V2 governed execution plane** (kernel,
effect broker, worker plane). This page is a map; the binding decisions live in
the repository's ADRs under `docs/architecture/`.

## Deliberation

Every task goes through classification, complexity estimation, and topology
selection before any agent runs.

**Task classification** — six types: `FACTUAL`, `REASONING`, `CREATIVE`,
`RESEARCH`, `CODING`, `ANALYSIS`.

**Complexity estimation** — a score used to size the topology. A one-line task
uses one agent; a cross-repository audit can fan out to many.

**Topology selection** — five canonical topologies:

| Topology | Shape |
| --- | --- |
| `SINGLE` | One agent handles everything |
| `CHAIN` | Sequential chain of agents (prompt chaining) |
| `DISPATCH` | Parallel agents, then aggregation |
| `ORCHESTRATOR` | Orchestrator delegates to workers |
| `REVIEW` | Generator + evaluator iterative loop |

Legacy names (`SEQUENTIAL`, `HANDOFF`, `PARALLEL`, `HIERARCHICAL`, `HYBRID`,
`DEBATE`, `ENSEMBLE`, `EVALUATOR_OPTIMIZER`, `CONSENSUS`) are still accepted and
normalized to a canonical parent. The CLI warns once per process per legacy
name.

## Execution pipeline

```
Deliberation → Topology router → Agents (LLM → tool → verify)
             → Synthesis → Quality gates → Result
```

Agent events, tool calls, and gate decisions stream to your terminal or an SSE
endpoint as they happen.

## Quality gates

Five configured gates can run before a result is returned:

| Gate | Checks |
| --- | --- |
| `HALLUCINATION_CHECK` | LLM-as-judge detection of fabricated facts |
| `CONSISTENCY` | Cross-agent agreement, no contradictions |
| `COMPLETENESS` | All required dimensions covered |
| `ACCURACY` | Factual correctness against source material |
| `SAFETY` | Content scanning and injection detection |

These gates are checks, not guarantees. If a gate fails, the system retries or
reports the failure with context.

## Resilience

| Capability | Implementation |
| --- | --- |
| Circuit breakers | Three-state (`CLOSED` / `OPEN` / `HALF-OPEN`), per-provider error-rate tracking |
| Dead letter queue | Append-only NDJSON, 7 categories, replay support |
| Saga compensation | Registered compensation steps; external rollback is not guaranteed |
| Checkpointing | SQLite + WAL, crash-safe recovery |
| Semantic caching | SHA-256 exact match plus cosine-similarity deduplication |

DLQ categories: `llm`, `tool`, `execution`, `verification`,
`circuit_breaker`, `compensation`, `semantic_drift`.

## Architecture V2

V2 splits durable authority from execution so that external writes are governed
in one place.

| Package | Responsibility |
| --- | --- |
| `@commander/contracts` | Versioned shared types, error codes, state machine, event envelope, OpenAPI V1. Pure — no runtime imports |
| `@commander/kernel` | Sole authority for durable run/step lifecycle: leases, idempotency, outbox, recovery, migrations |
| `@commander/effect-broker` | The only sanctioned path for external writes. Two-phase `admit()` → `executeAdmitted()`, Ed25519 capability tokens, policy decisions, quotas, fencing, signed evidence |
| `@commander/action-adapters` | External-mutation adapters (GitHub pull request, ServiceNow incident, Kubernetes rollback) with conformance test suite |
| `@commander/worker-plane` | The only place a leased step executes. Fail-closed bootstrap |
| `@commander/adapter-ops` | Compensation and reconciliation drain daemon |
| `@commander/postgres-runtime` | Hardened `pg.Pool` factory: `sslmode=verify-full`, CA file, SPKI pinning |
| `@commander/shadow-plane` | Read-only historical policy evaluation for Shadow pilots |
| `@commander/core` | Agent runtime: orchestration, tools, providers, memory, security, CLI |
| `@commander/sdk`, `commander-ai` | TypeScript and Python clients |
| `@commander/mcp-server` | MCP stdio server exposing Action Gateway tools |
| `@commander/plugin-sdk` | Plugin authoring surface |

### Governance flow

1. A run is submitted to the Gateway (`POST /v1/runs`) and persisted by the
   kernel.
2. Steps are leased by workers with capability-aware leasing.
3. Any step that needs an external write must go through the effect broker,
   which verifies a capability token, binds the request hash, evaluates policy
   and quotas, and records signed evidence.
4. Consequential actions require approval; approvals are bound to the returned
   digest and policy snapshot.
5. Mutations execute through dedicated action adapters (`@commander/action-adapters`).
   If response transport is interrupted, the adapter queries external systems
   for existing outcomes before attempting retries, preventing duplicate mutations.
6. If a step fails after a partial write, compensation runs through
   `adapter-ops` and is reconciled.

### Storage and durability

| Layer | Authority |
| --- | --- |
| API product stores | `sqlite` (local default), `memory`, or `postgres` |
| Kernel | PostgreSQL — runs, steps, events, outbox, leases |
| Local state | `.commander_state/` (WAL at `.commander_state/event-sourcing.wal`) |

In production the API fails closed if no durable store is configured. Local
file-backed state is not a multi-replica authority.

## Related pages

- [Tools](/tools) — the 18 built-in tools and their trust tiers
- [Providers](/providers) — the 25 providers and the failover chain
- [MCP](/mcp) — how external MCP tools enter the runtime
- [Security and privacy](/security) — capability tokens, evidence, sandboxing

## Further reading

- `docs/architecture/000-index.md` — ADR index and feature-freeze rules
- `docs/v2-migration-guide.md` — migrating to Architecture V2
- `docs/slo.md` — SLO definitions