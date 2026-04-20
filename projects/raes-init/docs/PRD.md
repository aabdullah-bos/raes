# RAES Init — PRD (v1)

## Purpose

Create a simple tool that initializes a new project using the RAES framework.

The tool should take a PRD and an archetype, and generate a set of project-specific execution documents that enable immediate development using RAES.

---

## Problem

Starting a new project with RAES currently requires:

- manually creating multiple documents
- interpreting the RAES template
- deciding how to structure system definition and pipeline
- translating a PRD into slices

This creates friction and inconsistency.

---

## Goal

Enable a user to go from:

PRD → usable RAES project setup

in one step.

---

## Target User

- Developers building AI-enabled applications
- Product-oriented engineers
- Users familiar with RAES or similar workflows

---

## Core Functionality

### 1. Input

The system accepts:

- Project name
- PRD (text or file)
- Archetype selection:
  - frontend-backend-ai-app
  - ai-chat-experience
  - ai-game-loop
  - web-app-no-ai
- Optional notes (freeform)

---

### 2. Output

The system generates a `/docs` directory containing:

- prd.md (copied or normalized)
- system.md
- pipeline.md
- decisions.md
- prd-ux-review.md

All files must be:

- human-readable markdown
- editable
- not over-specified

---

### 3. system.md Generation

Combine:

- archetype defaults
- PRD-derived constraints

Include:

- Product Invariants
- Drift Guards
- Known Contracts
- Unknowns
- Anti-Patterns
- Definition of Done

Do NOT fabricate unknown information.

---

### 4. pipeline.md Generation

Generate a project-specific pipeline that includes:

- Purpose
- Invariants (derived from system.md)
- Known Contracts
- Unknowns
- Slice backlog organized by milestone

Slices must be:

- small
- testable
- sequential

---

### 5. prd-ux-review.md Generation

Extract from PRD:

- ambiguous interactions
- UX risks
- open questions

Focus on:

- transitions
- timing
- user expectations

---

### 6. decisions.md Initialization

Create empty decision log with header.

---

## Non-Goals (v1)

- No code generation
- No repo scaffolding (beyond docs)
- No automatic UI/backend setup
- No enforcement of tooling (React, Node, etc.)
- No persistence or database setup

---

## Success Criteria

- User can immediately begin RAES execution loop
- Generated pipeline is usable without major rewriting
- System definition captures real constraints without overreach
- User does not feel blocked by missing structure

---

## UX Principles

- Fast to start
- Minimal required input
- Transparent output (no black box)
- Editable over perfect

---

## Open Questions

- Should PRD be required or optional?
- How opinionated should archetypes be?
- Should the tool ask follow-up questions (v2)?
- How should examples influence generation?

---

## Future Extensions (Not v1)

- Interactive init (guided questions)
- Archetype auto-detection from PRD
- Code scaffolding
- Integration with Git
- Web interface
- Template versioning

---
