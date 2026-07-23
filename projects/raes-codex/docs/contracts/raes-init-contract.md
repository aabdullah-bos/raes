# `raes-init` Current Behavioral Contract

## 1. Purpose and scope

This document inventories the observable behavior of the existing `projects/raes-init` prototype. It describes what the current CLI and exported functions do; it is not a promise that Codex-native RAES must reproduce every behavior.

`raes-init` bootstraps a RAES project by creating seven Markdown artifacts under `<target>/docs/` and `raes.config.yaml` at the target root. It supports deterministic bare generation and PRD-seeded generation, with the public CLI requiring an AI provider for PRD-seeded use. It can also register the generated project in a workspace file. It does not scaffold application code, execute a slice, validate an implementation, accept work, or migrate an existing project. Evidence: `projects/raes-init/src/cli.ts:7-32`; `projects/raes-init/src/generate-docs.ts:6-21,137-305`; SRS, “Scope” and “Functional Requirements.”

The contract covers the CLI, `generateDocs`, provider adapters, artifact-shape checks, create-or-fail checks, and workspace registration. The repository’s SRS, README, PRD, decisions, templates, and RAES artifacts are treated as intent or supporting evidence when they differ from executable behavior.

## 2. Inputs and invocation

### 2.1 Public CLI forms

| Form | Current interpretation |
|---|---|
| `raes-init <target-project-path> <archetype>` | Bare deterministic initialization. |
| `raes-init --from-prd <prd-path> <target-project-path> <archetype>` | PRD-seeded initialization; the CLI first loads a configured provider. |
| Either form plus `--workspace <workspace-root>` | After project files are written, create or update `<workspace-root>/raes.workspace.yaml`. |
| `raes-init --help` | Print help and exit `0`; `--help` wins wherever it appears. |

Evidence: `projects/raes-init/src/cli.ts:7-38,40-100`; tests `generates the RAES docs set for the narrow happy path`, `generates all 8 files in bare greenfield mode`, `--workspace CLI flag registers project in workspace file`, and `--from-prd fails fast before file I/O when RAES_PROVIDER is unset`.

The supported archetypes are exactly `cli-doc-generator`, `frontend-backend-ai-app`, and `cli`. An unsupported value produces a `GenerationError` before project files are written. Evidence: `projects/raes-init/src/generate-docs.ts:6-7,145-155`; test `rejects unsupported archetypes without writing files`.

### 2.2 Parser details and invalid input

- `--from-prd` and `--workspace` are located by array search and removed before the first two remaining values are destructured as target and archetype. Contrary to the SRS syntax wording, `--from-prd` is not required to precede all positionals. Evidence: `projects/raes-init/src/cli.ts:40-69`.
- Missing target, archetype, PRD value, or workspace value produces stderr guidance and exit `1`. Evidence: `projects/raes-init/src/cli.ts:43-49,69-76`; tests `returns an explicit error for missing CLI input` and `--workspace without value exits 1 with usage message`.
- There is no general unknown-option check, no extra-positional check, no `-h` alias, and no version command. Values beyond the first two remaining positionals are ignored. This is code-verified but not positively covered by a focused test. Evidence: `projects/raes-init/src/cli.ts:34-76`.
- Paths are accepted as strings. The implementation does not require the target to be empty, canonical, inside the current repository, or already present. The target project name is its basename. Evidence: `projects/raes-init/src/generate-docs.ts:145-174`.

### 2.3 Provider inputs and defaults

The public CLI requires these inputs only for `--from-prd`:

| Environment input | Behavior |
|---|---|
| `RAES_PROVIDER` | Required; accepted values are `anthropic`, `openai`, and `local`. |
| `RAES_MODEL` | Optional model override. |
| `ANTHROPIC_API_KEY` | Required for `anthropic`; default model `claude-haiku-4-5-20251001`. |
| `OPENAI_API_KEY` | Required for `openai`; default model `gpt-4o-mini`. |
| `RAES_LOCAL_ENDPOINT` | Required for `local`; default model `llama3`; `/chat/completions` is appended. |

All three adapters use HTTP `fetch` and inherit normal process/network behavior. Evidence: `projects/raes-init/src/provider.ts:7-34,36-152`; provider tests covering missing configuration, model override, request payload, and returned text.

