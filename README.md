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

## The Core Loop

PLAN → SLICE → EXECUTE → TEST → EXPLAIN → FLAG → REVIEW → RECORD → REPEAT

This loop ensures that:

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

/docs
  PRD.md                # What are we building?
  system.md             # What must remain true?
  pipeline.md           # What are we doing next?
  decisions.md          # What have we learned?
  prd-ux-review.md      # Where is UX ambiguous?

These documents are not just documentation.

They are your execution system—the durable context that guides every step.

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
