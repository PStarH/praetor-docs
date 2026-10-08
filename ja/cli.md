# CLI reference

> This page is synchronized from the canonical English documentation. 日本語 navigation is available; commands and product limits are identical in every locale.

Praetor's Local CLI is the primary supported interface. Run it from a source
checkout:

```bash
pnpm exec tsx packages/core/src/cliEntry.ts <command> [flags]
```

Or, after `pnpm build`, via the installed binary:

```bash
commander <command> [flags]
```

`commander help --all` lists everything. `commander <command> --help` shows the
flags for one command.

## Command profiles

Every command belongs to a profile. The CLI never routes to the Enterprise
Gateway — that path is `POST /v1/runs`.

| Profile | Meaning |
| --- | --- |
| `local` | Supported local behaviour |
| `local·exp` | Experimental one-run-model verbs: `company`, `swarm`, `drive`, `goal` |

## Core execution

| Command | Purpose |
| --- | --- |
| `run <task> [flags]` | Execute a task with the full multi-agent pipeline |
| `review [flags]` | AI code review with P0–P3 findings |
| `fix [--test]` | Auto-fix lint, formatting, and type errors |
| `company <task>` | Company Engine: capability matching + quality gating + memory (`local·exp`) |
| `swarm <task> [flags]` | Recursive swarm: fission (decompose) + fusion (merge) (`local·exp`) |
| `drive <task> [flags]` | Autonomous step-by-step drive loop (`local·exp`) |
| `goal <subcommand>` | Multi-round goal execution with an independent judge (`local·exp`) |

### `goal` subcommands

| Subcommand | Purpose |
| --- | --- |
| `judge <task>` | Judge a task against the configured stop conditions |
| `conditions list` | List all global stop conditions |
| `conditions set` | Add or update a condition |
| `conditions delete` | Remove a condition by `--delete=<id>` |
| `conditions clear` | Remove all conditions |

`conditions set` flags: `--add=<id>`, `--desc=<text>`,
`--type=<MUST_HAVE|MUST_NOT_HAVE|MUST_MATCH|MUST_BE_ABOVE|CUSTOM>`,
`--pattern=<regex>`, `--threshold=<N>`, `--custom=<prompt>`.

```bash
commander goal conditions set --add=no-ts --desc="No TS errors" --type=MUST_NOT_HAVE --pattern="error TS"
commander goal judge "Fix all TypeScript errors in src/"
```

### `run` flags

| Flag | Meaning |
| --- | --- |
| `--dry-run` | Show the plan without executing |
| `--stream` | Real-time SSE progress streaming |
| `--tui` | Terminal dashboard with live topology view |
| `--mode=<mode>` | `balanced` (default), `fast`, `thorough`, `goal` |
| `--provider=<name>` | Force a provider (`openai`, `anthropic`, `deepseek`, …) |
| `--budget=<tokens>` | Token budget (default `100000`) |
| `--max-rounds=<n>` | Max rounds, goal mode only (default `10`) |

### `review` flags

| Flag | Meaning |
| --- | --- |
| `--commit [sha]` | Review a specific commit, or the latest |
| `--branch` | Review the whole branch against main |
| `--base <ref>` | Compare against a specific ref |
| `--real` | Require a real provider; never fall back to heuristics |
| `--provider=<name>` | Provider to use with `--real` |
| `--json` | JSON output |
| `--guidelines <rules>` | Extra rules, pipe-separated |

With `--real`, at most 15,000 diff characters are sent, the response is capped
at 4,000 tokens and 8 MiB, and transport aborts after 120 seconds. Guidelines are
collected from `AGENTS.md`, `.review.md`, `REVIEW.md`, `.github/review.md`, and
`.commander/review.md`, capped at 1,000 characters combined.

### `swarm` flags

| Flag | Meaning |
| --- | --- |
| `--max-depth=<n>` | Max tree depth (default `3`) |
| `--max-workers=<n>` | Max parallel workers (default `10`) |
| `--mode=<balanced\|thorough\|fast>` | Execution mode |

### `drive` flags

| Flag | Meaning |
| --- | --- |
| `--mode=<auto\|supervised>` | Drive mode |
| `--iterations=<n>` | Max iterations (default `20`) |
| `--verbose` | Detailed output |

## Setup and configuration

| Command | Purpose |
| --- | --- |
| `init [flags]` | Zero-config scan, provider connectivity tests, fallback chain → `.commander.json` |
| `quickstart` | Upgraded alias for `init` (`--check` keeps the legacy checklist) |
| `status` | Provider, API keys, runtime, and meta-learner stats |
| `config <sub>` | `show`, `set <key> <val>`, `list-providers`, `list-models`, `test` |
| `doctor [--offline]` | Diagnostics: Node, API key, packages, git, workspace, connectivity |
| `mode [mode]` | Show or set the approval mode |
| `completion [shell]` | Shell completion: `bash`, `zsh`, `fish`, `install` |

`init` flags: `--skip-tests`, `--timeout=<ms>` (default `5000`), `--save`.
`doctor` flags: `--offline` / `--no-network` skip provider connectivity and make
the API key optional.

### Approval modes

| Mode | Behaviour |
| --- | --- |
| `plan` | Analysis only, no modifications |
| `read-only` | No writes, no destructive operations |
| `suggest` | Prompts before risky operations |
| `auto-edit` | Allows most operations, flags sandbox escapes |
| `full-auto` | No approval gates |

## Interfaces

| Command | Purpose |
| --- | --- |
| `gui` | Start the Agent War Room dashboard (API `4000` + web `5173`) |
| `up [task] [flags]` | Unified execution + web TUI on a local server (default port `4000`) |

