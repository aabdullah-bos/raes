# frontend-backend-ai-app — system.template.md

## Purpose

This template defines default system rules for projects that include:
- a frontend experience
- a backend or service layer
- interaction with an AI platform or model provider

It is intended to seed `docs/system.md` for a project.
It should be adapted to the project PRD rather than copied blindly.

---

## Product Invariants

Use these as defaults and revise them to match the project.

- The core user flow described in the PRD must remain intact unless explicitly changed.
- The frontend experience should remain understandable even when AI behavior is variable.
- AI behavior should support the product flow, not replace the product flow.
- The system should prefer explicit state and observable transitions over hidden behavior.
- The user should receive a legible response even when AI output is delayed, partial, or fails.

---

## Drift Guards

Use these to reduce execution drift.

- Shared types are the source of truth for data exchanged across boundaries.
- Do not couple frontend components directly to provider-specific AI payloads.
- Do not rename or reshape known request/response contracts without explicit decision.
- Mock or stub AI behavior in tests unless the slice explicitly concerns live integration behavior.
- Implement the minimum code required to satisfy the current slice.
- Keep one slice per session.
- Stop after completing the slice.
- Do not silently turn exploratory UX decisions into durable system patterns.
- Do not introduce abstractions for future providers or features unless required by the PRD or current slice.

---

## Contracts

Adapt these to what is already known from the PRD and repository.

- Frontend ↔ backend boundary should be explicit.
- AI platform interaction should occur through a backend route, service, or adapter layer.
- Request and response shapes used by the frontend should be stable once introduced.
- State transitions that affect UX should be named and testable.
- Error states visible to the user should have predictable shapes and messages.

---

## Unknowns

Use this section to capture project-specific uncertainty.

Common unknowns for this archetype:
- exact provider or model selection
- prompt structure and prompt ownership
- streaming vs non-streaming response behavior
- latency handling and loading states
- retry behavior
- fallback behavior when AI output is invalid or empty
- conversation/session memory behavior
- telemetry and logging requirements
- moderation or safety boundaries
- UX behavior around partial or failed generation

Do not silently lock these down unless the PRD or operator has decided them.

---

## Anti-Patterns

- Do not put provider-specific response logic directly into UI components.
- Do not make live AI calls part of default deterministic test runs.
- Do not introduce multiple AI providers “just in case.”
- Do not redesign architecture mid-slice.
- Do not silently widen scope from “AI-assisted feature” to “agent platform.”
- Do not let prompt structure become the only place where product logic lives.
- Do not blur temporary scaffolding and durable contracts.

---

## Definition of Done

A slice is complete only if:
1. The exact slice was named explicitly.
2. Failing tests were written or updated first.
3. The minimum implementation required for the slice was completed.
4. Relevant tests passed.
5. Relevant typecheck passed.
6. Known contracts remain aligned.
7. Any durable decision was recorded in `decisions.md`.
8. Handoff notes were appended to `pipeline.md`.
9. Work stopped after the slice was completed.

---

## Adaptation Notes

When turning this template into a project `system.md`:
- replace generic wording with project-specific user flow
- convert likely contracts into actual contracts where known
- add project-specific Unknowns from the PRD
- remove defaults that do not apply