The exported `generateDocs` function has a broader surface than the CLI: if `prdPath` is supplied without a `provider`, it uses deterministic fallback renderers. The public CLI never exposes this combination because it calls `loadProvider` for every `--from-prd` invocation. Evidence: `projects/raes-init/src/cli.ts:78-89`; `projects/raes-init/src/generate-docs.ts:176-261`.

## 3. Outputs and side effects

### 3.1 Files

A successful initialization returns and ordinarily creates these eight paths:

1. `<target>/docs/prd.md`
2. `<target>/docs/system.md`
3. `<target>/docs/pipeline.md`
4. `<target>/docs/decisions.md`
5. `<target>/docs/prd-ux-review.md`
6. `<target>/docs/execution-guidance.md`
7. `<target>/docs/validation.md`
8. `<target>/raes.config.yaml`

Evidence: `projects/raes-init/src/generate-docs.ts:9-21,159-166,263-304`; tests `generates all 8 files in bare greenfield mode` and `generates raes.config.yaml with required source keys pointing to correct paths`.

The config deterministically contains `project.name`, all six RAES source roles including `system_constraints`, and `next_slice.selection_rule: first_unchecked_slice`. It contains no provider configuration and no RAES contract version. Evidence: `projects/raes-init/src/generate-docs.ts:1050-1065`.

If the source PRD already resolves to `<target>/docs/prd.md`, that file alone is exempted from the conflict check and write; the other seven outputs are still generated and the returned path list still includes the PRD. Evidence: `projects/raes-init/src/generate-docs.ts:159-172,277-304`; tests beginning `when prdPath is already the target docs/prd.md`.

### 3.2 Terminal output and exit behavior

- Help prints to stdout and exits `0`.
- Successful generation emits generation progress for each model-produced document, then a write-phase header and each written filename; it exits `0`.
- Recognized input, configuration, generation, and workspace-registration failures handled by `main` print to stderr and exit `1`.
- Provider setup failures are handled and exit `1`, but `ProviderError` thrown during a provider request is not caught by the generation catch and can escape the top-level call as an uncurated runtime failure.

Evidence: `projects/raes-init/src/cli.ts:34-38,78-108`; `projects/raes-init/src/generate-docs.ts:190-304`; test `emits progress messages for AI-backed --from-prd generation`.

There is no documented or implemented exit `2` distinction.

### 3.3 Workspace side effect

With `--workspace`, registration occurs after all eight project outputs are handled. A missing workspace file is created with a `projects:` map; an existing file is modified by textual insertion after its last canonical `config:` entry. The stored config path is relative to the workspace root, despite an SRS statement that registration uses an absolute path. A duplicate project name raises `WorkspaceRegistrationError`. Evidence: `projects/raes-init/src/generate-docs.ts:300-304,324-385`; workspace tests in `generate-docs.test.ts`.

Registration is not atomic and is not part of the project-file transaction. A registration failure, including a duplicate discovered after generation, can leave the generated project files in place.

## 4. Primary workflows

### 4.1 Bare initialization

1. Parse target, archetype, and optional workspace.
2. Validate non-empty inputs and supported archetype.
3. Compute the eight output paths and check for readable existing files.
4. Build a PRD stub and deterministic archetype-specific artifacts.
5. Validate required/forbidden heading substrings.
6. Create `<target>/docs/`.
7. Write the seven docs sequentially, then root config.
8. Optionally register the workspace.

The bare path does not call a provider even if a provider object was passed directly. Evidence: `projects/raes-init/src/generate-docs.ts:137-304`; test `bare greenfield mode does not call provider even when provider is present`.

### 4.2 PRD-seeded CLI initialization

1. Parse inputs.
2. Load provider configuration and credentials before reading the PRD or checking target conflicts.
3. Enter `generateDocs`, validate the archetype, and check target conflicts.
4. Read the PRD verbatim.
5. Call the provider sequentially for `system.md`, `pipeline.md`, `decisions.md`, `prd-ux-review.md`, `execution-guidance.md`, and `validation.md`.
6. Validate each response’s required and forbidden heading substrings.
7. After all six provider calls and validations succeed, write the PRD, six generated docs, and config sequentially.
8. Optionally register the workspace.

Evidence: `projects/raes-init/src/cli.ts:78-99`; `projects/raes-init/src/generate-docs.ts:159-304`. The tests use mock providers; no live provider integration is exercised by the package test suite.