`up` flags: `--port=<n>`, `--no-open`, `--resume`.

`viz` is registered as a command but is **not usable**: it spawns
`packages/viz/dist/index.js`, and there is no `packages/viz` workspace package in
this repository, so the spawned process cannot start. Use `run --tui` or the web
console for topology views instead.

## History, cost, and observability

| Command | Purpose |
| --- | --- |
| `history [sub]` | List sessions; `view <runId>`, `delete <runId>`, `prune <keep>` |
| `cost [flags]` | Token usage and cost reports (`--format=table\|json\|csv`, `--since`, `--model`, `--provider`) |
| `budget [runId]` | Real-time token budget status per run and sub-agent |
| `checkpoint [runId] [flags]` | MiMo-style checkpoint documents (`--prune N`) |
| `jobs [jobId] [flags]` | Background tasks: list, inspect (`--logs`), stop (`--stop`) |
| `debug intent [runId]` | Why the agent made a decision — the full decision chain |
| `diagnose [--json]` | V2 distributed stack health: kernel, worker plane, storage, security posture |

## Durability and recovery

| Command | Purpose |
| --- | --- |
| `saga <sub>` | Durable compensating transactions: `run`, `list`, `status`, `resume`, `approve`, `reject`, `examples` |
| `resume [runId]` | Resume a crashed run from its last checkpoint |
| `compensation [sub]` | Compensation queue: `status`, `list`, `retry <id>` |

`saga run` flags: `--input=<json>`, `--run-id=<id>`, `--timeout=<ms>` (default
`60000`), `--in-memory`.
`compensation list` flags: `--limit=<n>` (default `50`), `--status=<pending|in_progress|escalated>`.

## Learning and feedback

| Command | Purpose |
| --- | --- |
| `intelligence [flags]` (alias `i`) | What Praetor has learned: `--stats`, `--skills`, `--patterns`, `--all` |
| `experience [sub]` | `status` (default) or `reset` (`--skills`, `--patterns`, `--meta`, `--force`) |
| `feedback [flags]` | Submit feedback: `--rating=<1-5>`, `--message`, `--bug`, `--feature`; `stats` subcommand |
| `skill <sub>` | `list`, `view <name>`, `create <name>`, `pin`, `unpin`, `delete`, `curate` |
| `plugin <sub>` | `install <source>`, `list`, `uninstall <name>`, `info <name>` |

## Automation and integration

| Command | Purpose |
| --- | --- |
| `schedule <sub>` | Recurring tasks: `list`, `add <name> <task>` (`--cron` / `--every`), `remove`, `enable`, `disable` |
| `workflow <sub>` (alias `wf`) | `ls`, `run <id>`, `create <name>`, `schedule`, `unschedule`, `pause`, `resume`, `history`, `daemon`, `stop` |
| `webhook <sub>` | `list`, `add <source> --events <list> --task <t>`, `remove <id>`, `start [--port=9876]` |
| `notify <message> [flags]` | Send a notification: `--slack`, `--discord`, `--webhook`, `--priority=<low\|normal\|high\|urgent>` |
| `action <sub>` | Action Gateway operations from the CLI (see below) |
| `sandbox [status]` | Show sandbox availability, mechanisms, and profiles |
| `security <sub>` | Adversarial batteries: `redteam`, `compliance-audit`, `adversarial-llm`, `hard-adversarial`, `unknown-adversarial` |

`action` requires `PRAETOR_API_KEY` and a reachable Action Gateway
(`PRAETOR_ACTION_GATEWAY_URL`), and takes a subcommand:

| Subcommand | Purpose |
| --- | --- |
| `simulate --data=<json>` | Simulate an action without executing it (requires `idempotencyKey`) |
| `propose --data=<json>` | Propose an action (requires `idempotencyKey`) |
| `get <runId>` | Action state for a run |
| `approve <runId>` \| `reject <runId>` | Record a decision |
| `compensation request <runId>` \| `compensation approve <runId> <authorizationId>` | Compensation flow |
| `reconcile <runId>` | Reconcile a run |
| `evidence verify <runId>` | Fetch and verify the signed evidence bundle. Fails if verification fails |
| `kill list` \| `kill enable` \| `kill disable` | Manage kill switches |

Anything else prints the usage line and exits. A validation error exits `2`; any
other failure exits `1`.

`sandbox` accepts only `status`, which reports whether an OS-level sandbox is
available, the detected mechanisms, and the profiles `read-only`,
`workspace-write`, `full-access`, and `hardened`. Any other subcommand is
rejected.

## Global behaviour

- `--version` / `version` prints the version and active profile. The active
  profile is always `local`; the CLI never routes to the Enterprise Gateway.
- `--help` / `help` prints the command list; `help --all` expands it. `<command>
  --help` prints the detail for one command.
- Costly commands are rate-limited to 10 LLM-costly invocations per minute
  across processes. Exceeding it prints a rate-limit error and exits `1`.
- `PRAETOR_THEME` selects the terminal colour theme.
- Unknown commands exit with status `1` and suggest a command whose name starts
  with the same prefix. The suggestion is a prefix match, not a fuzzy match, so
  a typo in the middle of a word produces no suggestion.
- Errors print a message and suggest running `commander doctor` and
  `commander quickstart`.

## Not reachable from the CLI

Several command handlers are exported from the CLI package but are **not wired
into the dispatcher**, so they are not documented above and do not run:
`ask`, `diff`, `undo`, `approval-history`, `pr`, `commit`, `explain`, `test`,
`refactor`, `learn`, and `monitor`.