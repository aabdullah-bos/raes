# raes-execute

Run the next bounded slice of your RAES project — one at a time, with full artifact discipline and halt-on-ambiguity enforcement.

`raes-execute` is the execution engine of the RAES workflow. It reads `raes.config.yaml`, determines the next unchecked slice, and runs either an **Execution Loop** (implementation) or a **Review Loop** (decision/review) — enforcing artifact boundaries and stopping on any ambiguity before work advances.

---

## Why this exists

AI coding tools move fast.

But without guardrails they:
- drift from original intent as complexity grows
- mix constraints, rationale, and product goals across files
- skip ambiguity resolution and generate code on incomplete specs
- leave no audit trail of why decisions were made

You don't need more prompts.

You need **one slice at a time + artifact discipline + halt-on-ambiguity**.

`raes-execute` provides that discipline.

---

## What it does

Given:
- a RAES project initialized with `raes-init` (or a manually created `raes.config.yaml`)
- a configured AI provider (`anthropic`, `openai`, or `github_copilot`)

It:

1. Reads `raes.config.yaml` to locate all authoritative artifacts
2. Finds the next unchecked slice in `pipeline.md`
3. Determines loop type (Execution or Review) from the slice definition
4. Loads the canonical prompt and submits it to the configured provider
5. Records results in the correct artifact(s) only
6. Marks the slice complete and appends handoff notes

Artifact boundaries are enforced throughout — constraints cannot drift into rationale files, and intent cannot be mixed with execution guidance.

---

## Project layout

```
<project>/
├── raes.config.yaml          ← source map for all authoritative artifacts
└── docs/
    ├── prd.md                ← build intent (human-owned)
    ├── system.md             ← durable constraints and drift guards
    ├── pipeline.md           ← slice backlog and handoff state
    ├── decisions.md          ← rationale audit trail
    ├── execution-guidance.md ← workflow rules and anti-patterns
    └── validation.md         ← testing approach and validation commands
```

Use `raes-init` to generate this layout from a PRD or greenfield project.

---

## Quick start

### 1. Check your config

```bash
cd <your-raes-project>
raes-execute --check-config
```

Validates `raes.config.yaml` and confirms all six artifact paths exist. Fix any reported errors before proceeding.

### 2. See what's next

```bash
raes-execute --show-next-slice
```

Prints the next unchecked slice: type, goal, acceptance criteria, and related files.

### 3. Execute the slice

```bash
raes-execute --execute-next-slice
```

Runs the slice against your configured AI provider. The tool enforces the appropriate loop (Execution or Review), writes results to the correct artifacts, and marks the slice complete upon confirmation.

### 4. Check project status at any time

```bash
raes-execute --status
```

---

## CLI reference

```
Usage:
  raes-execute [options]

Options:
  -c, --check-config       Validate raes.config.yaml and all referenced artifact paths
  -s, --status             Show current project status: next slice, milestone, flags
  -l, --list-slices        List all pipeline slices with position, status, type, and label
  -n, --show-next-slice    Print full details of the next unchecked slice
  -p, --print-artifact     Print the content of a named RAES artifact to stdout
  -e, --execute-next-slice Execute the next unchecked slice (Execution or Review loop)
      --config             Use an explicit raes.config.yaml path
      --project            Select a project by name from raes.workspace.yaml
      --workspace          Path to raes.workspace.yaml (used with --project)
      --dry-run            Preflight --execute-next-slice without provider submission or writes
      --verbosity          Progress output: quiet | progress | debug
      --flag               Register an ambiguity, blocking issue, or known problem
      --history            List most recent N executed slices
      --version            Show version
  -h, --help               Show this help message
```

### Artifact names for `--print-artifact`

| Name | Artifact |
|---|---|
| `prd` | Build intent (`sources.build_intent`) |
| `system` | System constraints (`sources.system_constraints`) |
| `decisions` | Durable decisions (`sources.durable_decisions`) |
| `pipeline` | Slice backlog (`sources.next_slice.path`) |
| `execution-guidance` | Workflow rules (`sources.execution_guidance`) |
| `validation` | Validation commands (`sources.validation`) |

---

## Configuration

`raes.config.yaml` lives at the project root and tells `raes-execute` where each authoritative artifact lives and which AI provider to use.

```yaml
project:
  name: my-project

sources:
  build_intent: docs/prd.md
  system_constraints: docs/system.md
  next_slice:
    path: docs/pipeline.md
    selection_rule: first_unchecked_slice
  durable_decisions: docs/decisions.md
  execution_guidance: docs/execution-guidance.md
  validation: docs/validation.md

provider:
  name: anthropic          # anthropic | openai | github_copilot
```

All source paths are relative to the project root (the directory containing `raes.config.yaml`).

---

## Provider setup

### Anthropic (Claude)

```yaml
provider:
  name: anthropic
```

Requires the `claude` CLI and `ANTHROPIC_API_KEY` in your environment.

### OpenAI (GPT)

```yaml
provider:
  name: openai
  openai:
    transport: exec    # exec (default) or app_server
```

Requires the OpenAI CLI and `OPENAI_API_KEY` in your environment.

### GitHub Copilot

```yaml
provider:
  name: github_copilot
  github_copilot:
    transport: exec    # exec only; app_server is not supported
```

Requires the `copilot` CLI and an active Copilot subscription. Run `copilot auth login` before executing slices.

### Sandbox write access

```yaml
provider:
  name: anthropic
  sandbox:
    write_access: true    # default; set to false to restrict file writes
```

---

## Workspace support

For monorepos with multiple RAES projects, use a `raes.workspace.yaml` at the workspace root:

```yaml
projects:
  api:
    config: services/api/raes.config.yaml
  frontend:
    config: services/frontend/raes.config.yaml
```

Then target a specific project:

```bash
raes-execute --project api --execute-next-slice
raes-execute --project frontend --status
```

---

## Loop types

### Execution Loop

For implementation slices. Steps:

1. ANALYZE
2. PLAN
3. GENERATE
4. IMPLEMENT
5. TEST
6. EXPLAIN
7. FLAG
8. REVIEW
9. RECORD

The provider executes the loop, writes only to designated artifacts, and the operator confirms before the slice is marked complete.

### Review Loop

For review and decision slices. Steps:

1. PLAN
2. SLICE
3. INSPECT
4. SYNTHESIZE
5. FLAG
6. REVIEW
7. RECORD

The provider inspects authoritative artifacts, surfaces gaps, and records findings in `decisions.md`. No implementation code is written.

---

## Dry run

Preflight a slice execution without submitting to the provider or writing any files:

```bash
raes-execute --execute-next-slice --dry-run
```

Reports which slice would run, the loop type, provider, prompt path, and pipeline path.

---

## What makes this different

`raes-execute` is not:
- a code generator
- an agent framework
- a prompt optimizer

It is:

A system for ensuring AI-assisted development stays bounded, auditable, and aligned with original intent — one slice at a time.

---

## Design principles

- One slice per invocation
- Halt on ambiguity — never paper over uncertainty
- Artifact boundaries are non-negotiable
- Fail fast with actionable errors
- Human approves before any slice is marked complete

---

## Current scope

- Three providers: `anthropic`, `openai`, `github_copilot`
- Two loop types: Execution Loop, Review Loop
- Single-slice execution per invocation (no batch mode)
- Workspace support for monorepos
- TypeScript / Node.js runtime (Node 22+)

---

## License

MIT