### 4.3 PRD-seeded non-provider library path

Direct callers can supply `prdPath` without `provider`. The PRD is copied verbatim, while deterministic renderers derive limited content only from the first `# ` title and `- ` bullets under exact `## Core Functionality`, `## Constraints`, and `## Open Questions` headings. Other PRD structure is ignored for derivation. Evidence: `projects/raes-init/src/generate-docs.ts:176-188,398-473,492-716`.

### 4.4 Artifact validation

Model output validation requires configured strings such as `## Slice Backlog` to occur and rejects configured forbidden strings. It uses `String.includes`, not a Markdown parser. Therefore text in a code block or prose can satisfy or violate the check, order is not enforced, semantic grounding is not checked, and required content below a heading is generally not checked. Evidence: `projects/raes-init/src/generate-docs.ts:23-120,435-455`.

The prompt tells the model to remain grounded in the PRD and preserve artifact roles, but those semantic properties are model instructions rather than deterministic guarantees. Evidence: prompt builders in `projects/raes-init/src/generate-docs.ts:719-883`.

### 4.5 Create-or-fail and partial failure

For ordinary readable files, all eight target conflicts are checked before the PRD is read, provider calls occur, or project writes begin. Tests verify this normal no-write path. Evidence: `projects/raes-init/src/generate-docs.ts:159-181,307-318`; test `fails before partial generation when any target file already exists`.

The check attempts `readFile` and treats every non-`GenerationError` as absence. A directory, unreadable file, permission failure, or other read error may pass this gate and fail later. Project writes are sequential `writeFile` calls with no staging directory, rollback, or atomic rename, so an I/O failure can leave a partial docs set. Evidence: `projects/raes-init/src/generate-docs.ts:274-304,307-318`. The stronger SRS “complete or nothing” language is not an implemented guarantee.

## 5. Deterministic, model-dependent, human, and documented behavior

| Classification | Current behavior |
|---|---|
| Deterministic code | Argument extraction; archetype allow-list; output paths; ordinary conflict detection; PRD copy/stub; fallback rendering; heading-substring checks; sequential writes; config rendering; workspace text update. |
| AI-provider dependent | Six PRD-seeded artifact bodies, semantic quality, grounding, completeness, and provider latency/failure. |
| Prompt-only | “Do not fabricate,” artifact semantic boundaries beyond the substring lists, useful slice decomposition, and meaningful durable decisions. |
| Human dependent | Supplying a sufficiently structured PRD, credentials, resolving conflicts, correcting generated content, adding a provider block before `raes-execute`, and recovering from partial writes. |
| Documented but not implemented | General transactional generation; robust YAML/Markdown semantic validation; optional-provider fallback through the CLI; application scaffold generation. |

The SRS calls AI-backed output deterministic in places. Only prompts, call order, shape checks, and deterministic fallback rendering are deterministic; provider prose is not.

## 6. Preconditions, invariants, and failure behavior

### Preconditions

- A supported archetype and non-empty target are required.
- PRD-seeded CLI use requires provider selection and provider-specific credentials/endpoint.
- The PRD must be readable once provider setup succeeds.
- Ordinary output files must not already exist, except the same resolved target PRD special case.
- For workspace registration, the workspace root must already be writable; the function does not create it.

### Enforced invariants

- The normal output names and root-vs-docs placement are fixed.
- All provider-generated docs must pass the configured substring shape checks before any project output is written.
- Bare generation never calls a provider.
- Existing readable outputs cause failure before `generateDocs` writes.

### Fail-open or convention-dependent cases

- Conflict detection ignores non-readable-file errors.
- Writes and workspace registration are non-transactional.
- Semantic non-fabrication and correct artifact content are prompt-only.
- `raes.workspace.yaml` is modified with a narrow textual algorithm, not a YAML parser.
- Workspace duplicate detection uses a project-name regular expression against canonical indentation.
- No contract version is emitted.
- The generated config lacks the provider section that current `raes-execute` requires.
- All deterministic pipelines put `### Milestone` immediately below `## Slice Backlog`; current `raes-execute` stops parsing at that heading and reports no slices. Evidence: `projects/raes-init/src/generate-docs.ts:897-980`; `projects/raes-execute/src/pipeline.ts:14-41`.

