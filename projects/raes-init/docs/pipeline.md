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

- [x] Slice 3: Improve PRD-to-doc adaptation so generated docs better distinguish known contracts, unknowns, and project-specific constraints
  - Preserve the narrow write contract
  - Avoid generic template leakage into outputs

### Milestone 3.5 — Generated Docs Shape Consistency

- [x] Slice 4: Ensure generated docs consistently include the required RAES sections and headings for the selected archetype
  - Verify system.md, pipeline.md, decisions.md, and prd-ux-review.md always produce the expected top-level sections
  - Fail clearly if PRD adaptation would omit a required section
  - Keep output readable and deterministic

### Milestone 4 — PRD Review Quality

- [x] Slice 5: Improve `prd-ux-review.md` extraction for ambiguity, operator risk, and open questions in CLI-oriented workflows
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

### Milestone 5 — RAES Methodology Documentation

- [x] Review Slice: Produce RAES Reference Document
  - Inspect all existing repo artifacts against authoritative design inputs
  - Identify what is captured vs. missing in the repo
  - Produce `docs/raes-reference.md` covering: what RAES is, what it is not, two slice types, config design principle, toolchain, canonical prompt structure, human-in-the-loop position, and explicit gap list
  - No implementation code

- [ ] Review Slice: Update `RAES_template.md` and `README.md` for two-slice-type model
  - Add Review Slice loop and completion criteria
  - Update prompt examples to reference config-based routing
  - Do not change raes-init implementation

- [x] Review Slice: Define minimal `raes.config.yaml` schema
  - Schema defined inline by operator and provided as authoritative input to the execution slice below
  - Keys: project.name, sources.build_intent, sources.next_slice (path + selection_rule), sources.durable_decisions, sources.execution_guidance, sources.validation

- [x] Execution Slice: Generate `raes.config.yaml` and new stub docs from raes-init
  - Rename `PRD.md` output to `prd.md` (lowercase, matches `build_intent` schema key)
  - Add `execution-guidance.md` stub (Invariants, Workflow Rules, Anti-Patterns, Definition of Done)
  - Add `validation.md` stub (Testing Approach, Validation Commands, Known Constraints)
  - Add `raes.config.yaml` with project.name and all five source keys pointing to generated files
  - Update `decisions.md` to include a Decision Log table stub
  - Output set grows from 5 to 8 files; create-or-fail contract is preserved
  - All 12 tests pass; typecheck blocked by missing local `tsc` install (same constraint as prior slices)

- [ ] Review Slice: Define archetype contract
  - Specify what a RAES archetype must contain to be considered complete
  - Specify the contract between an archetype and raes-init's generation logic
  - Required before implementing a second archetype

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
- 2026-04-08: Slice 3 keeps the V1 happy-path contract unchanged but makes PRD adaptation section-aware for `Core Functionality`, `Constraints`, and `Open Questions`.
- 2026-04-08: Generated `system.md`, `pipeline.md`, and `prd-ux-review.md` now prefer section-matched PRD bullets for known contracts, project-specific constraints, and unknowns before falling back to generic defaults.
- 2026-04-08: Slice 4 adds a required-heading validator for generated docs so `system.md`, `pipeline.md`, `decisions.md`, and `prd-ux-review.md` fail fast if a required RAES section is missing before write.
- 2026-04-08: The shape guard is intentionally static per generated filename and does not widen the V1 contract or change the create-or-fail output behavior.
- 2026-04-08: Slice 5 makes `prd-ux-review.md` derive CLI-oriented UX risks from PRD workflow bullets so the review calls out path errors, validation blocks, existing-doc conflicts, and archetype expectations when those failure moments are present.
- 2026-04-08: The UX-risk extraction remains deterministic and narrow: it only inspects the already-supported PRD sections and falls back to generic review bullets when the PRD does not expose clear workflow risks.
- 2026-04-20: Review Slice — RAES Reference Document completed. `docs/raes-reference.md` produced. Key findings: `raes.config.yaml` does not exist in this repo; the Review Slice type is not formalized in any existing repo artifact; `raes-discover` and `raes-execute` tools exist only in design conversations; existing prompt examples use hardcoded paths and conflict with the evolved config-routed design. Six explicit gaps recorded in Section 8 of the reference document. Next recommended: Update template and README for two-slice model, then define `raes.config.yaml` schema.
- 2026-04-19: Execution Slice — raes-init now generates 8 files per init: `prd.md` (renamed from `PRD.md`; verbatim source PRD copy), `system.md`, `pipeline.md`, `decisions.md`, `prd-ux-review.md`, `execution-guidance.md` (new stub), `validation.md` (new stub), `raes.config.yaml` (new; maps all five source keys to generated paths). All 12 tests pass. Typecheck blocked: `tsc` not installed locally (same constraint as prior slices). Naming conflict resolved: `PRD.md` → `prd.md` to match schema `build_intent` key. `system.md` and `prd-ux-review.md` continue to be generated as additional outputs not referenced in `raes.config.yaml`. Next recommended: Review Slice — Update `RAES_template.md` and `README.md` for two-slice-type model.
