# Support and limits

> This page is synchronized from the canonical English documentation. 日本語 navigation is available; commands and product limits are identical in every locale.

## Support

Use GitHub Discussions for usage questions and GitHub Issues for reproducible
bugs. Report vulnerabilities privately using the contact instructions in the
repository `SECURITY.md`; do not open public vulnerability issues.

## Current limits

- The Local CLI is the supported default product path.
- The Enterprise Gateway is alpha and not production-proven for multi-tenant
  workloads.
- Provider responses and automated checks can fail; review consequential work
  before applying it.
- Benchmark fixtures and CI baselines are not customer SLAs or certifications.

## Enterprise readiness checklist

For technical due diligence, compliance reviews, and pilot sign-off, consult [ENTERPRISE_READINESS.md](https://github.com/PStarH/Commander/blob/master/ENTERPRISE_READINESS.md) in the Commander repository. It tracks the explicit status (✅ wired, 🟡 documented gap, ❌ pending) and line-level evidence pointers for SOC 2 controls, multi-tenancy isolation primitives, SLO baselines, and data governance.