# raes-execute — system.md

## Purpose

This document defines the execution rules for `raes-execute`.

The project is initialized from the PRD `RAES Execute` using the `cli` archetype.

## Product Invariants

- The tool must behave predictably given the same configuration and state.
- Each CLI invocation executes exactly one bounded slice of work.
- Artifacts are updated only in their correct roles as defined by RAES reference.
- The tool does not merge, overwrite, or reinterpret artifact files outside strict RAES rules.
- Configuration validation must complete before any side effects begin on every invocation.
- Any ambiguity, missing artifact, or boundary violation halts execution until a human resolves it.
- The tool must exit with a non-zero code on any failure, and partial state mutations must be detectable or prevented.

## Drift Guards

- Command parsing, business logic, and I/O are separate layers. Do not conflate them.
- Configuration is read once at startup and validated before any side effects begin.
- Before and during execution, the tool validates artifact boundaries and constraint promotion mismatches explicitly.
- All artifact writes are atomic; temp-file or equivalent transactional patterns are required.
- Core RAES execution flow cannot be bypassed; every slice runs either the Execution Loop or Review Loop in full.
- Do not widen the command surface beyond what the current slice requires.
- One slice per session. Stop after completing the slice.
- Exit codes are a contract. Do not change them once established without an explicit decision.

## Known Contracts

- Configuration file path and schema must be explicit before any reads are implemented.
- Exit code assignments must be recorded in `decisions.md` when introduced.
- External system interactions must go through an explicit adapter or service boundary.
- State files written or modified by the tool must have an explicit format and write behavior.
- The configured pipeline artifact is the source of truth for slice order and completion status.
- The child provider/agent may append operational notes or findings to artifacts in their correct RAES roles, but only the parent loop may mark a slice complete in the backlog, and only after explicit operator confirmation.

## Unknowns

- Retry and timeout behavior for external calls.
- How partial failures are surfaced and recovered from beyond atomic-write failure handling and exit codes.
- Whether v1 needs separate local state/history files beyond the configured RAES artifacts.
- Logging verbosity and machine-readable output format for future history/export surfaces.

## Anti-Patterns

- Do not mix command parsing with business logic.
- Do not read configuration after side effects have begun.
- Do not introduce external adapters or providers speculatively.
- Do not let exit code assignments become implicit — always record them explicitly.
- Do not blur temporary scaffold code and durable command contracts.
