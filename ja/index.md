# Commander

> This page is synchronized from the canonical English documentation. 日本語 navigation is available; commands and product limits are identical in every locale.

Approval and recovery for Coding and DevOps agents, starting with GitHub pull requests.

Once an agent's action reaches an external system, a timeout or crash can leave three questions open: did it happen, how many times, and with what payload? Retrying blindly can duplicate the write; giving up can lose it. Commander records the approved request and its execution state outside the agent, looks up the outcome after an ambiguous response, and stops in an explicit unknown state when the evidence is not conclusive.

## Enterprise evaluation & pilots

Commander is alpha. Two evaluation paths are available:

- **GitHub Pilot (governed actions & recovery):** A narrow pilot for same-repository PR creation from existing branches. An agent proposes the action; a human approves the exact request. When network responses drop, recovery queries GitHub using persisted action identity rather than creating duplicate PRs. See the [GitHub pilot guide](https://github.com/PStarH/Commander/blob/master/docs/pilot/github/README.md).
- **Shadow Phase A (historical evaluation):** Customer-operated evaluation of historical observations against a pinned policy. It executes no external actions. Download the [Shadow Phase A release package](https://github.com/PStarH/Commander/releases/tag/shadow-phase-a-0.1.0-alpha.20260910).
- **Enterprise Pilot Readiness:** An explicit checklist of security, multi-tenancy, SLO, and data governance controls with code and baseline evidence pointers. Review [ENTERPRISE_READINESS.md](https://github.com/PStarH/Commander/blob/master/ENTERPRISE_READINESS.md) before production pilots.

## Development product paths

- **Local CLI:** the supported default for one developer or a local team.
- **Web console:** a local interface served with the API.
- **Enterprise Gateway:** an alpha `/v1` server path (`apps/api` → `@commander/kernel` Postgres → worker-plane + effect-broker). It is not a production-proven multi-tenant SaaS.

## What Commander does

- **Deliberation** classifies each task, estimates complexity, and selects one of
  five canonical topologies (`SINGLE`, `CHAIN`, `DISPATCH`, `ORCHESTRATOR`,
  `REVIEW`).
- **25 providers** with a configurable auto-failover chain — set one API key to
  start. See [Providers](/providers).
- **18 built-in tools** plus MCP-compatible external tools. See [Tools](/tools).
- **Five quality gates** on paths where the verification pipeline is enabled:
  hallucination, consistency, completeness, accuracy, safety.
- **Durability:** circuit breakers, a dead letter queue, saga compensation, and
  crash-safe checkpointing.
- **Governed external writes** through the Architecture V2 effect broker, with
  capability tokens, policy decisions, approvals, and signed evidence.

## Start here

| Page | What it covers |
| --- | --- |
| [Quick start](/getting-started) | Install, run the simulated demo, start the interfaces |
| [CLI reference](/cli) | Every command, subcommand, and flag |
| [HTTP API](/api) | Endpoints, authentication, and the `/v1` Gateway |
| [Configuration](/configuration) | Environment variables and storage backends |
| [Tools](/tools) | The 18 built-in tools, trust tiers, and MCP filtering |
| [Providers](/providers) | All 25 providers, env variables, failover, model tiers |
| [MCP](/mcp) | The stdio MCP server, both modes, and the command allowlist |
| [Web console](/web-console) | Console routes and how to start it |
| [Architecture](/architecture) | Topologies, quality gates, and the V2 plane |
| [Workflows and automation](/workflows) | Workflows, scheduler, webhooks, background jobs |
| [Packages and SDKs](/packages) | Workspace packages, TypeScript/Python SDKs, plugins |
| [SDK and API overview](/sdk) | SDKs, OpenAPI documents, and client usage |
| [Deployment](/deployment) | Supported local installation and profiles |
| [Operations and rollback](/operations) | Health checks, recovery, and rollback limits |
| [Security and privacy](/security) | Authentication, sandboxing, governed writes, caveats |
| [Troubleshooting](/troubleshooting) | Common failures and how to fix them |
| [Benchmarks](/benchmarks) | What the benchmarks do and do not prove |
| [Support and limits](/support) | Current product boundary |

Read [Security and privacy](/security) before connecting customer data or
third-party tools.

## What this site promises

This site documents supported commands, configuration boundaries, and known
limits. It does not treat simulated benchmarks, CI fixtures, or compliance
reporting scaffolds as production evidence or certification.