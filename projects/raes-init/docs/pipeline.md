# raes-init — pipeline.md

## Purpose

This pipeline defines the smallest useful execution path for `raes-init`: turn one PRD markdown file plus the `cli-doc-generator` archetype into a usable RAES docs set in the target project path.

The backlog stays intentionally narrow until the end-to-end happy path is proven.

---

## Invariants

### Product Invariants

- Output must be valid, readable markdown.
- Generated docs must be editable by humans.
- The output must reflect the source PRD and surface uncertainty explicitly.
- The system remains docs-only in V1.

### Drift Guards

- One slice per session.
- Minimal implementation only.
- No fabrication of missing product details.
- No overwrite or merge behavior in V1.
- Do not introduce implementation languages outside the defined project runtime.
- Stop after slice completion.

---

## Known Contracts

- Input mode for V1 happy path: one readable PRD markdown file path
- Target location: one target project path with docs written to `<target>/docs/`
- Supported archetype for the initial slice: `cli-doc-generator`
- Required generated files:
  - `PRD.md`
  - `system.md`
  - `pipeline.md`
  - `decisions.md`
  - `prd-ux-review.md`
- Write behavior:
  - create missing docs directory
  - create required files if absent
  - fail before writing if any required target file already exists
- V1 runtime and test toolchain are TypeScript on Node.js.

---

## Unknowns

- How strict PRD validation should be in V1
- How much PRD normalization is desirable before writing `PRD.md`
- Whether archetype selection remains explicit after V1
- Whether future versions should support follow-up prompts for missing detail
- Whether overwrite behavior should ever be supported

---

## Initial Slice Backlog

### Milestone 1 — Narrow Happy Path

- [x] Slice 1: Generate the RAES docs set from one PRD file and the `cli-doc-generator` archetype into a target docs path
  - Accept one readable PRD file path
  - Accept one target project path
  - Accept one archetype value constrained to `cli-doc-generator`
  - Create `<target>/docs/` if needed
  - Generate `PRD.md`, `system.md`, `pipeline.md`, `decisions.md`, and `prd-ux-review.md`
  - Fail before writing if any required target file already exists
  - Verify the generated docs are readable and project-specific

### Milestone 2 — Minimal Validation

- [x] Slice 2: Add explicit validation and error messages for missing input, unreadable PRD path, unsupported archetype, and conflicting target files
  - Keep validation deterministic
  - Do not add interactive prompts

### Milestone 3 — Template Adaptation Quality

- [ ] Slice 3: Improve PRD-to-doc adaptation so generated docs better distinguish known contracts, unknowns, and project-specific constraints
  - Preserve the narrow write contract
  - Avoid generic template leakage into outputs

### Milestone 4 — PRD Review Quality

- [ ] Slice 4: Improve `prd-ux-review.md` extraction for ambiguity, operator risk, and open questions in CLI-oriented workflows
  - Focus on user expectations, transitions, and failure moments
  - Keep the review concise and reviewable

---

## Testing Rules

- Validate file creation for the full docs set.
- Validate that generation fails when any target output file already exists.
- Validate that only `cli-doc-generator` is accepted in the initial slice.
- Validate that generated markdown remains deterministic enough for review without depending on brittle full-file string equality.

---

## Definition of Done

A slice is complete only when:

1. The stated slice outcome is working end to end.
2. The behavior is covered by appropriate validation or tests.
3. The output set and write contract are preserved.
4. No unrelated files are changed.
5. The slice is marked complete.
6. Work stops after the slice.

---

## Handoff Notes

- The first slice should resist the urge to support inline PRDs, auto-detected archetypes, or overwrite logic.
- Future expansion should come only after the narrow happy path is stable and reviewable.
- 2026-04-08: Slice 1 was implemented as a small Python module with a thin CLI entry point and a direct `generate_docs(...)` function so the write contract can be tested without adding packaging or framework overhead.
- 2026-04-08: Tests cover exactly the slice-1 contract: happy-path generation, rejection of unsupported archetypes, and fail-before-write behavior when any required target file already exists.
- 2026-04-08: Generated docs are intentionally narrow and deterministic. They copy `PRD.md` verbatim, derive the project name from the target path, and seed the other docs from the PRD title plus a few extracted bullet points without deeper parsing.
- 2026-04-08: Slice 1 was initially proven with a minimal Python implementation, but the project now defines TypeScript on Node.js as the V1 runtime and test toolchain. Slice 1 is reopened so the implementation matches the system constraints.
- 2026-04-08: Slice 1 is now implemented under `projects/raes-init/` as a TypeScript-on-Node module with a thin local CLI entry point and project-local `package.json`.
- 2026-04-08: The slice-1 tests run with Node's built-in test runner against `.ts` files directly, which keeps setup minimal while staying inside the defined runtime and toolchain.
- 2026-04-08: The implementation keeps PRD handling intentionally shallow in V1: `PRD.md` is copied verbatim, project identity comes from the target path, and other generated docs are seeded from the PRD title plus a few extracted bullet points.
- 2026-04-08: Slice 2 adds explicit validation messages for missing CLI input, unreadable PRD paths, unsupported archetypes, and conflicting target files without changing the create-or-fail write contract.
- 2026-04-08: A minimal project-local TypeScript setup was added (`tsconfig.json` plus a `typecheck` script), but typecheck could not be executed locally because `tsc` is not installed and this slice is constrained from using network installs.
