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

- Input mode for happy path: one readable PRD markdown file path
- Target location: one target project path with docs written to `<target>/docs/`
- Supported archetype: `cli-doc-generator`
- Required generated files:
  - `prd.md`
  - `system.md`
  - `pipeline.md`
  - `decisions.md`
  - `prd-ux-review.md`
  - `execution-guidance.md`
  - `validation.md`
  - `raes.config.yaml`
- Write behavior:
  - create missing docs directory
  - create required files if absent
  - fail before writing if any required target file already exists
- Runtime and test toolchain: TypeScript on Node.js
- Provider config lives in environment variables — never in `raes.config.yaml`
- Three supported providers: `anthropic`, `openai`, `local` (OpenAI-compatible endpoint)
- Required env vars: `RAES_PROVIDER`; per-provider: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `RAES_LOCAL_ENDPOINT`
- Optional: `RAES_MODEL` overrides the provider default model
- Minimum provider operation: `complete(prompt: string): Promise<string>`

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

- [x] Review Slice: Define archetype contract
  - `archetypes/cli-doc-generator/README.md` added documenting: templates are human reference docs and brownfield discovery hints, not generation sources for `raes-init`; full table of generated files mapped to config keys; V1 archetype contract (two required template files)
  - Gaps 4, 5, and 6 in `docs/raes-reference.md` marked resolved; Gap 1 marked resolved retroactively

### Milestone 6 — Multiple Initialization Modes

- [x] Execution Slice: Add bare greenfield mode and `--from-prd` flag to raes-init
  - CLI now supports two modes: `raes-init <target-path> <archetype>` (bare greenfield) and `raes-init --from-prd <prd-path> <target-path> <archetype>` (PRD-seeded)
  - Bare greenfield generates the same 8-file output set but with a `prd.md` stub (Overview, Goals, Non-Goals, Constraints, Open Questions) instead of a verbatim PRD copy
  - `prdPath` is now optional in `GenerateDocsInput`; render functions use existing fallback logic when PRD sections are empty
  - 4 new tests added for bare greenfield mode; 1 existing CLI test updated for new signature
  - All 16 tests pass; typecheck clean

### Milestone 7 — Inference Provider Interface

- [x] Execution Slice: Implement provider interface for `raes-init --from-prd`
  - Define `complete(prompt: string): Promise<string>` interface
  - Implement for `anthropic`, `openai`, and `local` (OpenAI-compatible) providers
  - `raes-init --from-prd` fails fast with a clear error before any file I/O if `RAES_PROVIDER` is unset or unsupported
  - Each provider fails fast if its required credential or endpoint is missing
  - `RAES_MODEL` override applies when set; each provider has a documented default
  - At least the `anthropic` provider is covered by a mock/stub test
  - Fail-fast behavior for missing `RAES_PROVIDER` is tested
  - Bare greenfield mode and existing `--from-prd` string-parsing output are unaffected
  - All 16 existing tests continue to pass

### Milestone 8 — AI-Derived Doc Generation

- [x] Review Slice: Define execution slices for AI-derived doc generation in `raes-init --from-prd`
  - Inspect current `generate-docs.ts` render functions, `provider.ts` interface, and CLI flow against Issue #12 acceptance criteria
  - Identify the prompt design for each affected file: `pipeline.md` (slice backlog), `decisions.md` (extracted constraints), `execution-guidance.md` (DoD, anti-patterns, workflow rules)
  - Identify the minimal wiring change needed in `generateDocs` to call `complete()` when a provider is available, without altering the create-or-fail write contract or bare greenfield behavior
  - Identify how to make AI-derived content testable without live provider calls (mock contract, output shape assertions)
  - Confirm which files stay unchanged: `prd.md` (verbatim), `system.md` (string parsing), `prd-ux-review.md` (string parsing), `validation.md` (stub)
  - Produce concrete, sequenced execution slices for Milestone 8 and append them to this backlog
  - No implementation code

