# Commander

> This page is synchronized from the canonical English documentation. 한국어 navigation is available; commands and product limits are identical in every locale.

Commander is a local-first tool for orchestrating multi-agent engineering work.
It runs on your machine, streams task activity, and lets you choose the level
of automation appropriate for the task.

## Enterprise evaluation

Commander is alpha. The current enterprise evaluation is [Shadow Phase A](https://github.com/PStarH/Commander/blob/codex/release-20260810/docs/pilot/shadow/README.md): a customer-operated evaluation of historical observations against a pinned policy. It does not execute or authorize external actions. Live Kubernetes rollback remains frozen.

Download the [Shadow Phase A alpha package](https://github.com/PStarH/Commander/releases/tag/shadow-phase-a-0.1.0-alpha.20260910), including the setup guide, exact source revision, package checksums, and evaluation limits. This is not a production release of the general CLI or Gateway.

## Development product paths

- **Local CLI:** the supported default for one developer or a local team.
- **Web console:** a local interface served with the API.
- **Enterprise Gateway:** an alpha `/v1` server path. It is not a
  production-proven multi-tenant SaaS.

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