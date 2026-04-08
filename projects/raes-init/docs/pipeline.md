# RAES Init — Slice Pipeline

This document defines how implementation work is executed for `raes-init`.

It adapts the `cli-doc-generator` pipeline shape to the `raes-init` PRD and is the authoritative slice backlog for the project.

---

## Purpose
- Turn a target PRD plus archetype selection into a usable RAES docs set in one step
- Keep implementation incremental, testable, and easy to review
- Preserve product intent while making uncertainty visible
- Prevent scope drift into code scaffolding or over-engineered template systems

## Invariants

### Product Invariants
- Output must be valid, human-readable markdown
- Generated docs must remain editable without special tooling
- Generation must reflect the input PRD and selected archetype rather than inventing product details
- V1 output is limited to docs generation only

### Drift Guards
- One slice per session
- Tests before implementation where applicable
- Implement the minimum code required to pass
- Do not silently fill in unknown contracts
- Do not treat archetype defaults as project truth
- Do not expand into repo scaffolding, code generation, or interactive flows in V1

## Known Contracts
- V1 accepts one project name, one PRD file path input, and one explicit archetype selection
- The output docs set includes `PRD.md`, `system.md`, `pipeline.md`, `decisions.md`, and `prd-ux-review.md`
- The `cli-doc-generator` archetype is the default execution shape for initial implementation
- `system.md` and `pipeline.md` must adapt to the input PRD rather than copy templates verbatim
- Optional notes and inline PRD text input are out of scope for the first happy path
- If any target output doc already exists, V1 must fail fast instead of overwriting or merging files

## Unknowns
- Exact CLI command shape and argument names
- How much PRD restructuring is appropriate during normalization
- Whether V1 should stop on missing sections or continue with explicit gaps

## Slice Backlog

### Milestone 1 — Establish a Single Happy Path
- [ ] Accept one project name, one PRD file input, and one explicit archetype selection
- [ ] Exclude optional notes and inline PRD text input from the first happy path
- [ ] Load the `cli-doc-generator` archetype templates and validate they exist
- [ ] Generate the five required docs into a target project's docs directory only when none of those target docs already exist

### Milestone 2 — Adapt Output to PRD Content
- [ ] Derive `system.md` sections from archetype defaults plus PRD-specific constraints
- [ ] Derive `pipeline.md` with a small sequential backlog tied to the PRD
- [ ] Derive `prd-ux-review.md` with explicit ambiguities, risks, and open questions from the PRD

### Milestone 3 — Make Unknowns and Failures Explicit
- [ ] Preserve unresolved unknowns in generated output instead of filling gaps heuristically
- [ ] Add validation errors for missing required inputs or missing archetype templates
- [ ] Validate and test the fail-fast behavior when output docs already exist

## Session Workflow
1. Read `projects/raes-init/docs/PRD.md`, `projects/raes-init/docs/system.md`, `projects/raes-init/docs/pipeline.md`, and `projects/raes-init/docs/decisions.md`
2. Identify the first unchecked slice
3. Name the slice explicitly
4. Write failing tests
5. Implement the minimum code required to pass
6. Run relevant tests and typecheck
7. Append durable decisions if any were made
8. Mark the slice complete
9. Stop

## Definition of Done Per Slice
A slice is complete only when:
1. The exact slice was named
2. Tests were written first where applicable
3. Minimum implementation was completed
4. Relevant output or validation behavior was verified
5. No unrelated files were changed
6. Unknowns were preserved explicitly
7. Durable decisions were recorded if needed
8. Work stopped after slice completion

## Handoff Notes (Append Only)
