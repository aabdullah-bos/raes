# cli — system.template.md

## Purpose

This template defines default system rules for general-purpose CLI tools that:
- accept commands, subcommands, and flags
- read from configuration files
- interact with external systems (AI providers, file system, APIs)
- have explicit exit code contracts
- separate command parsing from business logic from I/O

It is intended to seed `docs/system.md` for a project.
It should be adapted to the project PRD rather than copied blindly.

---

## Product Invariants

Use these as defaults and revise them to match the project.

- The tool must behave predictably given the same configuration and state.
- The tool must validate all configuration and inputs before performing any side-effecting work.
- The tool must produce a non-zero exit code on any failure — never silent success after an error.
- Every error message must tell the operator what to do next, not just what went wrong.
- The tool must not silently ignore unrecognized arguments or unknown configuration keys.
- Partial state mutations must either be atomic, or leave enough trace for the operator to detect and recover from partial execution.

---

## Drift Guards

Use these to reduce execution drift.

- Command parsing, business logic, and I/O are separate layers. Do not conflate them.
- Configuration is read once at startup and validated before any side effects begin.
- Do not widen the command surface beyond what the current slice requires.
- Do not introduce new flags or subcommands speculatively.
- One slice per session. Stop after completing the slice.
- Implement the minimum code required to satisfy the current slice.
- Do not introduce abstractions for future commands or providers unless required by the current slice.
- Exit codes are a contract. Do not change them once established without an explicit decision.
- Do not silently promote an exploratory behavior into a durable command contract.

---

## Contracts

Adapt these to what is already known from the PRD and repository.

- Configuration file path and schema must be explicit before any reads are implemented.
- Exit code assignments must be explicit and recorded in `decisions.md` once introduced.
- The boundary between configuration reading and execution logic must be a named interface or function boundary.
- External system interactions (AI providers, file system mutations, APIs) must go through an explicit adapter or service boundary.
- State files written or modified by the tool must have an explicit format and write behavior (overwrite, append, or idempotent).

---

## Unknowns

Use this section to capture project-specific uncertainty.

Common unknowns for this archetype:
- exact configuration schema and required vs optional keys
- which external systems will be contacted and in what order
- retry and timeout behavior for external calls
- how partial failures are surfaced and recovered from
- whether the tool is intended for interactive or non-interactive use
- logging verbosity and output format (structured vs human-readable)
- whether the tool maintains local state between invocations
- how state consistency is validated before execution begins

Do not silently lock these down unless the PRD or operator has decided them.

---

## Anti-Patterns

- Do not mix command parsing with business logic.
- Do not read configuration after side effects have begun.
- Do not introduce multiple external providers or adapters speculatively.
- Do not silently widen the command surface mid-slice.
- Do not let exit code assignments become implicit — always record them explicitly.
- Do not build retry or fallback logic before the happy path is working.
- Do not blur temporary scaffold code and durable command contracts.

---

## Definition of Done

A slice is complete only if:
1. The exact slice was named explicitly at the start of the session.
2. Failing tests were written or updated first.
3. The minimum implementation required for the slice was completed.
4. Relevant tests passed.
5. Relevant typecheck passed.
6. No unrelated features or abstractions were introduced.
7. Known contracts remain aligned.
8. Exit code assignments and config schema decisions are recorded in `decisions.md`.
9. Any durable decision was recorded in `decisions.md`.
10. Handoff notes were appended to `pipeline.md`.
11. Work stopped after the slice was completed.

---

## Adaptation Notes

When turning this template into a project `system.md`:
- replace generic wording with the specific command surface from the PRD
- convert likely contracts into actual contracts where known
- add project-specific Unknowns from the PRD
- record any exit code assignments discovered during implementation into `decisions.md`
- remove defaults that do not apply
