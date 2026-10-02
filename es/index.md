# Commander

> This page is synchronized from the canonical English documentation. Español navigation is available; commands and product limits are identical in every locale.

Approval and Recovery Plane for Coding & DevOps AI Agents

*Prevent duplicate mutations · Recover from dropped network responses · Cryptographically signed evidence*

Autonomous agents are rapidly taking on mission-critical workflows: modifying codebases, opening pull requests, running database migrations, and provisioning cloud infrastructure. But when an agent makes an external write, **a network timeout, dropped socket, or worker restart leaves the system in an ambiguous state: did the write happen, how many times, and with what payload?**

Blindly retrying creates duplicate PRs, double transactions, and corrupted state. Simply giving up leaves orphaned mutations.

Commander solves this fundamental distributed systems problem. It records the approved request and its execution state outside the agent, performs **preflight query-before-retry** to detect whether a mutation already took effect, and stops in an explicit `UNKNOWN` state when the evidence is ambiguous rather than making dangerous assumptions.

```
   ┌────────────────────────────────────────────────────────┐
   │        AI Agent Frameworks & LLMs                      │
   │  Claude Code · Cursor · OpenAI Agents · LangGraph      │
   └──────────────────────────┬─────────────────────────────┘
                              │ 1. Propose Mutation (No direct write tokens)
                              ▼
   ┌────────────────────────────────────────────────────────┐
   │            Commander Control Plane                     │
   │  ┌─────────────────────────┐ ┌──────────────────────┐  │
   │  │ Preflight Idempotency   │ │ Two-Phase Human Gate │  │
   │  │ (Query-Before-Retry)    │ │ (Cryptographic Hash) │  │
   │  └─────────────────────────┘ └──────────────────────┘  │
   │  ┌─────────────────────────┐ ┌──────────────────────┐  │
   │  │ Durable Postgres Kernel │ │ Tamper-Evident Audit │  │
   │  │ (Crash-safe step lease) │ │ (Ed25519 Signed JWS) │  │
   │  └─────────────────────────┘ └──────────────────────┘  │
   └──────────────────────────┬─────────────────────────────┘
                              │ 2. Governed Write & Auto-Compensation
                              ▼
   ┌────────────────────────────────────────────────────────┐
   │       External Infrastructure & Version Control        │
   │   GitHub (PRs/Issues) · Kubernetes · Cloud APIs        │
   └────────────────────────────────────────────────────────┘
```

Read the technical essay: [Why retrying an AI agent's external action is unsafe](https://github.com/PStarH/Commander/blob/master/docs/content/why-retrying-ai-agent-external-actions-is-unsafe.md).

## The Distributed Systems Problem for AI Agents

| Challenge | Naive Agent Execution | Commander Governed Action |
| --- | --- | --- |
| **Response Loss** (e.g. 504 Gateway Timeout during PR creation) | Re-plans or retries blindly → **Duplicate PRs & mutations** | **Preflight Query-Before-Retry**: Checks remote outcome by action identity before retry |
| **Worker Crash Mid-Task** | State lost or restarted from zero with orphaned external side effects | **Durable PostgreSQL Kernel**: Step lease reclaims; new worker resumes safely |
| **Credential Exposure** | Agent process directly holds write API keys / GitHub tokens | **Strict Boundary**: Agent only has *propose* authority; write tokens stay in worker plane |
| **Human Sign-Off** | Text-based prompt or unverified button | **Cryptographic Binding**: Approval locks immutable request digest & policy snapshot |
| **Audit & Forensics** | Ephemeral console text | **Ed25519 Evidence**: JWS signed receipts for independent verification |
| **Rollback / Undo** | Ad-hoc scripts or impossible | **Governed Compensation**: Requires separate authorization binding and dedicated receipt |

## ⚡ 4 Ways to Experience Commander (Under 60 Seconds)

| Path | Command | What It Exercises |
| --- | --- | --- |
| **1. Zero-Dependency Demo** | `pnpm demo:l4-a` | Multi-agent deliberation, 5 quality gates, in-memory execution (no API key needed) |
| **2. Real Provider Code Review** | `pnpm exec tsx packages/core/src/cliEntry.ts review --commit HEAD --real --provider=openai` | Read-only analysis of your Git diff across configured quality gates |
| **3. Interactive Web Console** | `pnpm gui` | Live control room on `:5173`: agent topology, DLQ inspection, and approval queue |
| **4. Governed Action Offline Test** | `pnpm test:github:offline` | 130 offline contract assertions for idempotency & response-loss recovery |

### 📦 4-Line Integration (Python SDK)

```python
from commander_sdk import CommanderClient

# Connect to the Commander execution control plane
client = CommanderClient(base_url="http://localhost:4000")

# Dispatch a mutation with preflight query-before-retry and cryptographic approval
run = client.runs.create(
    task="Review auth module diff and propose hotfix PR",
    require_approval=True
)
print(f"Run {run.run_id} initiated; approval required: {run.approval_required}")
```

## Core Architecture & Capabilities

Commander provides a robust execution fabric that separates agent reasoning from external side-effects:

- **Deliberation Engine**: Classifies incoming tasks by complexity and automatically selects one of five canonical execution topologies (`SINGLE`, `CHAIN`, `DISPATCH`, `ORCHESTRATOR`, `REVIEW`).
- **25 LLM Providers with Auto-Failover**: Seamlessly fallback across OpenAI, Anthropic, Gemini, Groq, Mistral, Ollama, DeepSeek, and 18 others with unified configuration. See [Providers](/providers).
- **18 Built-in Tools & Native MCP**: Built-in shell, filesystem, and Git tools with capability trust tiers, plus full Model Context Protocol (stdio MCP) server support. See [Tools](/tools) and [MCP](/mcp).
- **Multi-Layer Quality Verification**: Configurable evaluation pipeline assessing hallucination, consistency, completeness, accuracy, and safety before mutations take effect.
- **Distributed Durability**: Circuit breakers, dead-letter queues (DLQ), saga compensation, and PostgreSQL-backed crash-safe step leasing.
- **Governed Mutation Plane**: Capability tokens, policy decisions, cryptographic human approval binding, and Ed25519-signed evidence receipts.

## Enterprise evaluation & pilots

Commander is alpha. Two evaluation paths are available:

- **GitHub Pilot (governed actions & recovery):** A narrow pilot for same-repository PR creation from existing branches. An agent proposes the action; a human approves the exact request. When network responses drop, recovery queries GitHub using persisted action identity rather than creating duplicate PRs. See the [GitHub pilot guide](https://github.com/PStarH/Commander/blob/master/docs/pilot/github/README.md).
- **Shadow Phase A (historical evaluation):** Customer-operated evaluation of historical observations against a pinned policy. It executes no external actions. Download the [Shadow Phase A release package](https://github.com/PStarH/Commander/releases/tag/shadow-phase-a-0.1.0-alpha.20260910).
- **Enterprise Pilot Readiness:** An explicit checklist of security, multi-tenancy, SLO, and data governance controls with code and baseline evidence pointers. Review [ENTERPRISE_READINESS.md](https://github.com/PStarH/Commander/blob/master/ENTERPRISE_READINESS.md) before production pilots.

## Development product paths

- **Local CLI:** the supported default for one developer or a local team.
- **Web console:** a local interface served with the API.
- **Enterprise Gateway:** an alpha `/v1` server path (`apps/api` → `@commander/kernel` Postgres → worker-plane + effect-broker). It is not a production-proven multi-tenant SaaS.

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