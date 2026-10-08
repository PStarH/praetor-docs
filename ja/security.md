# Security and privacy

> This page is synchronized from the canonical English documentation. 日本語 navigation is available; commands and product limits are identical in every locale.

Praetor is **alpha**. Its own repository states it is not production-ready and
that tenant isolation is *not production-proven*. This page describes the
controls that exist and — just as importantly — the ones that do not. Read the
[Limits](#limits-and-honest-caveats) section before relying on any of it.

## Threat model in one paragraph

Praetor runs on your machine or in your cluster, holds provider credentials,
can read and write files, and can execute code. The assets worth protecting are
provider API keys, the Praetor secret material, customer source and data that
flows through tasks, and the integrity of the audit trail. The main risks are
credential theft, prompt injection via tool output, excessive tool authority,
tenant data bleed in multi-tenant deployments, and unbounded external writes.
Praetor has controls for each of these, but most of them must be configured to
be effective, and several are opt-in.

## Authentication

| Mechanism | Details |
| --- | --- |
| API key | `X-API-Key: <key>` or `Authorization: Bearer <key>`. Format is `cmdr_` plus 32 random bytes. Stored as a **plain, unsalted SHA-256** hash in PostgreSQL and returned in plaintext exactly once at creation |
| JWT | `Authorization: Bearer <jwt>`. **HS256 (symmetric HMAC) only.** Access tokens 24h, refresh tokens 7d. Refresh tokens are single-use and revoked on consumption |
| OIDC | `GET/POST /api/auth/oidc/*`. ID tokens verified via JWKS using RS256/384/512 or ES256/384/512 |
| SCIM 2.0 | User and group provisioning. Requires an admin JWT role or an API-key scope of `scim` / `admin` / `*` |
| A2A | `PRAETOR_A2A_AUTH_TOKEN` bearer (also accepts `A2A_AUTH_TOKEN`), minimum 16 characters |

**Secret requirements enforced at startup**

| Variable | Rule |
| --- | --- |
| `JWT_SECRET` | Always required. Minimum 32 characters, and known public defaults are rejected |
| `ADMIN_PASSWORD` | Minimum 16 characters; the default value is rejected. Required in production, or when `PRAETOR_API_REPLICAS > 1` |
| `PRAETOR_MASTER_KEY` | Minimum 32 characters. Keys the encrypted secrets vault |
| `PRAETOR_API_KEY` | Required startup secret in production, and Praetor's own credential toward the Action Gateway. It is **not** the inbound request key store |
| `PRAETOR_CAPABILITY_TOKEN_KEY` | Required in production. HMAC key for API-surface capability tokens |
| `PRAETOR_INTEGRITY_KEY` | Required in production. HMAC key for WAL event signing |
| `PRAETOR_EVIDENCE_JWKS_JSON` | Required in Compose deployments. Public JWKS string used by the API to verify Ed25519-signed action evidence |

In **production**, a missing or weak value for startup secrets aborts
startup. Outside production, a missing value is a warning, not a failure —
except `JWT_SECRET`, which is always required.

Brute-force protection locks an IP for 5 minutes after 5 failed authentication
attempts in a 60-second sliding window (`AUTH_MAX_FAILURES`, `AUTH_LOCKOUT_MS`).

### Roles

Six roles, with a numeric hierarchy used by `requireRole`:

`super_admin` (6) · `admin` (5) · `developer` (4) · `operator` (3) · `auditor` (2) · `viewer` (1)

New users default to `viewer`; the bootstrap account is `admin`. Passwords are
hashed with bcrypt (cost 10). The last remaining admin cannot be deleted.

### API-key scopes

Keys can be minted with scopes of `read`, `write`, or `admin` only. Individual
routes additionally check finer-grained scope strings (`scim`, `mcp:admin`,
`audit:read`, `actions:propose`, `knowledge:write`, and others), but those can
only arrive through JWT claims or direct database inserts — not through the key
creation API. There is no central scope registry; `admin` and `*` are universal
bypasses. Treat the scope model as coarse.

## Authorization and tenancy

- The authenticated tenant (from the JWT or API key) is **always authoritative**.
- If `X-Tenant-ID` conflicts with it, the request is rejected with **403**.
- If no tenant is bound, the header is accepted only in the non-production
  standard profile. In production or the enterprise profile, a bare header
  cannot establish identity and is rejected.
- Tenant IDs are validated against `^(?!.*\.\.)[a-zA-Z0-9._:-]{1,128}$`, which
  blocks `..` path traversal; a malformed ID returns 400.
- **Cross-tenant reads return 404, not 403**, so they do not confirm that a
  resource exists.

**Row-level security** is implemented in PostgreSQL for 17 kernel relations
(runs, steps, effects, events, outbox, timers, workers, and others), each with
`ENABLE ROW LEVEL SECURITY` **and** `FORCE ROW LEVEL SECURITY` plus per-role
policies. Database roles are separated: `commander_app` (API),
`commander_worker`, `commander_adapter_ops`, `commander_scheduler`,
`commander_owner`, and `commander_tenant_authority` (`NOLOGIN NOBYPASSRLS`).

The tenant context is issued per transaction, bound to the database OID, backend
PID, and transaction ID, with a 60-second expiry. A mismatched or absent binding
raises an error rather than silently widening access.

> This machinery exists and is tested, but the repository's own `SECURITY.md`
> describes tenant isolation as **not production-proven**. Validate it yourself
> before relying on it for a hard isolation requirement.

## Capability tokens

There are **two different implementations**, and the distinction matters.

| Surface | Algorithm | Binds |
| --- | --- | --- |
| API / tool-call surface | HMAC-SHA-256 (`PRAETOR_CAPABILITY_TOKEN_KEY`) | subject, audience, tool scope, argument shapes, risk, TTL (default max 300s), delegation depth (max 3), nonce |
| Worker plane and adapter-ops | **Ed25519** (`PRAETOR_CAPABILITY_PRIVATE_KEY_PEM` + JWKS + key id) | tenant, run, step, effect types, **request hash**, **action digest**, **policy snapshot**, workload, worker generation (fencing), nonce |

Only the Ed25519 path binds a request hash, action digest, and policy snapshot.
The HMAC path does not. HMAC token revocation is a **process-local in-memory
set** and does not survive a restart; durable replay and revocation stores exist
only on the Ed25519 path.

Never reuse the HMAC key for the worker plane. The two are deliberately separate
and the Ed25519 side refuses to start with placeholder or mismatched key
material in production.

## Evidence

Completed governed actions produce a signed evidence bundle:

<p align="center">
  <img src="/commander-crypto-gate.png" alt="Two-Phase Cryptographic Human Gate & RFC 7515 JWS Evidence Flow" width="100%" />
</p>

*Figure: Two-phase cryptographic human gate and JWS evidence lifecycle. Ensures non-repudiation and decoupling between untrusted LLM reasoning and production write authority.*

- **Signature:** Ed25519 over a canonicalized bundle body. Non-Ed25519 keys are
  rejected.
- **Bundle:** schema version, bundle id, action digest, terminal disposition,
  scope (tenant/run/effect), capability-grant identity, version pinning
  (policy snapshot, work-graph version, kernel API version), the effect list and
  audit-event list, and a content hash.
- **Integrity:** effects and audit events are each a SHA-256 **hash chain**
  (`entryHash` → `prevEntryHash`), plus a `contentHash` over the whole body,
  plus the signature.
- **Fail-closed:** verification checks both chains and the content hash before
  the signature. If a verifier is supplied, a signature is mandatory; an
  unsigned or invalid bundle reports `ok: false`.
- **Redaction:** chain-of-thought, prompt, and message fields are stripped;
  secret-shaped values (PEM blocks, `Bearer`, `sk_`, `ghp_`, `AKIA`, JWTs) are
  redacted; response summaries are restricted to a scalar allowlist.
- **Size cap:** 256 KiB when persisted.

The TypeScript SDK exposes `verifyActionEvidence()` to check Ed25519 JWS
receipts against a supplied JWKS.

## Sandboxing

**Profiles:** `read-only`, `workspace-write`, `full-access`, `hardened`.
`hardened` is workspace-write with proxied network, a staging directory, 512 MB
and 1 CPU limits, and a 120-second timeout. `PRAETOR_SANDBOX_MODE` can select
a profile but can never select `full-access`; `full-access` is forbidden in
production.

**Mechanisms.** The sandbox can discover `seatbelt` (macOS), `bwrap`, gVisor,
Docker, AppContainer, V8 isolate, TEE, and SSH backends. However,
`PRAETOR_SANDBOX_ISOLATION` accepts **only** `process`, `docker`, or
`gvisor`:

- Default is `docker` in production and staging, `process` in development and
  test.
- `process` is **rejected** in production as not an acceptable baseline.
- So the production-selectable baseline is **Docker or gVisor only**. Seatbelt
  and bwrap are discovered mechanisms, not selectable production isolations.

**Fail-closed behaviour.** If no OS-level sandbox is available, Praetor throws
`SandboxInitializationError` and refuses to run. The documented escape hatch is
`PRAETOR_ALLOW_NO_SANDBOX`, which is **forbidden in production**. In
production, Praetor also runs a startup probe under the selected mechanism and
refuses to start if the probe fails or the mechanism does not match policy. If
the escape detector itself cannot load, execution fails closed with exit code
126.

## Governed external writes

The effect broker is the only sanctioned path for external writes, and it runs
in two phases:

1. **`admit()`** — verify the capability token, check audience and effect-type
   membership, verify the request-hash binding and policy snapshot, check the
   tenant allowlist, evaluate the daily quota, evaluate kill switches, and
   record the effect. **Nothing is executed.**
2. **`executeAdmitted()`** — dispatch to the executor.

Policy returns `allow`, `deny`, or `require_approval`. A permit-all sentinel is
explicitly forbidden. Denials emit a high-severity `effect.rejected` audit event
and return a reason code such as `POLICY_DENIED`, `ACTION_NOT_ALLOWLISTED`,
`QUOTA_EXCEEDED`, `APPROVAL_REQUIRED`, `REQUEST_HASH_MISMATCH`,
`POLICY_SNAPSHOT_MISMATCH`, or `ACTION_DIGEST_REQUIRED`.

**Kill switches** can be scoped by `tenant`, `package`, `model`, `tool`,
`destination`, or `effect-type`.

**Compensation is best-effort, not guaranteed.** Compensation is itself a
governed effect run by a daemon, and it can end as `succeeded`, `handedOff`, or
`escalated`. Escalation happens when retries are exhausted or a deadline
expires. A separate `ReversibilityGate` blocks hardcoded irreversible tools
(`git_push`, `shell_execute`, `python_execute`, `web_fetch`, `mcp__*`, and
others) without human approval. Do not document or plan around guaranteed
rollback.

## Secret handling

- `EncryptedSecretsVault` encrypts secrets at rest with **AES-256-GCM**, using
  **HKDF-SHA-256** for per-secret, per-version key derivation, with a random IV
  and salt. It supports versioned rotation (up to 10 versions) and encrypted
  export.
- The vault is keyed by `PRAETOR_MASTER_KEY`. In production it refuses to
  start without it; outside production it generates an ephemeral key and warns.
- Provider keys are resolved vault-first, then from the environment.

**There is no global logger redaction.** Redaction is applied at specific call
sites:

- audit request bodies (sensitive keys replaced with `[REDACTED]`, body capped
  at 8,000 characters);
- evidence bundles (secret field names and secret-shaped values);
- the DLP module's `scan()` / `sanitize()` API across five exit points (API
  response, log output, tool result, agent output, SSE event).