- [x] Execution Slice 8.1: Wire provider into `generateDocs()` and produce AI-derived `pipeline.md`
  - Add `provider?: Provider` to `GenerateDocsInput`; update `cli.ts` to pass the loaded provider to `generateDocs()` rather than discarding it
  - Update `generateDocs()` to `await` render calls for AI-backed files; the content Map construction becomes sequential awaited calls for `pipeline.md`, `decisions.md`, `execution-guidance.md`
  - For `cli-doc-generator` archetype: when `provider` is present and `prdPath` is set, call `provider.complete(prompt)` to produce `pipeline.md`; when provider is absent or bare greenfield mode, fall back to current string-parsing stub
  - Prompt for `pipeline.md`: supply full PRD text and archetype; instruct the model to produce a RAES `pipeline.md` with required headings (`## Purpose`, `## Invariants`, `## Known Contracts`, `## Unknowns`, `## Slice Backlog` with `- [ ] Slice N:` entries, `## Handoff Notes`); do not fabricate requirements not in the PRD
  - Shape guard (`validateGeneratedDocShape`) is applied to AI output; if required headings are missing, generation fails with `GenerationError` before any write
  - Create-or-fail write contract is unaffected: `failIfOutputsExist()` runs before any AI calls
  - Files unchanged: `prd.md`, `system.md`, `prd-ux-review.md`, `decisions.md` (still stub in this slice), `execution-guidance.md` (still stub in this slice), `validation.md`
  - Bare greenfield mode (`prdPath` undefined): no provider call; all 24 existing tests pass
  - New tests: mock `Provider` injected into `generateDocs()`; mock returns a valid `pipeline.md` string containing required headings; assert shape guard passes; assert bare greenfield path unchanged; assert provider-absent `--from-prd` CLI exit already covered by existing test

- [x] Execution Slice 8.2: Produce AI-derived `decisions.md` and `execution-guidance.md`
  - Same wiring established in Slice 8.1; extend to `renderDecisionsDoc` and `renderExecutionGuidanceDoc`
  - Prompt for `decisions.md`: supply full PRD text; instruct the model to extract non-negotiable constraints, technology choices, and durable rules as RAES decision entries; output must contain `## Durable Decisions`
  - Prompt for `execution-guidance.md`: supply full PRD text; instruct the model to derive invariants, workflow rules, anti-patterns, and definition of done grounded in PRD constraints; output must contain `## Invariants`, `## Workflow Rules`, `## Anti-Patterns`, `## Definition of Done`
  - Shape guard applied to both AI outputs before write
  - All prior tests pass; new tests: mock provider for each file; shape assertions for required headings; confirm `validation.md` remains a stub
  - Clarifying note: when no provider is present, `decisions.md` and `execution-guidance.md` are generated as stubs; the operator must fill them in before the first execution slice runs

### Milestone 9 — Gap Resolution and Doc Corrections

- [x] Review Slice: Record gap decisions and produce sequenced correction backlog
  - Record decision: `frontend-backend-ai-app` is an officially supported V1 archetype
  - Record decision: V1 output set is exactly 8 files; all default fallback content and authoritative project docs must reflect this
  - Append three sequenced correction slices (A, B, C) to the backlog
  - No implementation code

- [x] Execution Slice A: Fix `generate-docs.ts`
  - Remove dead `extractPrdBullets` function and any call sites (Gap 2)
  - Update the fallback Known Contracts output-file list to name all 8 required files: `prd.md`, `system.md`, `pipeline.md`, `decisions.md`, `prd-ux-review.md`, `execution-guidance.md`, `validation.md`, `raes.config.yaml` (Gap 3)
  - Move `mkdir` call to immediately before the first `writeFile` call so directory creation and writes are co-located (Gap 8)
  - All existing tests continue to pass; no new failures introduced

- [x] Execution Slice B: Correct the project's own authoritative docs
  - Add `validation: docs/validation.md` under `sources:` in `projects/raes-init/docs/raes.config.yaml` (Gap 4)
  - Update `system.md` Output Set and Write Rules sections to list all 8 output files (Gap 9)
  - Append a handoff note to `pipeline.md` clarifying that `decisions.md` and `execution-guidance.md` are stubs when no provider is used and must be filled out before the first execution slice runs (Gap 5)
  - No implementation code changes; no test changes required

- [x] Add `projects/raes-init/docs/validation.md` and `projects/raes-init/docs/execution-guidance.md` to raes-init project
  - Review `docs/raes-reference.md` and `projects/raes-init/docs/prd.md` and determine what sections are required for a validation file for raes-init
  - Add `projects/raes-init/docs/validation.md` and populate it with required sections
  - Review `docs/raes-reference.md` and `projects/raes-init/docs/prd.md` and determine what sections are required for a exeution-guidance file for raes-init
  - Add `projects/raes-init/docs/execution-guidance.md` and populate it with required sections
  - No implementation code changes; no test changes required

