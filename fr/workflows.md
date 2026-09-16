# Workflows and automation

> This page is synchronized from the canonical English documentation. Français navigation is available; commands and product limits are identical in every locale.

Commander has four overlapping automation surfaces. They are independent of each
other and persistence differs between them, so pick deliberately:

| Surface | Command | Best for |
| --- | --- | --- |
| Workflows | `commander workflow` (alias `wf`) | Named, reusable multi-step workflows with a scheduler daemon |
| Scheduler | `commander schedule` | Simple recurring tasks on a cron or interval |
| Webhooks | `commander webhook` | Event-driven tasks from GitHub, GitLab, Bitbucket, or a custom source |
| Background jobs | `commander jobs` | Inspecting and stopping tasks already running in the background |

## Workflows

`commander workflow` (alias `wf`) manages named workflows and the scheduler
daemon that runs them.

| Subcommand | Purpose |
| --- | --- |
| `ls` | List available and scheduled workflows |
| `run <id>` | Execute a workflow now |
| `create <name>` | Scaffold a new workflow; `--description=` and `--cron=` |
| `schedule <id>` | Schedule a workflow; `--cron="…"` or `--interval="30m"` |
| `unschedule <id>` | Remove a schedule (`rm` is an alias) |
| `pause <id>` \| `resume <id>` | Pause or resume a schedule |
| `history [wfId]` | Show execution history (`log` is an alias) |
| `daemon` | Start the scheduler daemon (`start` is an alias) |
| `stop` | Stop the scheduler daemon |

```bash
commander workflow create nightly-audit --description="Nightly repo audit" --cron="0 2 * * *"
commander workflow schedule nightly-audit --cron="0 2 * * *"
commander workflow history nightly-audit
commander workflow daemon
```

The workflow HTTP API lives under `/api/workflows` and covers CRUD plus
`POST /api/workflows/:id/execute` for immediate execution. See
[HTTP API](/api#product-api-families).

## Scheduler

`commander schedule` is the lighter option for a single recurring task.

| Subcommand | Purpose |
| --- | --- |
| (none) \| `list` | List scheduled tasks |
| `add <name> <task>` | Add a task with `--cron="0 2 * * *"` or `--every="30m"` |
| `remove <id>` | Remove a scheduled task |
| `enable <id>` | Enable a task |
| `disable <id>` | Disable a task |

```bash
commander schedule add nightly-test "run the full test suite" --cron="0 3 * * *"
commander schedule list
commander schedule disable nightly-test
```

## Webhooks

`commander webhook` reacts to inbound events.

| Subcommand | Purpose |
| --- | --- |
| (none) \| `list` | List webhook rules |
| `add <source> --events <list> --task <t>` | Add a rule. Sources: `github`, `gitlab`, `bitbucket`, `custom` |
| `remove <id>` | Remove a rule |
| `start [--port=9876]` | Start the webhook receiver (default port `9876`) |

```bash
commander webhook add github --events=push,pull_request --task="review the diff"
commander webhook start --port=9876
```

Outbound webhooks are configured through the API under
`/api/outgoing-webhooks`, which provides CRUD, delivery statistics, and a
delivery log.

## Background jobs

`commander jobs` inspects what is already running.

```bash
commander jobs                 # list recent background jobs
commander jobs <jobId>         # show job details
commander jobs <jobId> --logs  # show the last 50 log lines
commander jobs <jobId> --stop  # stop a running job
```

## Notifications

`commander notify <message>` sends a notification through a configured channel.

| Flag | Purpose |
| --- | --- |
| `--slack` | Send via Slack |
| `--discord` | Send via Discord |
| `--webhook` | Send via a custom webhook |
| `--priority=<level>` | `low` \| `normal` \| `high` \| `urgent` |

Webhook delivery uses exponential backoff with retries at 1s, 5s, and 15s.

## Approval interaction

Automated runs still pass through the same approval model as interactive ones.
`commander mode [mode]` shows or sets the approval mode — `plan`, `read-only`,
`suggest`, `auto-edit`, or `full-auto`. See [CLI reference](/cli#approval-modes).

## Operational notes

- The scheduler daemon is a foreground process. Run it under a supervisor if you
  want scheduled workflows to survive a restart.
- `pause` and `resume` act on the schedule, not on an in-flight run. To stop a
  run that is already executing, use `commander jobs <jobId> --stop`.
- Workflow, schedule, and webhook state is held in local Commander state. It is
  not a multi-replica authority — see
  [Operations and rollback](/operations#data-recovery).