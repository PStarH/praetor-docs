# Praetor Docs

The public VitePress documentation for Praetor.

## Development

```bash
npm install
npm run locales:gen
npm run ci
```

The English root pages are canonical. `npm run locales:gen` creates matching
pages for Chinese, Japanese, Korean, Spanish, and French. Keep commands,
ports, security limits, and evidence claims identical across every locale.

## Public documentation boundary

- Praetor API: `http://localhost:4000`
- Praetor web interface: `http://localhost:3000`
- Enterprise Gateway: alpha; not production-proven multi-tenant SaaS
- Benchmarks: regression evidence, not production SLAs or certifications

Do not add internal plans, unverified competitive comparisons, demo security
sign-offs, or fragile test-count marketing to this repository.