- [x] Execution Slice C: Update `RAES_template.md`
  - Replace every occurrence of `PRD.md` with `prd.md` throughout the template (Gap 6)
  - Add the two-slice-type model (Execution Slice and Review Slice with distinct loops and rules), superseding the old single-loop form (Gap 7)
  - Verify consistency with authoritative definitions in `raes-reference.md` and `README.md`
  - No implementation code changes; no test changes required

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
- 2026-04-24: Execution Slice — added project-authored `docs/execution-guidance.md` and `docs/validation.md` to `projects/raes-init/`, grounded in `docs/raes-reference.md`, `projects/raes-init/docs/prd.md`, and the generator's required heading contract. Added one narrow test to ensure both files exist with the required section headings. `npm test` and `npm run typecheck` both pass. No durable decision change was needed. Next recommended: Execution Slice C — update `docs/RAES_template.md` to use `prd.md` and the two-slice model.
- 2026-04-20: Review Slices — `README.md` updated for two-slice-type model (Execution Slice and Review Slice), "What RAES Produces" updated to 8 files with `raes.config.yaml` explained, Example Execution Prompt replaced with config-routed form. `archetypes/cli-doc-generator/README.md` added documenting template-to-output contract. `docs/raes-reference.md` Gaps 1, 4, 5, 6 marked resolved.
- 2026-04-20: Review Slice — `docs/prd.md` updated to align with current V1 decisions. Corrected: input contract (file path only, PRD optional, `cli-doc-generator` only), output set (8 files, not 5), initialization modes (bare greenfield + `--from-prd` documented), generation logic section (clarified archetype templates are not consumed), open questions (removed answered question re: PRD optionality). No implementation changes.
- 2026-04-20: Execution Slice — raes-init now supports two initialization modes. CLI: `raes-init <target-path> <archetype>` (bare greenfield) and `raes-init --from-prd <prd-path> <target-path> <archetype>` (PRD-seeded). `prdPath` is optional in `GenerateDocsInput`; bare greenfield uses `renderPrdStub()` which produces a `prd.md` with section headers (Overview, Goals, Non-Goals, Constraints, Open Questions) and no content; PRD parsing falls back to generic defaults when stub sections are empty. All 16 tests pass; typecheck clean. Next recommended: Review Slice — Assess `raes-init --from-prd` for AI-inference enhancement (requires provider interface design).
- 2026-04-22: Execution Slice — Provider interface implemented in `src/provider.ts`. Defines `Provider` type (`complete(prompt): Promise<string>`) and `ProviderError`. `loadProvider()` reads `RAES_PROVIDER` env var and returns an `anthropic`, `openai`, or `local` provider; fails fast with `ProviderError` if unset, unsupported, or missing required credentials/endpoint. `RAES_MODEL` override supported; defaults: anthropic=`claude-haiku-4-5-20251001`, openai=`gpt-4o-mini`, local=`llama3`. `cli.ts` calls `loadProvider()` before `generateDocs()` when `--from-prd` is active — fails fast before any file I/O on provider misconfiguration. Doc generation logic (string-parsing) is unchanged; provider is wired but not yet used for generation. 8 new tests added (24 total); all pass; typecheck clean. Next recommended: Execution Slice — Wire provider into `--from-prd` generation (replace string-parsing with AI-backed doc derivation).
- 2026-04-22: Review Slice — Milestone 8 execution slices defined. Artifacts inspected: `src/generate-docs.ts`, `src/provider.ts`, `src/cli.ts`, `tests/generate-docs.test.ts`, `tests/provider.test.ts`, Issue #12. Key findings: (1) Provider is loaded in `cli.ts` but immediately discarded — `generateDocs()` has no `provider` parameter, which is the sole wiring gap. (2) Render functions for `pipeline.md`, `decisions.md`, `execution-guidance.md` are synchronous and return stub strings; making them AI-backed requires the generation step in `generateDocs()` to `await` each render call individually. (3) Existing shape guard (`validateGeneratedDocShape`) can be applied to AI output without change — it enforces required headings and throws `GenerationError` on failure. (4) Mock contract for tests: inject a `Provider` object directly into `generateDocs()` via `GenerateDocsInput`; tests assert required headings present in generated content. (5) Files that stay unchanged: `prd.md` (verbatim copy), `system.md` (string parsing), `prd-ux-review.md` (heuristic), `validation.md` (stub). Flag: project `raes.config.yaml` uses `build_init` (not `build_intent`) and points `execution_guidance` to `docs/system.md` (not `docs/execution-guidance.md`) — both diverge from `decisions.md` contracts and the generated `raes.config.yaml` output; this drift should be resolved in a separate cleanup slice. Next recommended: Execution Slice 8.1 — Wire provider into `generateDocs()` and produce AI-derived `pipeline.md`.
- 2026-04-22: Execution Slice 8.1 — Provider wired into `generateDocs()`. `provider?: Provider` added to `GenerateDocsInput`; `cli.ts` now stores and passes the loaded provider instead of discarding it. When `provider` is present and `prdPath` is set, `generateDocs()` calls `provider.complete(buildPipelinePrompt(prdText, archetype))` to produce `pipeline.md`; shape guard (`validateGeneratedDocShape`) is applied to AI output before any writes so a missing-heading failure leaves the docs directory empty. Bare greenfield mode and `--from-prd` without a provider fall back to string-parsing stub unchanged. `buildPipelinePrompt` supplies the full PRD text and archetype and instructs the model to produce all required headings with at least one `- [ ] Slice N:` entry. 3 new tests added (29 total); all pass; typecheck clean. Next recommended: Execution Slice 8.2 — Produce AI-derived `decisions.md` and `execution-guidance.md`.
- 2026-04-24: Execution Slice 8.2 — AI-derived `decisions.md` and `execution-guidance.md`. Extended Slice 8.1 wiring: when `provider` is present and `prdPath` is set, `generateDocs()` calls `provider.complete(buildDecisionsPrompt(prdText))` and `provider.complete(buildExecutionGuidancePrompt(prdText))` to produce `decisions.md` and `execution-guidance.md` respectively. Shape guard (`validateGeneratedDocShape`) is applied to both AI outputs before the write loop so a missing-heading failure leaves the docs directory empty. Bare greenfield mode (no `prdPath`) and `--from-prd` without a provider fall back to stubs unchanged. `validation.md` remains a stub. 3 new tests added (24 total); all pass; typecheck clean. Next recommended: Execution Slice A — Fix `generate-docs.ts` (remove dead `extractPrdBullets`, update fallback Known Contracts to 8 files, move `mkdir` before first `writeFile`).
- 2026-04-24: Review Slice — Gap decisions recorded and correction slices sequenced. Two new `decisions.md` entries added: `frontend-backend-ai-app` is an officially supported V1 archetype; the V1 output set is exactly 8 files and all default fallback content must reflect this. Three sequenced correction slices appended to this backlog as Milestone 9 (Slice A: fix `generate-docs.ts`; Slice B: correct project authoritative docs; Slice C: update `RAES_template.md`). Next recommended: Execution Slice A — Fix `generate-docs.ts` (remove dead `extractPrdBullets`, update fallback Known Contracts to 8 files, move `mkdir` before first `writeFile`).
- 2026-04-24: Execution Slice A — `src/generate-docs.ts` cleanup completed. Removed dead `extractPrdBullets` and its unused call site. Updated the fallback `system.md` Known Contracts list to name the authoritative 8-file output set. Moved `mkdir(docsDirectory)` to immediately before the write loop so failed shape validation leaves no empty `docs/` directory behind. Added 2 tests: one locks the 8-file fallback list; one proves invalid AI `pipeline.md` output fails before the docs directory is created. All 33 tests pass; typecheck clean. Next recommended: Execution Slice B — Correct the project's own authoritative docs.
- 2026-04-24: Execution Slice B — Corrected the project-owned authoritative docs to match the V1 schema and output contract. `projects/raes-init/docs/raes.config.yaml` now includes `sources.validation: docs/validation.md`. `projects/raes-init/docs/system.md` now lists the full 8-file output set and the create-or-fail write rules for `prd.md`, `execution-guidance.md`, `validation.md`, and `raes.config.yaml`. Clarification for operator handoff: when init runs without a provider, `decisions.md` and `execution-guidance.md` are bootstrap stubs and must be filled out before the first execution slice runs. No implementation code or tests changed. Next recommended: Execution Slice C — Update `RAES_template.md`.
- 2026-04-24: Execution Slice C — `docs/RAES_template.md` now uses `prd.md` consistently, lists the full 8-file `/docs` output set, and replaces the old single-loop section with explicit Execution Slice and Review Slice loops and rules aligned to `README.md` and `docs/raes-reference.md`. The template's execution prompt was also updated to the config-routed two-slice form so new projects inherit the current canonical operator flow. No code or test files changed. Next recommended: Review Slice — clean up `docs/raes-reference.md` notes that still describe `RAES_template.md` as pending two-slice-model cleanup.
