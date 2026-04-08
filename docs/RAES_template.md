# Reusable AI Execution System (RAES) Template

## Deployment Guidance

Use this template to instantiate RAES for a new project.

When starting from an existing PRD:

1. Create the following files in `/docs`:
   - `PRD.md`
   - `system.md`
   - `pipeline.md`
   - `decisions.md`
   - `prd-ux-review.md`

2. Copy this template into `pipeline.md` unless a project-specific pipeline already exists.

3. Treat `PRD.md` as the source of product intent.

4. Help the operator create `system.md` by identifying:
   - Product Invariants
   - Drift Guards
   - Contracts that are already known
   - Unknowns that should not be silently decided
   - The explicit V1 happy-path input contract (if applicable)
   - The intended file write behavior (create / fail / overwrite / merge)

5. Generate an initial slice backlog in `pipeline.md` based on the PRD and current system definition.

6. Do not assume missing contracts are fully known.
   Mark uncertainty explicitly and prefer minimal, reversible early slices.

7. Default to a narrow, explicit starting configuration.
   Do not silently expand inputs, capabilities, or behaviors beyond what is defined.

The operator is responsible for:
- supplying or approving the PRD
- approving product invariants
- approving major system constraints
- reviewing flagged decisions

RAES is responsible for:
- surfacing ambiguity
- proposing structure
- generating slices
- preserving execution discipline

---

## Overview
RAES is a system for turning ambiguity into:
decisions → working code → documented learning

It is designed to optimize for:
- Momentum
- Recoverability
- Legible decision-making

---

## Core Loop
PLAN → SLICE → EXECUTE → TEST → EXPLAIN → FLAG → REVIEW → RECORD → REPEAT

---

## Pillars
- Decomposition (slices)
- Constraint (rules + TDD)
- Execution Loop (agent)
- Interpretability (clear explanations)
- Decision Loop (review + action)
- Memory System (pipeline + decisions)

---

## Directory Structure
/docs
  PRD.md
  system.md
  pipeline.md
  decisions.md
  prd-ux-review.md

/src
/tests

---

## 1. Bootstrap Phase

### Environment Validation
- Ensure project runs
- Ensure tests can execute

### Test Infrastructure
- Establish baseline tests
- Define test types (unit/integration)

### Observability
- Logging
- Error visibility

### Slice Calibration
- Define what “small enough” means
- Define “definition of done”

---

## 2. PRD

### Purpose
Define intent, not just mechanics

### Include
- Problem statement
- Target user
- Success criteria

### Experience Intent (for key features)
Example:
- Urgent but not stressful
- Clear transitions
- Focused interaction

---

## 3. PRD UX Interrogation

Create: docs/prd-ux-review.md

For each feature:
- Ambiguities
- Risks
- Proposed intent
- Open questions

Goal:
Make UX gaps visible, not fully solved

---

## 4. System Definition

Create: `docs/system.md`

This document defines the project rules that protect intent and reduce execution drift before slice work begins.

### Product Invariants
These define what the product is allowed to be.

Examples:
- Core user flow must remain intact unless explicitly changed
- Scope boundaries for the current version must be honored
- UX intent for key moments should not be silently reinterpreted

### Drift Guards
These define how work is allowed to happen.

Examples:
- Shared types are the source of truth for payloads
- Do not rename or reshape existing contracts without explicit decision
- Implement the minimum code required to pass
- One slice per session
- Stop after completing a slice
- Do not silently widen input modes beyond the defined happy path
- Fail fast when encountering undefined overwrite or file write behavior

### Contracts
Define the interfaces that must remain stable unless explicitly changed.

Examples:
- API payload shapes
- Shared type definitions
- State transition rules
- Input contract (e.g., PRD file path vs inline input)
- Output file write behavior (create / fail / overwrite / merge)

### Anti-Patterns
Document behaviors the agent should avoid.

Examples:
- Do not redesign architecture mid-slice
- Do not introduce abstractions just in case
- Do not silently resolve consequential ambiguity

### Definition of Done
Define what must be true before a slice is considered complete.

---

## 5. Pipeline (Slices)

Each slice must be:
- Small
- Testable
- Clear

Example:
[ ] Add 45-second timer
    - Starts on load
    - Visible countdown
    - Triggers transition

---

## 6. Execution Prompt

Read (project-specific docs):
- docs/PRD.md
- docs/system.md
- docs/pipeline.md
- docs/decisions.md

Rules:
- One slice only
- Write failing tests first
- Minimal implementation
- Run tests + typecheck
- No regressions
- Mark slice complete

If unclear:
- Split slice before proceeding

---

## 7. Slice Reflection (Required)

## Slice Reflection

### What changed
...

### What was expected
...

### What actually happened
...

### Gaps / surprises
...

### Confidence
High / Medium / Low

---

## 8. Experience Check

### Experience Check (non-testable)

- Does this align with intended experience?
- Any UX risks?

---

## 9. Decision Flags

## ⚠️ Decision Flag

### Change
...

### Why it was done
...

### Expected impact
...

### Reversibility
High / Medium / Low

### Confidence
...

### What to ask next
- ...

---

## 10. Signal Compression

## Summary

Status: PASS / FAIL / UNCERTAIN
Risk: LOW / MEDIUM / HIGH
Recommendation: CONTINUE / ADJUST / STOP

---

## 11. Milestone Review (Every 3–5 slices)

## Milestone Reflection

- Are we building the right thing?
- Has the problem changed?
- Tech debt?
- Continue / Pivot / Refactor

Add:
If we stopped today, what would be missing?

---

## 12. Decision Log (decisions.md)

Record:
- What was decided
- Why
- Alternatives considered
- Patterns emerging

---

## 13. Operator Review Model

Operator reviews:
- Flag summaries
- High-risk decisions

Operator actions:
- Continue
- Adjust
- Refactor
- Revisit PRD

---

## 14. Safeguards

- If >5 unresolved flags → pause
- If confidence = low → flag
- If ambiguity high → do not silently decide

---

## 15. Principles

- Momentum with recoverability
- Explain first, classify second
- Make ambiguity visible
- Distinguish product constraints from execution drift controls
- Prefer reversible decisions
- Protect UX from invisibility

---

## 16. System Goal

Distribute judgment between human + AI
without losing coherence