Recovery is manual: remove or repair partial outputs, correct provider/config input, or update workspace registration. No resume, rollback, force, overwrite, or migration operation exists.

## 7. Observable command and interface behavior

| Operation | Status | Output/side effect | Exit |
|---|---|---|---|
| `--help` | Complete | Help to stdout; no writes/provider | `0` |
| bare init | Complete prototype | Eight outputs; optional workspace update | `0`, handled failure `1` |
| `--from-prd` | Complete prototype with model dependency | Six provider calls, eight outputs; optional workspace update | `0`, handled setup/generation failure `1`; request errors may escape |
| direct `generateDocs` without provider | Library-only behavior | Deterministic PRD-seeded docs | Promise resolves/rejects |
| `--workspace` | Partial | Create/append workspace map after project writes | `0` or `1`; non-atomic |
| re-init from target PRD | Narrow special case | Preserve PRD, create seven other outputs | `0` or `1` |
| overwrite/force | Unsupported | No such interface | N/A |
| version / short help | Unsupported | No such interface | Parsed as ordinary input rather than a defined command |

## 8. Evidence and traceability

Primary executable evidence:

- CLI parsing and exit handling: `projects/raes-init/src/cli.ts`, especially `main` at lines 34-108.
- Generation order, writes, and workspace trigger: `projects/raes-init/src/generate-docs.ts:137-318`.
- Artifact shapes and prompts: `projects/raes-init/src/generate-docs.ts:23-120,435-455,719-883`.
- Deterministic pipeline/config rendering: `projects/raes-init/src/generate-docs.ts:885-980,1050-1065`.
- Workspace mutation: `projects/raes-init/src/generate-docs.ts:324-385`.
- Provider behavior: `projects/raes-init/src/provider.ts`.
- Automated evidence: `projects/raes-init/tests/docs-artifacts.test.ts`, `generate-docs.test.ts`, and `provider.test.ts`.

Supporting intent evidence:

- `projects/raes-init/docs/srs.md` in full, particularly “Functional Requirements,” “Non-Functional Requirements,” “Environment and Provider Requirements,” and “Known Gaps.”
- `projects/raes-init/docs/prd.md`, `system.md`, `decisions.md`, `pipeline.md`, `execution-guidance.md`, and `validation.md`.
- `projects/raes-init/README.md` and the three archetype directories.
- `docs/raes-reference.md`, especially artifact boundaries, initialization, configuration, and known gaps.

Validation on 2026-07-23:

- `npm test` in `projects/raes-init`: passed, 51/51.
- `npm run typecheck` in `projects/raes-init`: passed.
- A temporary cross-tool probe generated the `cli` archetype with `generateDocs`, then passed its `pipeline.md` to `raes-execute` `parseSlices`; the observed parsed slice count was `0`, confirming the milestone-heading incompatibility without changing the repository.
- Provider tests use mocks; live network/provider behavior remains source-verified rather than integration-verified.
- The handoff-required path `projects/raes-init/docs/validatoin.md` does not exist. The correctly named `projects/raes-init/docs/validation.md` was inspected.

## 9. Discrepancies and gaps

| Conflict | Implemented behavior | Classification |
|---|---|---|
| SRS provider-optional/fallback statements vs CLI and other SRS sections | CLI requires `RAES_PROVIDER` and credentials for every `--from-prd`; fallback exists only through direct `generateDocs`. | Internal SRS contradiction and documentation defect. |
| SRS PRD derivation inventory vs code/tests | Six docs are provider-generated, not only pipeline/decisions/guidance. | Stale SRS gap statement. |
| SRS “complete or nothing” vs sequential writes | Normal conflicts and model-shape failures precede writes, but write/workspace failures can leave partial state. | Implementation gap. |
| SRS progress requirement says no progress before validation completes | Per-file generation progress is emitted while later model outputs remain unvalidated. | Implementation/documentation conflict. |
| SRS absolute workspace path vs code | Workspace stores a relative config path. | Documentation defect or unresolved intended format. |
| SRS `--from-prd` placement and strict argument syntax vs parser | Flag can appear elsewhere; extra values and unknown options are not generally rejected. | Interface implementation gap. |
| “Do not fabricate” guarantee vs validation | Grounding is prompt-only; deterministic validation checks heading substrings. | Model-dependent guarantee presented too strongly. |
| README/archetype claims about layout | Root config is not “in docs”; frontend archetype lacks the README that archetype documentation says every archetype has; template references include older paths. | Supporting-document/template drift. |
| Init project pipeline says moving config to root is unfinished | Implementation and tests already place it at root. | Stale RAES pipeline state; not advanced here. |
| Generated config vs execute schema | Init omits required execute `provider` block. | Blocking out-of-box interoperability defect. |
| Generated deterministic pipeline vs execute parser | Milestone headings cause execute to parse zero slices. | Blocking out-of-box interoperability defect. |
| Architecture requires explicit project-contract versioning | Current output is unversioned. | Expected prototype gap requiring architectural decision/legacy policy. |

