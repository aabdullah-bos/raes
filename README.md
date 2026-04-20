# raes

**R**eusable **A**I **E**xecution **S**ystem for turning ambiguity into working code

Turn ambiguity into decisions, decisions into code, and code into learning   
RAES does not allow important decisions to remain implicit.

***RAES forces decisions instead of letting AI guess.***

---

## AI Execution Systems

AI Execution Systems are systems that control how AI performs work during execution by forcing decisions to be made, recorded, and reused, enforcing bounded progress, and preserving context over time. They exist to ensure that as AI generates code, the original intent remains aligned—despite ambiguity, iteration, and changing context.

Current approaches to AI-assisted development focus on prompts, specs, or autonomous agents. These improve speed and clarity, but they do not reliably prevent drift during execution. As a result, AI often produces code that is reasonable, but subtly misaligned with what was actually intended.

AI Execution Systems address this gap by introducing structured execution loops, explicit decision checkpoints, and durable context that persists beyond any single interaction.

---

## What is RAES?

**RAES** (Reusable AI Execution System) is a lightweight, portable implementation of an AI Execution System.

It separates decision-making from implementation, ensuring that important choices are made explicitly instead of being inferred during execution.

It allows:

- humans to define intent and resolve ambiguity
- AI to implement within controlled boundaries

RAES helps you:

- break work into small, testable slices
- enforce execution discipline (TDD, one slice at a time)
- surface ambiguity instead of hiding it
- force decisions before proceeding
- document decisions as they happen
- avoid drift between intention and implementation

---

## Why RAES?

AI-assisted development often breaks down because:

- the problem isn’t clearly defined
- the agent does too much, too fast
- decisions are made implicitly
- context is lost between iterations
- progress becomes hard to trust

Most tools optimize for **speed of execution**.

RAES optimizes for:
> **reliability of outcomes**
It does this by introducing:
> **structure, constraints, and feedback loops during execution—not just before it**

---

## The Two Slice Types

RAES supports two distinct slice types. Slice type determines execution rules.

### Execution Slice

Used for code changes, behavior changes, and any work verifiable by a passing test.

```
PLAN → SLICE → EXECUTE → TEST → EXPLAIN → FLAG → REVIEW → RECORD
```

Rules: write failing tests first, implement minimum code, run tests and typecheck, append handoff notes, stop after one slice.

### Review Slice

Used for PRD review, gap analysis, artifact generation, and any work whose output is a new durable artifact — not a code change.

```
PLAN → SLICE → INSPECT → SYNTHESIZE → FLAG → REVIEW → RECORD
```

Rules: inspect authoritative artifacts before writing anything, identify concrete gaps explicitly, produce bounded next slices, update pipeline, no implementation code.

Both slice types ensure that:

- work is bounded
- ambiguity is surfaced
- decisions are captured
- progress remains aligned

---

## The Key Idea

> Vibe coding optimizes for speed
> RAES ensures the result is actually right.

---

## What RAES Produces

A RAES project creates a `/docs` directory:

```
/docs
  prd.md                     # What are we building?
  system.md                  # What must remain true?
  pipeline.md                # What are we doing next?
  decisions.md               # What have we learned?
  prd-ux-review.md           # Where is UX ambiguous?
  execution-guidance.md      # How should slices be executed?
  validation.md              # How do we verify correctness?
  raes.config.yaml           # Where do authoritative sources live?
```

These documents are not just documentation.

They are your execution system — the durable context that guides every step.

`raes.config.yaml` is a thin source map. It routes the execution loop to the documents above. Config points to truth; it does not store truth.

---

## Getting Started (Manual)

1. Create a project with a PRD

2. Create `/docs`:

```
mkdir docs
touch docs/prd.md
touch docs/system.md
touch docs/pipeline.md
touch docs/decisions.md
touch docs/prd-ux-review.md
touch docs/execution-guidance.md
touch docs/validation.md
```

3. Use the RAES template to:
- define system constraints (`system.md`)
- generate a slice pipeline (`pipeline.md`)
- surface UX ambiguity (`prd-ux-review.md`)
- define execution rules (`execution-guidance.md`)
- define validation approach (`validation.md`)

4. Run the execution loop:

- one slice at a time
- tests first
- minimal implementation
- document decisions

---

## Example Execution Prompt

```
Read `docs/raes.config.yaml` first and use it to locate the authoritative
project artifacts for:
- build intent
- next slice
- execution guidance
- durable decisions
- validation guidance

Then inspect the repository and execute the next slice.

Execution rules:
- execute one slice only
- use the configured next-slice source as the source of truth for what to do next
- use the configured execution-guidance sources for constraints and definition of done
- use the configured durable-decisions source for decisions that must persist
- write failing tests first
- implement the minimum code required to make those tests pass
- run tests and typecheck using the project's existing tooling
- append handoff notes to the configured pipeline file
- append durable decisions to the configured decisions file only when needed
- stop immediately after completing the slice
- if required guidance is missing or ambiguous, flag it before proceeding
```

For projects without `raes.config.yaml`, inspect the repository for authoritative artifacts and treat what you find as the available truth.

See `docs/raes-reference.md` Section 6 for the full canonical prompt forms for both slice types.

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
- cli-doc-generator *(used to build raes-init)

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

- **Surface ambiguity**
- **Force decisions before execution**
- **Record decisions as part of the system**
- **Prefer small, reversible steps**
- **Separate intent from implementation**
- **Distribute decision-making between human and AI**

## Positioning

RAES is not:

- an autonomous agent  
- a prompt engineering technique  
- a spec generator

RAES is:
> **An execution control system for AI-assisted development**

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
