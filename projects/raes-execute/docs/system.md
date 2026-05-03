# raes-execute — system.md

## Purpose

This document defines the execution rules for `raes-execute`.

The project is initialized from the PRD `RAES Execute` using the `cli` archetype.

## Product Invariants

- The tool must behave predictably given the same configuration and state.
- Configuration validation must complete before any side effects begin.
- The tool must exit with a non-zero code on any failure.
- Partial state mutations must be detectable or must not occur.

## Drift Guards

- Command parsing, business logic, and I/O are separate layers. Do not conflate them.
- Configuration is read once at startup and validated before any side effects begin.
- Do not widen the command surface beyond what the current slice requires.
- One slice per session. Stop after completing the slice.
- Exit codes are a contract. Do not change them once established without an explicit decision.

## Known Contracts

- Configuration file path and schema must be explicit before any reads are implemented.
- Exit code assignments must be recorded in `decisions.md` when introduced.
- External system interactions must go through an explicit adapter or service boundary.
- State files written or modified by the tool must have an explicit format and write behavior.

## Unknowns

- Exact configuration schema and required vs optional keys.
- Retry and timeout behavior for external calls.
- How partial failures are surfaced and recovered from.
- Whether the tool maintains local state between invocations.
- Logging verbosity and output format.

## Anti-Patterns

- Do not mix command parsing with business logic.
- Do not read configuration after side effects have begun.
- Do not introduce external adapters or providers speculatively.
- Do not let exit code assignments become implicit — always record them explicitly.
- Do not blur temporary scaffold code and durable command contracts.

## Definition of Done

1. The exact slice was named explicitly.
2. Failing tests were written or updated first.
3. The minimum implementation required for the slice was completed.
4. Relevant tests and typecheck passed.
5. Exit codes and config schema decisions are recorded in `decisions.md`.
6. Any durable decision was recorded in `decisions.md`.
