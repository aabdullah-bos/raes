# raes-init — system.md

## Purpose

This document defines the project rules for `raes-init`.

`raes-init` is a CLI-oriented document generator that turns a project PRD plus an archetype into a usable RAES docs set:

- `prd.md`
- `system.md`
- `pipeline.md`
- `decisions.md`
- `prd-ux-review.md`

For V1, the default execution shape is the `cli-doc-generator` archetype. The system should adapt that archetype to the input PRD rather than copy template text mechanically.

---

## Product Invariants

- The tool generates human-readable, human-editable markdown files.
- Generated docs must preserve the PRD's intent and constraints without replacing them.
- Unknown or ambiguous product details must remain visible in the output.
- Output must stay specific to the target project, not generic to the archetype.
- V1 is docs-only. It does not scaffold application code, repo structure beyond docs, or runtime services.
- The generated docs must be sufficient to start the RAES execution loop for the target project.

---

## Drift Guards

- Do not fabricate missing requirements, UX details, or technical constraints.
- Do not silently widen the V1 input contract beyond the defined happy path.
- Treat the archetype templates as defaults, not as project truth.
- Prefer explicit, deterministic generation over heuristic inference.
- Preserve a clear separation between:
  - source PRD intent
  - archetype defaults
  - project-specific adaptation
- Fail fast when file write behavior is undefined or unsafe.
- Keep the initial slice backlog small, sequential, and testable.
- The first implementation slice must prove the narrow happy path end to end.
- Do not introduce multi-archetype orchestration, interactive prompting, or merge strategies in V1 unless explicitly decided later.
- Do not introduce implementation languages outside the defined project runtime

---

## V1 Happy-Path Input Contract

### Required Inputs

- One readable source PRD markdown file path
- One target project path
- One archetype identifier

### V1 Supported Happy Path

- Source PRD input mode: file path only
- Source PRD format: markdown document with enough product intent to derive project docs
- Target output location: `<target-project-path>/docs/`
- Supported archetype in the initial slice: `cli-doc-generator`

### Explicit Constraints

- Inline PRD text is out of scope for the initial slice.
- Automatic archetype selection is out of scope for the initial slice.
- Optional notes are not part of the narrow happy path.
- The system may validate the PRD file exists and is readable, but it should not require deep semantic parsing in the first slice.

---

## File Write Behavior

V1 file generation behavior is intentionally narrow and fail-fast.

### Output Set

The generator is responsible for producing these files under `<target-project-path>/docs/`:

- `prd.md`
- `system.md`
- `pipeline.md`
- `decisions.md`
- `prd-ux-review.md`
- `execution-guidance.md`
- `validation.md`
- `raes.config.yaml`

### Write Rules

- `docs/`:
  - Create if missing
  - Reuse if already present and none of the required generated files exist
- `prd.md`:
  - Create from the source PRD file in the happy path, or as a stub in bare greenfield mode
  - Fail if `prd.md` already exists at the target path
  - Do not overwrite
  - Do not merge
- `system.md`, `pipeline.md`, `decisions.md`, `prd-ux-review.md`, `execution-guidance.md`, `validation.md`, `raes.config.yaml`:
  - Create if absent
  - Fail if any already exist
  - Do not overwrite
  - Do not merge

### Atomicity Expectation

- If any required target file already exists, the run should fail before partial generation.
- V1 should prefer no-write failure over partial overwrite or best-effort merge behavior.

---

## Known Contracts

- Input is a PRD file path, not a conversational prompt.
- Output is a project-local docs set under a target `/docs` directory.
- The default execution shape is derived from the `cli-doc-generator` archetype.
- Generated markdown must remain editable and legible.
- `system.md` must include:
  - product invariants
  - drift guards
  - known contracts
  - unknowns
  - anti-patterns
  - definition of done
- `pipeline.md` must include a small, sequential backlog where the first slice establishes the narrow happy path end to end.
- `prd-ux-review.md` must surface ambiguity, risks, and open questions rather than silently closing them.
- `decisions.md` stores only durable decisions, not temporary execution notes.
- V1 runtime and test toolchain are TypeScript running on Node.js.
- Implementation files for `raes-init` must live under `projects/raes-init/`.
- Project-local dependencies and package metadata must live under `projects/raes-init/`.
- Do not place `raes-init` source files, tests, caches, or dependency directories at the repository root.

---

## Unknowns

- Whether future versions should accept inline PRD text in addition to file input
- Whether archetype selection should remain explicit or default silently
- How much structure should be extracted from a weak or incomplete PRD
- Whether source PRD content should be copied verbatim, normalized lightly, or reorganized
- How template adaptation should be implemented without becoming too opinionated
- Whether future versions should support overwrite confirmation or merge behavior
- What validation is required before generation beyond file existence and readability
- When the tool should stop and ask for clarification instead of generating docs with explicit unknowns

---

## Anti-Patterns

- Do not treat archetype template wording as final project output without adaptation.
- Do not silently invent contracts for CLI flags, parsing depth, or project structure.
- Do not add code scaffolding, stack assumptions, or framework-specific guidance to the generated docs.
- Do not broaden V1 to support multiple input modes in the first slice.
- Do not overwrite existing docs as a convenience.
- Do not turn unknowns into implied decisions.
- Do not create a large backlog before the narrow happy path is proven.

---

## Definition of Done

A slice is complete only if:

1. The slice delivers a single, explicit outcome.
2. The behavior is testable and bounded.
3. The implementation preserves the V1 input and write contracts.
4. Generated docs are project-specific, readable, and editable.
5. Unknowns remain visible instead of being fabricated.
6. Any durable new rule is appended to `decisions.md`.
7. Work stops after the slice is complete.
