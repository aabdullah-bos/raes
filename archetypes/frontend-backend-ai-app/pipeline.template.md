# frontend-backend-ai-app — pipeline.template.md

This template defines a default execution shape for projects with:
- a frontend
- a backend or service layer
- an AI interaction boundary

It is intended to seed a project-specific `docs/pipeline.md`.
Adapt it to the PRD and repository before using it for execution.

---

## Purpose

- Maintain consistency across independent execution sessions
- Prevent drift between product intent, contracts, and implementation
- Keep slices small, testable, and reviewable
- Preserve a clear boundary between UX, backend logic, and AI integration

---

## Invariants

### Product Invariants
Copy these into the project pipeline only after adapting them to the PRD.

- The core user flow must remain intact unless explicitly changed.
- The frontend should remain legible even when AI behavior is variable.
- AI interaction should support the product loop rather than redefine it.

### Drift Guards
- One slice per session
- Tests before implementation
- Implement the minimum code required to pass
- Shared types are the source of truth
- Do not reshape known contracts without explicit decision
- Do not couple the UI directly to provider-specific payloads
- Do not use live AI calls in deterministic tests by default
- Stop after slice completion

---

## Known Contract Areas

Use this section to list what is already known.

Typical areas:
- frontend display/input contract
- backend route or service contract
- request/response shapes
- state transitions
- error shapes
- AI adapter boundary

Replace these placeholders with project-specific details.

---

## Unknowns

List project-specific unknowns here.

Typical Unknowns for this archetype:
- model/provider choice
- prompt ownership
- streaming behavior
- retry/fallback behavior
- memory/session model
- UX around loading, partial output, and failure
- telemetry and logging details

If a slice touches an Unknown:
- prefer minimal implementation
- avoid hardening it into a reusable pattern too early
- flag the decision in handoff notes

---

## Suggested Milestone Shape

Adapt these milestones to the project.

### Milestone 1 — Product Skeleton
- [ ] establish minimal frontend shell for the core user flow
- [ ] establish minimal backend/service entry point
- [ ] establish shared types or boundary models where needed

### Milestone 2 — Happy Path Without Live AI
- [ ] implement frontend input/output flow against deterministic stubbed behavior
- [ ] implement backend route/service with mockable AI dependency
- [ ] verify state transitions and request/response shapes

### Milestone 3 — Project-Specific Core Loop
- [ ] implement the main product interaction loop from the PRD
- [ ] add slice-by-slice UX validation for major transitions
- [ ] tighten tests around core path behavior

### Milestone 4 — Real AI Integration
- [ ] connect backend/service layer to the chosen AI platform
- [ ] handle loading, timeout, and failure behavior
- [ ] ensure provider-specific behavior stays behind the adapter/boundary layer

### Milestone 5 — Polish and Hardening
- [ ] resolve major Unknowns that surfaced during execution
- [ ] tighten contracts and error handling
- [ ] review PRD, UX notes, and decisions for drift

---

## Session Workflow

Every execution session should:

1. Read `docs/PRD.md`, `docs/system.md`, `docs/pipeline.md`, and `docs/decisions.md`
2. Identify the first unchecked slice
3. Name the slice explicitly
4. Write failing tests
5. Implement the minimum code required to pass
6. Run relevant tests and typecheck
7. Append handoff notes
8. Mark the slice complete
9. Append durable decisions to `docs/decisions.md`
10. Stop

---

## Testing Rules

- Prefer deterministic behavior by default
- Mock or stub AI dependencies unless the slice is explicitly about integration behavior
- Validate contract shapes strictly
- Test visible state transitions explicitly
- Cover user-visible loading and failure states when introduced
- Avoid making external provider behavior a prerequisite for core UI tests

---

## Definition of Done Per Slice

A slice is complete only when:
1. The exact slice was named explicitly at the start of the session
2. Failing tests were written or updated before implementation
3. The minimum implementation required to satisfy those tests was completed
4. Relevant tests passed
5. Relevant typecheck passed
6. No unrelated features or abstractions were introduced
7. Known contracts remain aligned
8. `docs/pipeline.md` was updated with handoff notes
9. `docs/decisions.md` was updated only if a durable decision was made
10. Work stopped after the slice was completed

---

## Handoff Notes (Append Only)

Add session-specific implementation notes here after adapting this template into a real project pipeline.