Treat "secrets never appear in logs" as a process commitment you must enforce,
not as an enforced invariant of the platform.

## Injection, poisoning, and content scanning

Praetor ships a large set of defences. The notable ones:

| Concern | Module / control |
| --- | --- |
| Prompt injection and hidden content | `contentScanner` (hidden HTML/CSS, metadata and Unicode injection, data URLs, SVG) |
| Semantic injection | `mlInjectionDetector` (embedding-based) |
| Memory poisoning | `memoryPoisoningDefenseEngine` and `memoryPoisoningGate` — pre-write gate for injection, contradiction, repetition, and low credibility |
| Multi-layer write defence | `semanticFirewall` — sanitize, provenance, validate, quarantine, audit |
| Goal hijack | `goalHijackDetector` (OWASP ASI01) |
| Tool and MCP poisoning | `toolPoisoningGuard`, `mcpToolPoisoningGuard` |
| Runtime oversight | `guardianAgent` — semantic drift, anomaly, safety violation, cost overrun, goal hijack, behavioural deviation, tool-usage spike, data exfiltration, dangerous tool call |
| Egress control | `OutboundNetworkPolicy` — domain allow/deny, private-IP (SSRF) blocking, DNS-rebinding pinning, per-data-classification destinations |
| Coordinated defence | `enterpriseSecurityGateway` — 7 layers from zero-trust signature through output scanning |

