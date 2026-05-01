# cli — pipeline.template.md

## Purpose

This template defines the execution structure for general-purpose CLI tools that:
- accept commands, subcommands, and flags
- read from configuration files
- interact with external systems (AI providers, file system, APIs)
- maintain state across invocations

It is intended to seed a project-specific `docs/pipeline.md`.
Adapt it to the PRD and repository before using it for execution.

---

## Invariants

### Product Invariants

Copy these into the project pipeline only after adapting them to the PRD.

- The tool must behave predictably given the same configuration and state.
- Configuration validation must complete before any side effects begin.
- The tool must exit with a non-zero code on any failure.
- Partial state mutations must be detectable and recoverable.

### Drift Guards

- One slice per session.
- Tests before implementation.
- Implement the minimum code required to pass.
- Command parsing, business logic, and I/O remain separate layers.
- Do not widen the command surface beyond the current slice.
- Exit codes are a contract — record them in `decisions.md` when introduced.
- Do not use live external calls in deterministic tests by default.
- Stop after slice completion.

---

## Known Contract Areas

Use this section to list what is already known.

Typical areas:
- configuration file path and schema
- command and subcommand surface
- exit code assignments
- state file locations and write behavior
- external system adapter boundary
- error output format

Replace these placeholders with project-specific details.

---

## Unknowns

List project-specific unknowns here.

Typical unknowns for this archetype:
- exact configuration schema
- retry and timeout behavior for external calls
- how partial failures surface and recover
- whether the tool is interactive or non-interactive
- logging verbosity and output format
- state consistency validation before execution

If a slice touches an Unknown:
- prefer minimal implementation
- avoid hardening it into a reusable pattern too early
- flag the decision in handoff notes

---

## Suggested Milestone Shape

Adapt these milestones to the project.

### Milestone 1 — Configuration and Entry Point

- [ ] Slice 1: Establish the CLI entry point with command parsing.
- [ ] Slice 2: Define and load the configuration file schema.
- [ ] Slice 3: Validate configuration and fail fast with a clear error when required keys are missing or invalid.

### Milestone 2 — Happy Path Without Live External Calls

- [ ] Slice 4: Implement the core command flow against deterministic stubbed dependencies.
- [ ] Slice 5: Establish the adapter boundary for each external system.
- [ ] Slice 6: Verify state reads and writes against the defined schema.
- [ ] Slice 7: Confirm exit code behavior on success and known failure cases.

### Milestone 3 — Core Execution Loop

- [ ] Slice 8: Implement the primary business logic loop from the PRD.
- [ ] Slice 9: Add slice-by-slice validation for major state transitions.

### Milestone 4 — Real External Integration

- [ ] Slice 10: Connect the adapter layer to the real external system.
- [ ] Slice 11: Handle timeout, retry, and failure behavior.

### Milestone 5 — Polish and Hardening

- [ ] Slice 12: Resolve major Unknowns that surfaced during execution.
- [ ] Slice 13: Tighten exit code contracts and error messages.
- [ ] Slice 14: Review PRD, operator experience notes, and decisions for drift.

---

## Session Workflow

Every execution session should:

1. Read `docs/prd.md`, `docs/system.md`, `docs/pipeline.md`, and `docs/decisions.md`
2. Identify the first unchecked slice
3. Name the slice explicitly
4. Write failing tests
5. Implement the minimum code required to pass
6. Run relevant tests and typecheck
7. Append handoff notes to `pipeline.md`
8. Mark the slice complete
9. Append durable decisions to `docs/decisions.md`
10. Stop

---

## Testing Rules

- Prefer deterministic behavior by default
- Mock or stub external dependencies unless the slice is explicitly about integration behavior
- Validate configuration schema and error cases explicitly
- Test exit code behavior for each known failure mode
- Test state file writes for correctness and idempotency where required
- Cover partial failure scenarios when state mutation is involved

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

## Handoff Notes

Append session-specific implementation notes here after adapting this template into a real project pipeline.
