# raes-init

Generate a structured, constraint-driven project plan from a single PRD.

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
- a PRD (`.md`)
- a target project path
- an archetype (currently `cli-doc-generator`)

It generates a complete RAES docs set:

```
<target>/docs/
├── PRD.md
├── system.md
├── pipeline.md
├── decisions.md
└── prd-ux-review.md
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

### 1. Write a PRD

```markdown
# My Project

## Core Functionality
- Accept a file input
- Generate output files

## Constraints
- Must be CLI-based
- Must not overwrite existing files

## Open Questions
- How strict should validation be?
```

### 2. Run raes-init

```bash
raes-init <path-to-prd> <target-project-path> cli-doc-generator
```

### 3. Execute with AI

```text
Read these files first and treat them as authoritative:
- <project>/docs/PRD.md
- <project>/docs/system.md
- <project>/docs/pipeline.md
- <project>/docs/decisions.md

Then inspect the repository and execute the next unchecked slice using strict TDD.
```

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

## Current scope (V1)

- Single PRD input
- Single archetype: cli-doc-generator
- Create-or-fail writes
- Docs-only output
- TypeScript / Node.js runtime

---

## Try it

Start with one PRD.

Run one slice.

Don’t let the system drift.

---

## License

MIT