Both an **OWASP Agentic AI Top 10** mapper (ASI01–ASI10) and a **MITRE ATLAS**
mapper (14 tactics, 60+ techniques) exist. They populate the security posture
reporting in the web console. That reporting is **reporting support, not
certification**.

## Network

- **CORS** is an allowlist and is never a wildcard. Credentials are only sent
  for allowlisted origins. Unset `CORS_ORIGINS` falls back to localhost and
  warns.
- **`TRUST_PROXY_HOPS`** defaults to trusting no proxy, so `X-Forwarded-For` is
  ignored. A malformed value aborts startup. Set it correctly behind a load
  balancer, or rate limiting and auth lockout will key on the proxy IP.
- **MCP stdio commands:** the API `/mcp` discovery path allows only `node`,
  `python`, and `python3`. The core MCP client allows `node`, `nodejs`,
  `python`, `python3`, `bun`, `deno`; **`npx` is always forbidden** and `uvx`
  requires `PRAETOR_MCP_ALLOW_UVX=1`. Inline-evaluation and module-loader
  flags (`-e`, `-c`, `--eval`, `--require`, `--loader`, `--inspect`) are
  rejected. `PRAETOR_MCP_ALLOWED_COMMANDS` extends the list.
- Security headers: `X-Powered-By` disabled, HSTS in production, CSP,
  `Referrer-Policy`, `Permissions-Policy`.

