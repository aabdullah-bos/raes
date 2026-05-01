# raes-init

Generate a structured, constraint-driven project plan from a greenfield project or an existing PRD with no implementation.

`raes-init` is the entry point to the RAES workflow — a lightweight system for building software with AI **without drift**.

---

## Why this exists

AI coding tools are fast.

But they:
- change behavior unexpectedly
- expand scope without permission
- introduce new tools or patterns mid-stream
- break assumptions silently

You don’t need better prompts.

You need **constraints + structure + controlled execution**.

`raes-init` creates that structure.

---

## What it does

Given:
- a greenfield project or a PRD (`.md`) with no implementation
- a target project path
- an archetype (currently `cli-doc-generator`)

It generates a complete RAES docs set:

```
<target>/docs/
├── prd.md (if it does not exist)
├── system.md
├── pipeline.md
├── decisions.md
├── prd-ux-review.md
├── execution-guidance.md
├── validation.md
└── raes.config.yaml
```

---

## The idea

RAES is built around a simple loop:

1. Define constraints
2. Execute one small slice
3. Verify behavior
4. Stop

Repeat.

---

## Quick start

`raes-init` supports two modes.

### Bare greenfield — no PRD yet

```bash
raes-init <target-project-path> cli-doc-generator
```

Generates docs with section structure. `## Workflow Rules` is pre-populated with RAES system rules (constraint promotion, emergent work). Fill in the project-specific stubs (`## Invariants`, `## Anti-Patterns`, `## Definition of Done`) before running the first slice.

### PRD-seeded — you already have a PRD

```bash
# Set the inference provider before running
export RAES_PROVIDER=anthropic
export ANTHROPIC_API_KEY=sk-...

raes-init --from-prd <path-to-prd> <target-project-path> cli-doc-generator
```

Generates docs adapted from the source PRD. The PRD is copied verbatim to `docs/prd.md`; the other docs are populated with content derived from PRD sections.

### After init — execute with AI

```text
Read raes.config.yaml and use it to locate the authoritative project artifacts.
Execute the next unchecked slice using strict TDD. Stop after the slice.
```

---

## Environment variables

`--from-prd` selects an inference provider via environment variables. Provider config never lives in `raes.config.yaml` — it must stay portable and committable.

| Variable | Required | Description |
|---|---|---|
| `RAES_PROVIDER` | Yes (for `--from-prd`) | Provider to use: `anthropic`, `openai`, or `local` |
| `ANTHROPIC_API_KEY` | If `RAES_PROVIDER=anthropic` | Anthropic API key |
| `OPENAI_API_KEY` | If `RAES_PROVIDER=openai` | OpenAI API key |
| `RAES_LOCAL_ENDPOINT` | If `RAES_PROVIDER=local` | Base URL of an OpenAI-compatible endpoint (e.g. `http://localhost:11434/v1` for Ollama) |
| `RAES_MODEL` | No | Override the provider's default model |

**Provider defaults** (when `RAES_MODEL` is not set):

| Provider | Default model |
|---|---|
| `anthropic` | `claude-haiku-4-5-20251001` |
| `openai` | `gpt-4o-mini` |
| `local` | `llama3` |

`raes-init --from-prd` fails fast with a clear error before writing any files if `RAES_PROVIDER` is unset, unsupported, or missing its required credential.

---

## What makes this different

RAES is not:
- a framework
- a code generator
- a prompt library

It is:

A system for making AI behave like a disciplined engineer.

---

## Design principles

- Narrow first
- Explicit constraints
- One slice at a time
- Fail fast
- Human-readable output

---

## Current scope

- Greenfield or Single PRD input
- Single archetype: cli-doc-generator (Using raes to build raes)
- Create-or-fail writes
- Docs-only output (8 files, including `raes.config.yaml`)
- TypeScript / Node.js runtime

---

## Try it

Start with no PRD or one PRD.

Run one slice.

Don’t let the system drift.

---

## License

MIT
