# Support and limits

## Support

Open a [GitHub issue](https://github.com/PStarH/Praetor/issues) for usage questions, proposals, and reproducible bugs. Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/PStarH/Praetor/security/advisories/new) as described in the repository `SECURITY.md`; do not open public vulnerability issues.

## Current limits

- The Local CLI is the supported default product path.
- The Enterprise Gateway is alpha and not production-proven for multi-tenant
  workloads.
- Provider responses and automated checks can fail; review consequential work
  before applying it.
- Benchmark fixtures and CI baselines are not customer SLAs or certifications.

## Enterprise readiness checklist

For technical due diligence, compliance reviews, and pilot sign-off, consult [ENTERPRISE_READINESS.md](https://github.com/PStarH/Praetor/blob/master/ENTERPRISE_READINESS.md) in the Praetor repository. It tracks the explicit status (✅ wired, 🟡 documented gap, ❌ pending) and line-level evidence pointers for SOC 2 controls, multi-tenancy isolation primitives, SLO baselines, and data governance.