## Audit logging

- `SecurityEventType` covers sandbox violations, authentication success and
  failure, rate limiting, approval decisions, content threats, exec-policy
  violations, credential access, path traversal and command injection attempts,
  memory poisoning, config changes, key rotation, and more.
- Security events are written as **append-only NDJSON** under
  `.commander_security/`, with a 10,000-event in-memory ring buffer.
- All API `POST`/`PUT`/`PATCH`/`DELETE` requests are recorded as `user_action`
  with redacted bodies.
- **Tamper-evidence is opt-in.** With `PRAETOR_AUDIT_CHAIN_KEY` set, entries
  are chained with `HMAC-SHA-256` and verification detects modification,
  deletion, insertion, and reordering. An asymmetric L2 manifest (RSA-PSS) is
  available via `PRAETOR_AUDIT_MANIFEST_DIR`. **Without these, the audit log
  is append-only but not cryptographically chained.**
- Separately, `PRAETOR_INTEGRITY_KEY` adds an HMAC signature to every
  persisted WAL event. It is a different key from `PRAETOR_AUDIT_CHAIN_KEY` —
  do not conflate them.

## Rate limiting

Fixed 60-second window, `API_RATE_LIMIT` default 120 requests, with per-user and
per-tenant overrides that inherit the default. Tier multipliers: health
endpoints ×10, reads ×1, writes ×0.25. Counters live in PostgreSQL and are
updated atomically, so replicas cannot race; if the counter store is
unavailable, requests fail closed with **503**. Responses carry
`X-RateLimit-Limit`, `-Tier`, `-Remaining`, and `-Reset`.

The CLI separately limits costly commands to 10 LLM-costly invocations per
minute across processes.

## Production guards

These refuse to start or fail closed in production:

| Guard | Behaviour |
| --- | --- |
| `AUTH_DISABLED=true` | Returns **500** on every request. Never honoured in production |
| `PRAETOR_ALLOW_NO_SANDBOX` | Forbidden; sandbox initialization throws |
| `PRAETOR_ALLOW_UNCHECKED_EXEC` | Forbidden; escape detection fails closed |
| No durable store | Boot refused unless `API_STORE_BACKEND` or `DATABASE_URL` is set; escape hatch `PRAETOR_ALLOW_MEMORY_STORE=1` |
| Weak or missing secrets | `process.exit(1)` |
| Postgres TLS | Requires exactly `sslmode=verify-full`, a CA file, and a pinned 64-hex server SPKI SHA-256 |
| Capability authority | Refuses ephemeral or placeholder Ed25519 material |
| Sandbox isolation | `process` rejected; unknown values throw |

## Limits and honest caveats

This section exists because the rest of the page would otherwise overstate the
product.

1. **Alpha.** The repository states Praetor is not production-ready and that
   tenant isolation is not production-proven. Do not treat this page as a
   production security attestation.
2. **API keys use unsalted SHA-256**, not a memory-hard KDF. This is adequate
   for high-entropy random keys but is weaker than bcrypt or Argon2. Passwords,
   by contrast, use bcrypt.
3. **Praetor's own JWTs are HS256 symmetric.** There is no asymmetric option
   for access or refresh tokens; asymmetric verification exists only for OIDC ID
   tokens.
4. **HMAC capability-token revocation is not durable** and does not survive a
   restart.
5. **Compensation is not guaranteed**; it can escalate.
6. **No global log redaction.** Redaction is per call site.
7. **Audit tamper-evidence is opt-in** via `PRAETOR_AUDIT_CHAIN_KEY`.
8. **The API-key scope model is coarse** — only `read`, `write`, and `admin` can
   be minted, while routes check many finer strings that the creation API cannot
   produce.
9. **SCIM is file-backed** under `data/scim/<tenantId>`, not PostgreSQL.
10. **`/metrics` is authenticated** in the API's default-deny middleware, even
    though some documentation has listed it as public.

## Data and credentials

- Keep provider API keys and `PRAETOR_API_KEY` out of source control; prefer
  the encrypted vault.
- Restrict which tools can reach customer systems, and prefer `read-only` or
  `workspace-write` sandbox profiles.
- Review logs, retention, and backups for customer data before a pilot.
- Define deletion and incident-response procedures in advance. `POST
  /v1/privacy/erasure` submits an erasure request.

## Disclosure

Report vulnerabilities privately as described in the repository `SECURITY.md`.
Public issues are not an appropriate disclosure channel.

## Compliance

ISO 42001 and NIST AI RMF material in this project is **reporting support, not
certification**. Praetor does not claim a SOC 2 report, and the OWASP and MITRE
ATLAS mappings are defensive telemetry rather than an audited control set.