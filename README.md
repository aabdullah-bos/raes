# raes
Reusable AI Execution System for turning ambiguity into working code

Turn ambiguity into:
**decisions → working code → documented learning**

---

## What is RAES?

RAES is a lightweight system for building software with AI.

It helps you:
- break work into small, testable slices
- enforce execution discipline (TDD, one slice at a time)
- surface ambiguity instead of hiding it
- document decisions as you go
- avoid drift between intention and implementation

---

## Why RAES?

Using AI to build software often breaks down because:

- the problem isn’t clearly defined
- the agent does too much, too fast
- decisions are made implicitly
- nothing is documented
- progress becomes hard to trust

RAES solves this by introducing:

> **structure, constraints, and feedback loops**

---

## The Core Loop

PLAN → SLICE → EXECUTE → TEST → EXPLAIN → FLAG → REVIEW → RECORD → REPEAT

---

## The Key Idea

> Vibe coding is just the execution loop.
> RAES adds everything around it.

---

## What RAES Produces

A RAES project creates a `/docs` directory:

/docs
  PRD.md                # What are we building?
  system.md             # What must remain true?
  pipeline.md           # What are we doing next?
  decisions.md          # What have we learned?
  prd-ux-review.md      # Where is UX ambiguous?

These documents become your **execution system**.

---

## Getting Started (Manual)

1. Create a project with a PRD

2. Create `/docs`:

mkdir docs
touch docs/PRD.md
touch docs/system.md
touch docs/pipeline.md
touch docs/decisions.md
touch docs/prd-ux-review.md

3. Use the RAES template to:
- define system constraints (`system.md`)
- generate a slice pipeline (`pipeline.md`)
- surface UX ambiguity (`prd-ux-review.md`)

4. Run the execution loop:

- one slice at a time
- tests first
- minimal implementation
- document decisions

---

## Example Execution Prompt

Read:
- docs/PRD.md
- docs/system.md
- docs/pipeline.md
- docs/decisions.md

Execute the next unchecked slice using strict TDD.

Rules:
- one slice only
- write failing tests first
- implement minimum code to pass
- run tests and typecheck
- append handoff notes
- append decisions
- stop after one slice

---

## RAES Template

See:

/template/RAES_Template.md

This is the source of truth for:
- workflow
- constraints
- structure

---

## Archetypes (WIP)

RAES supports example-based initialization using common project shapes:

- frontend-backend-ai-app
- ai-chat-experience
- ai-game-loop
- web-app-no-ai

These provide:
- default system rules
- common drift guards
- typical unknowns
- starter pipelines

---

## Roadmap

- `raes init` (CLI / generator)
- archetype library
- example projects
- interactive setup flow
- deeper UX integration

---

## Philosophy

RAES is designed around a few principles:

- **Make ambiguity visible**
- **Prefer small, reversible steps**
- **Separate intent from execution**
- **Document decisions as they happen**
- **Distribute judgment between human and AI**

---

## Why MIT?

RAES is designed to spread.

You are free to use, modify, and build on it without restriction.

If you find it useful, contribute back or share what you build.

---

## Status

Early, evolving, and actively being used to build itself.

---

## Author

Aquil Abdullah

## Why MIT?

RAES is designed to spread.

You are free to use, modify, and build on it without restriction.

If you find it useful, contribute back or share what you build.