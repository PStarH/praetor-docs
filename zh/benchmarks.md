# Benchmarks and evaluation

> This page is synchronized from the canonical English documentation. 简体中文 navigation is available; commands and product limits are identical in every locale.

Commander maintains benchmark suites for regression detection, defensive validation, and performance tracking.

> **Evidence boundary:** Results documented here run in **simulated/scripted harnesses** or as **CI baselines**. They are not customer SLAs, production SOC evidence, or independent security certifications. A benchmark measurement reflects its test harness, case manifest, raw output, and declared environment provenance.

## Quick start

Run the automated suites from a source checkout:

```bash
# Run core validation suites
pnpm benchmark:all          # WAL + Recovery + Replay + SLO + Tenant Isolation + RedTeam + AgentDojo
pnpm check:readiness --non-strict # Diagnostic validation: verify baselines match schema (strict mode requires an approved profile)

# Security benchmarks
pnpm benchmark:agentdojo     # AgentDojo 12-case indirect injection suite
pnpm benchmark:agentdojo:all # All 3 security benchmarks (AgentDojo + AgentSafetyBench + AgentHarm)
pnpm benchmark:redteam       # Red Team battery (47 scenarios, 8 attack categories)

# Resilience and recovery
pnpm benchmark:chaos         # Chaos Engineering 255 (simulated harness)
pnpm bench:wal               # WAL throughput baseline
pnpm bench:wal:regress       # WAL p99 regression check
pnpm bench:recovery          # RecoveryBootstrapper crash recovery (<5s target)
pnpm bench:replay            # EventSourcingEngine replay throughput (1k/10k/100k events)
pnpm bench:slo               # SLO baseline (recovery, failover, compensation, DLQ)

# Tenant isolation
pnpm bench:tenant-isolation  # Cross-tenant fuzz test (1,000 mutations, 6 attack vectors)
```

## Benchmark matrix

| Suite | Category | Scope | Harness result / Status | Script |
| --- | --- | --- | --- | --- |
| **AgentDojo** | Security | 12 indirect prompt injection cases | All listed cases blocked (simulated harness) | `scripts/benchmark-agentdojo.ts` |
| **Red Team Battery** | Security | 47 scenarios across 8 attack categories | All listed cases blocked (simulated harness) | `scripts/benchmark-redteam.ts` |
| **Agent-SafetyBench** | Security | 10 safety test cases | All listed cases blocked (simulated harness) | `scripts/benchmark-agentdojo.ts --all` |
| **AgentHarm** | Security | 8 harmful intent test cases | All listed cases blocked (simulated harness) | `scripts/benchmark-agentdojo.ts --all` |
| **Chaos Engineering** | Resilience | 200 synthetic + 55 mutation cases (=255) | Full harness entry; measures MTTD, MTTR, DLQ replay | `benchmarks/chaos-runner/src/index.ts` |
| **WAL Throughput** | Performance | Append-only event log throughput | p99 latency baseline; daily regression check | `scripts/bench-wal-throughput.ts` |
| **RecoveryBootstrapper** | Recovery | Crash recovery with 10/100/1000 zombie steps | <5s target recovery in test harness | `scripts/bench-recovery-bootstrap.ts` |
| **EventSourcing Replay** | Recovery | Replay throughput across 1k/10k/100k events | Replay integrity verified | `scripts/bench-event-sourcing-replay.ts` |
| **SLO Measurement** | SLO | Recovery, failover, compensation, DLQ | 99.95% API availability, <5s schedule (CI baseline) | `scripts/bench-slo-baseline.ts` |
| **Tenant Isolation Fuzz** | Security | 1,000 mutations across 6 attack vectors | In-process tenant isolation primitives verified | `scripts/bench-tenant-isolation.ts` |

## Defensive architecture

### Prompt injection defense (AgentDojo)

Commander's security benchmark runner evaluates defenses against indirect prompt injection across three configured boundaries:

1. **Input boundary:** Prompt sanitization, delimiter enforcement, and canary token tracking.
2. **Tool boundary:** Ed25519 / HMAC capability-token verification, argument structure validation, and trust tiers (`trusted` vs `untrusted` tools).
3. **Output boundary:** Configured quality gates (`HALLUCINATION_CHECK`, `CONSISTENCY`, `COMPLETENESS`, `ACCURACY`, `SAFETY`) scanning for exfiltration patterns and unauthorized tool calls.

### Chaos engineering & fault recovery

The Chaos 255 runner (`benchmarks/chaos-runner`) introduces systematic runtime perturbations:

- **Provider faults:** Timeout injection, 429 rate limits, malformed JSON responses, and token truncation.
- **Process faults:** Worker SIGKILL crashes mid-execution, database connection drops, and lease expiration.
- **State faults:** Event-log corruption, replay gaps, and dead letter queue (DLQ) accumulation.

The harness validates that:
- Checkpoints survive worker termination (<5s recovery target).
- Circuit breakers transition reliably (`CLOSED` → `OPEN` → `HALF-OPEN`) on provider errors.
- Unresolved steps transition to explicit compensation or DLQ with full diagnostic context.

## Reliability targets (CI baselines)

| Objective | Target | Mechanism | Scope |
| --- | --- | --- | --- |
| Checkpoint recovery | < 5 s | SQLite + WAL / Postgres outbox | CI baseline |
| Provider failover | < 10 s | Automatic fallback chain | Configured chain |
| Saga compensation | < 30 s | Compensation scheduler (`adapter-ops`) | In-memory / Postgres |
| DLQ processing | < 60 s | Append-only NDJSON with replay | Local queue |

## Pilot evaluation guidance

For production diligence, external benchmarks should not replace an in-house proof of concept:

1. **Test real tool boundaries:** Evaluate whether sensitive tools (`exec`, `git`, external APIs) are gated behind appropriate capability tokens and human approvals.
2. **Inject transport faults:** Exercise response loss on external writes (e.g. using the GitHub pilot test proxy) to verify that recovery queries avoid duplicate writes.
3. **Verify audit retention:** Inspect signed evidence bundles and verify Ed25519 JWS signatures with `@commander/sdk`'s `verifyActionEvidence()`.