# Benchmarks and evaluation

Praetor maintains benchmark suites for regression detection, defensive validation, and performance tracking.

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

Praetor's security benchmark runner evaluates defenses against indirect prompt injection across three configured boundaries:

1. **Input boundary:** Prompt sanitization, delimiter enforcement, and canary token tracking.
2. **Tool boundary:** Ed25519 / HMAC capability-token verification, argument structure validation, and trust tiers (`trusted` vs `untrusted` tools).
3. **Output boundary:** Configured quality gates (`HALLUCINATION_CHECK`, `CONSISTENCY`, `COMPLETENESS`, `ACCURACY`, `SAFETY`) scanning for exfiltration patterns and unauthorized tool calls.

### Reasoning Benchmarks vs. Infrastructure Resilience Benchmarks

In academic and consumer AI, benchmarks like SWE-bench, WebArena, or GAIA measure **model reasoning ability**: whether an LLM can figure out the solution to a bug or browser task under ideal execution conditions.

In enterprise production infrastructure, **the primary obstacle to deploying autonomous agents is not reasoning IQ, but system resilience under failure**:
- What happens when an LLM provider returns a 504 Gateway Timeout or 429 Rate Limit mid-mutation?
- What happens when a tool times out after creating a remote resource?
- What happens when a worker container is evicted by Kubernetes (OOMKilled / SIGKILL)?
- What happens when an attacker injects indirect prompt injection into tool outputs?
- What happens when network latency causes a split-brain condition between concurrent workers?

Praetor's benchmark infrastructure explicitly prioritizes **fault injection, recovery determinism, and defensive robustness**. Rather than claiming model-level intelligence, Praetor proves that the surrounding execution plane guarantees idempotency, cryptographic verification, and state recovery when upstream models and downstream networks fail.

### Chaos engineering & fault recovery (Chaos 255)

The Chaos 255 runner (`benchmarks/chaos-runner`) introduces systematic runtime perturbations across **255 test cases** (200 synthetic + 55 mutation scenarios) anchored in 47 real-world production incidents, exercising 641 mock tools and 802 agent roles with 496 assertions:

- **4-Layer Fault Hierarchy:**
  - **L1 (LLM Faults):** Provider timeout injection, 429 rate limits, malformed JSON streaming, token truncation, and failover latency.
  - **L2 (Tool Faults):** 10 distinct failure modes (HTTP 5xx, HTTP 4xx, disk full, OOM, process crash, state corruption, dependency unavailable, clock drift, auth expiry, socket timeout).
  - **L3 (System Faults):** Monotone step lease expiry, PostgreSQL connection loss, SQLite WAL lock contention, and worker SIGKILL termination mid-flight.
  - **L4 (Tenant & Concurrency Faults):** Multi-tenant blast radius containment, noisy-neighbor rate limit throttling, and cross-tenant isolation fuzzing.

- **3 Mutation Axes:**
  - **Telemetry Gap (Fog of War):** Partial observation loss, missing execution receipts, and ambiguous network responses.
  - **Stochastic / Gray Failure:** Intermittent socket hangs and high-percentile tail latency spikes.
  - **Security-Stability Convergence:** Simultaneous prompt injection attacks during active runtime recovery.

- **Core Resilience Coverage:**
  - **Circuit Breaking (255 cases):** Automatic 3-state transition (`CLOSED` → `OPEN` → `HALF-OPEN`) on provider degradation.
  - **Governed Rollback & SAGA (164 cases):** Registered compensation execution when partial mutations fail.
  - **Dead Letter Queue (139 cases):** Append-only NDJSON capture with 7 failure taxonomy buckets and replay verification.
  - **Timeout & Lease Handling (128 cases):** Safe lease expiration and new worker recovery without duplicate execution.
  - **Idempotency & Preflight (34 cases):** Remote state querying before retry to prevent duplicate mutations.

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
3. **Verify audit retention:** Inspect signed evidence bundles and verify Ed25519 JWS signatures with `@praetor/sdk`'s `verifyActionEvidence()`.
