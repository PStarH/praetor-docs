# Tools

> This page is synchronized from the canonical English documentation. Español navigation is available; commands and product limits are identical in every locale.

Praetor exposes **18 built-in tools** to the model, plus any MCP-compatible
external tools you connect. Meta-tools are opt-in and are not part of the 18.

Tools are registered in `createAllTools()` in
`packages/core/src/tools/index.ts`. Ten of them are STRAP-consolidated *resource*
tools — that is, one domain-level tool with an `action` parameter, rather than a
dozen granular CRUD tools. This is deliberate: large tool counts degrade model
tool selection.

## The 18 built-in tools

| Tool | Category | What it does |
| --- | --- | --- |
| `file` | filesystem | Read, write, edit, search, list, and glob files. Choose the operation with `action` |
| `memory` | memory | Persistent key-value memory: store, recall, list keys |
| `web` | web | Search the web or fetch content from URLs |
| `browser` | web | Drive a browser to search the web or fetch pages |
| `code` | code | Search, refine, and fix code |
| `checkpoint` | workflow | Save, rewind, list, and collapse conversation checkpoints |
| `handoff` | development | Hand a task to another agent, or check handoff status |
| `exec` | code | Execute Python, shell, or JavaScript scripts |
| `media` | multimodal | Analyze images, capture screenshots, extract PDF text |
| `system` | control | Request human input, or retrieve a tool schema on demand |
| `git` | development | Run git operations: status, log, diff, branch, blame, add, commit, push, pull. Do not use shell pipes — use git flags (`-n 20`, not `\| head -20`) |
| `verify` | code | Run linters, type checkers, and test runners; returns structured pass/fail with error counts |
| `apply_patch` | code | Apply a unified diff patch to a file, validated before it is applied |
| `file_hash_edit` | filesystem | Content-hash-anchored file editing (drift-proof). Preferred over plain edit |
| `lsp` | development | Language Server Protocol diagnostics and attachment |
| `verify_answer` | control | Verify that a final answer matches a required format |
| `skill_view` | skills | Load full skill instructions by name from the available-skills catalog |
| `search_conversations` | memory | Full-text (FTS5) search across past conversations, ranked by relevance |

## Trust tiers

Every tool has a trust tier, `trusted` or `untrusted`. Tools that ingest
external data default to **untrusted**:

- Untrusted: `web`, `browser`, `media`, `skill_view`, `search_conversations`, and
  every MCP-prefixed tool (`mcp_*`) or tool in the MCP category.
- Trusted: `file`, `memory`, `code`, `checkpoint`, `handoff`, `system`, `git`,
  `apply_patch`, `verify_answer`, `exec`, `verify`, `agent`, `meta`, and the
  granular file operations.

Resolution order is: an explicit `trustTier` on the tool, then the `mcp_`
prefix or MCP category, then the defaults table, then **fail closed to
untrusted**.

## Tool exposure over MCP

When Praetor's tools are exposed to an external MCP client, a dangerous subset
is filtered out unless the caller opts in with `allowDangerousTools`:

`exec`, `git`, `apply_patch`, `file`, `file_hash_edit`, `system`, `verify`,
`code`, and `refine_code`.

See [MCP](/mcp#tool-safety-filtering) for the full picture.

## Meta-tools

Meta-tools are **not** registered by default. Enable them with
`createAllTools({ enableMetaTools: true })`; they wrap other tools as
sub-tools. Shell-equivalent tools are excluded from the sub-tool map so a
meta-tool cannot be used to bypass exec policy.

## External tools

MCP-compatible external tools appear with an `mcp_` prefix and are always
treated as untrusted. Configure them through the MCP surfaces described in
[MCP](/mcp).