## 10. Codex-native relevance

| Capability | Relevance classification |
|---|---|
| Initialize from user intent/PRD and produce the authoritative RAES artifact set | Required for Stage 1, adapted to Codex-native reasoning. |
| Validate inputs, output boundaries, and create-or-fail behavior before mutation | Required for Stage 1; deterministic mechanism is a useful reference but current checks are insufficient. |
| Stable config/path generation and supported-contract declaration | Required for Stage 1; current unversioned schema requires adaptation. |
| Three archetype renderers | Useful reference behavior; preservation is not implied. |
| Direct HTTP provider abstraction and environment contract | Should not be carried forward as a Codex-native provider requirement; content generation belongs with Codex. |
| Workspace registration | Relevant to a later replacement stage unless Stage 1 project selection requires it. Current text mutation should be adapted, not copied. |
| PRD-at-target re-init exception | Useful reference behavior requiring an explicit compatibility decision. |
| Current substring shape validator | Useful negative example; should not be treated as sufficient Stage 1 enforcement. |
| Sequential, non-atomic writes and config/pipeline incompatibility | Should not be carried forward. |
| Templates and deterministic fallback content | Reference material only pending an explicit product decision. |

These classifications follow `projects/raes-codex/docs/architecture.md`, “Stage 1,” “Deterministic RAES kernel,” “Slice State and Acceptance Model,” and “Versioning and Evolution.”

## 11. Open questions

1. **What legacy unversioned init output must Codex-native RAES support?** Current projects declare no contract version, while architecture requires explicit supported ranges and fail-closed behavior. The architecture, both CLIs, config examples, and reference were inspected. A legacy-policy decision is required and blocks a safe Stage 1 compatibility boundary.
2. **What canonical backlog grammar permits milestones?** Init emits level-three milestone headings; execute treats the first such heading as the end of the backlog. Source, tests, templates, and reference were inspected. A shared grammar decision and interoperability test are required; this blocks out-of-box Stage 1 init-to-execute use.
3. **Should initialized projects be immediately executable?** The init config omits the provider block execute requires. README language implies a handoff to execution, but no executable shared contract resolves the mismatch. This blocks a reliable Stage 1 end-to-end workflow.
4. **Is workspace registration part of Stage 1?** Architecture emphasizes a project root and resumability but does not settle whether multi-project workspace mutation is initially required. It does not block single-project Stage 1.
5. **Which archetype semantics are durable RAES contract versus prototype convenience?** PRD, SRS, templates, and renderers differ. A product/contract decision is needed, but it need not block a minimal intent-driven Stage 1.
6. **What transactional boundary applies to initialization?** The SRS says complete-or-nothing, but code does not implement it and architecture requires safe durable state. A deterministic write/rollback policy is required for Stage 1.

## 12. Contract summary

The current `raes-init` reliably demonstrates a narrow eight-file bootstrap, normal existing-file protection, three archetype fallbacks, six-call model-backed PRD generation, heading-substring validation, and optional workspace registration. Its reusable deterministic ideas are fixed artifact roles, explicit source mapping, early ordinary conflict checks, and separation of prompt generation from file placement.

Semantic content quality is provider- and prompt-dependent. Important current risks are non-transactional writes, weak shape validation, an unversioned/provider-less config, stale documentation, and two blocking incompatibilities with `raes-execute`: the missing provider block and milestone-bearing backlog format. Stage 1 needs intent-driven initialization, deterministic validation and safe writes, a compatible versioned config/backlog contract, and a clean handoff into one bounded execution/review slice. This contract does not select the implementation.
