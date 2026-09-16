#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const locales = ['zh', 'ja', 'ko', 'es', 'fr']
const pages = [
  'index.md',
  'getting-started.md',
  'cli.md',
  'api.md',
  'configuration.md',
  'architecture.md',
  'web-console.md',
  'packages.md',
  'deployment.md',
  'operations.md',
  'security.md',
  'sdk.md',
  'troubleshooting.md',
  'benchmarks.md',
  'support.md',
  'tools.md',
  'providers.md',
  'mcp.md',
  'workflows.md',
]
const errors = []

for (const locale of locales) {
  for (const page of pages) {
    if (!existsSync(join(root, locale, page))) errors.push(`missing ${locale}/${page}`)
  }
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (['.git', '.vitepress', 'node_modules', '.omo'].includes(name)) continue
    const file = join(dir, name)
    if (statSync(file).isDirectory()) walk(file, out)
    else if (file.endsWith('.md') || file.endsWith('.mts')) out.push(file)
  }
  return out
}

const forbidden = [
  [/localhost:3001/, 'Commander API must not use port 3001'],
  // Legacy versioned aliases are not a public integration surface. The current
  // observability router is legitimately mounted under the same prefix.
  [/\/api\/v1(?!\/observability)/, 'legacy API routes are not public documentation'],
  // Match a port followed by the path (an actual endpoint URL), so that prose
  // explaining the correct name is not flagged.
  [/\d\/readyz|\d\/livez/, 'readiness is /ready — there is no /readyz or /livez route'],
  [/6700\+ tests/, 'fragile test-count marketing is not a public claim'],
  [/OpenClaw|PinchBench/, 'unverified competitive benchmark claim'],
  [/100% defense/i, 'benchmark claim needs an evidence level, not an absolute'],
]

for (const file of walk(root)) {
  const text = readFileSync(file, 'utf8')
  for (const [pattern, message] of forbidden) {
    if (pattern.test(text)) errors.push(`${relative(root, file)}: ${message}`)
  }
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`Validated ${pages.length} public pages in ${locales.length + 1} locales.`)
