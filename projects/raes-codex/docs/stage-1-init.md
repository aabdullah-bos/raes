# Stage 1 Codex-Native RAES Init

## Purpose

This document is the implementation handoff for the smallest practical Stage 1 Codex-native replacement for the core `raes-init` workflow.

The initializer transforms an explicit set of project-intent sources into a valid, executable RAES project. It is a compiler from approved project intent to durable RAES artifacts, not an application scaffold generator.

The immediate goal is to build an interactive Codex skill that can:

1. initialize one explicitly supplied or currently opened project root;
2. require a PRD and accept an optional SRS and architecture document;
3. consult optional handoffs and behavioral contracts;
4. detect source conflicts and material ambiguity before mutation;
5. infer project shape, constraints, validation needs, execution guidance, and implementation work without archetypes;
6. generate the canonical eight-file RAES artifact set;
7. preserve optional SRS and architecture sources under canonical `docs/` paths;
8. validate the complete candidate project deterministically;
9. install the result using rollback-backed transactional behavior; and
10. produce a pipeline that the Stage 1 Codex-native RAES executor can consume immediately.

Stage 1 does not attempt full behavioral parity with the existing `raes-init` CLI.

## Design Principles

- Stage 1 is a compiler from project intent to RAES artifacts.
- The PRD is required. Bare initialization without a PRD is unsupported.
- Generated artifacts must be grounded in approved sources and explainable from them.
- Generated artifacts do not silently supersede their source documents.
- `system.md` becomes authoritative for execution constraints within the initialized RAES project, while remaining aligned with the approved project sources.
- The SRS guides implementation-work decomposition when present.
- The PRD remains authoritative for product purpose, scope, behavior, user outcomes, non-goals, and durable behavioral constraints.
- Architecture constrains technical structure, boundaries, dependencies, and sequencing.
- Ambiguity is surfaced, not guessed.
- Material source conflicts are resolved before any project files are written.
- Initialization is create-or-fail and never overwrites generated RAES artifacts.
- Initialization validates the complete candidate artifact set before committing any file.
- Initialization is rollback-backed and all-or-nothing for files owned by the invocation.
- Source discovery is explicit and bounded.
- Stage 1 does not use project archetypes.
- The generated project must be executable without retaining external copies of the initialization sources.
- Stage 1 defines RAES project contract version `1.0`.
- Every initialized project declares `raes.contract_version: "1.0"` in `raes.config.yaml`.
- The Stage 1 executor must require exactly contract version `1.0` before operating on an initialized project.
- Stage 1 preserves the existing six-source `raes.config.yaml` source map while adding only the required contract-version metadata.

## Scope

### Included

Stage 1 includes:

- one explicitly supplied or currently opened project root;
- one required PRD;
- zero or one SRS;
- zero or one architecture document;
- zero or more explicitly categorized handoff documents;
- zero or more explicitly categorized behavioral contracts;
- primary sources located inside or outside the target project;
- canonical preservation of the PRD and supplied optional SRS and architecture;
- the canonical eight-file RAES project output;
- bounded source and destination validation;
- explicit authority-by-question rules;
- source-conflict and ambiguity analysis by Codex;
- user resolution of blocking conflicts before mutation;
- project-type and project-shape inference without archetypes;
- derivation of durable execution constraints;
- derivation of validation expectations and established commands;
- complete high-confidence pipeline generation for known scope;
- deterministic slice IDs;
- flat Stage 1 pipeline grammar;
- deterministic candidate-artifact validation;
- stale-state protection between preflight and commit;
- staging in an operating-system temporary directory;
- rollback-backed installation into an existing repository;
- structured script output; and
- a concise completion summary with the next executable slice.

### Excluded

Stage 1 does not include:

- bare initialization without a PRD;
- application-code scaffolding;
- project archetypes;
- implicit upward, recursive, or repository-wide source discovery;
- multiple PRDs, SRSs, or architecture documents;
- automatic merging of competing canonical and external sources;
- silent reconciliation of source conflicts;
- overwriting or migration of an existing RAES project;
- changing the current six-source `raes.config.yaml` source map;
- adding SRS or architecture roles to `raes.config.yaml`;
- requiring the Stage 1 executor to load `docs/srs.md` or `docs/architecture.md`;
- explicit requirement traceability on every pipeline slice;
- a separate dependency graph artifact;
- invented validation commands or placeholder commands;
- workspace registration;
- provider abstraction or external model subprocesses;
- unattended initialization;
- guaranteed semantic determinism of Codex-authored prose; or
- a directory-wide atomic rename that requires an empty target directory.

## Source Model

### Primary inputs

| Input | Cardinality | Canonical destination | Required |
|---|---:|---|---:|
| PRD | exactly one | `docs/prd.md` | yes |
| SRS | zero or one | `docs/srs.md` | no |
| Architecture | zero or one | `docs/architecture.md` | no |

The three primary inputs must be readable Markdown files. They may be external to the target project. An external source is copied byte-for-byte to its canonical destination.

When the selected source is already at its canonical destination, it is read and preserved in place without rewriting.

### Supporting inputs

Supporting inputs are optional and must be supplied explicitly in one of these categories:

- handoffs: zero or more readable text documents;
- behavioral contracts: zero or more readable text documents.

Supporting documents may be inside or outside the project. They are consulted but are not copied, moved, renamed, or reorganized by Stage 1.

Multiple handoffs or contracts are allowed. Conflicting handoffs are blocking unless the user explicitly identifies the authoritative or newer document.

### Input interaction

A conceptual invocation may be expressed as:

```text
Initialize this project with RAES.

Project root: /path/to/project
PRD: /path/to/prd.md
SRS: /path/to/srs.md
Architecture: /path/to/architecture.md

Handoffs:
- /path/to/handoff.md

Contracts:
- /path/to/contract.md
```

Only the PRD is mandatory. The project root may be explicitly supplied or be the currently opened project root.

Stage 1 must not search recursively for likely inputs or choose among candidates. If an input path is not supplied, that input is absent.

Every supplied path must:

- exist;
- resolve unambiguously;
- be a regular readable file; and
- satisfy the format requirement for its input class.

Generated destinations must remain within the target project root.

## Authority Hierarchy

Authority is determined by the question being answered, not by treating every document as interchangeable.

| Question | Primary authority |
|---|---|
| What product is being built and why? | PRD |
| What product behavior, scope, user outcome, or non-goal is required? | PRD |
| What software requirements elaborate the product behavior? | SRS, when present |
| What technical structure, boundary, or dependency applies? | Architecture, when present |
| What immediate task or scope limitation applies? | Explicit handoff |
| What existing or compatibility behavior must be preserved? | Behavioral contracts |
| What must remain true during future RAES execution? | Generated `system.md`, grounded in approved sources |
| What implementation work occurs and in what order? | Generated `pipeline.md` |
| How is implementation validated? | Generated `validation.md`, grounded in known requirements and repository evidence |

When a general precedence is required, use:

1. RAES methodology and this Stage 1 handoff;
2. PRD for product intent and behavior;
3. SRS for elaborated software requirements;
4. architecture for technical structure;
5. handoffs for immediate scope;
6. behavioral contracts for existing and compatibility behavior; and
7. generated artifacts for their defined RAES execution roles.

A handoff may narrow the immediate implementation scope but must not silently redefine the product.

### PRD and SRS relationship

When present, the SRS is the primary guide for determining what implementation work is necessary. It is a requirements inventory, not a prewritten backlog.

The SRS may add compatible implementation detail and non-functional constraints that are absent from the PRD. For example, supported formats, performance targets, failure behavior, interface contracts, and persistence requirements may validly elaborate a PRD capability.

Codex must distinguish:

- compatible technical or non-functional elaboration, which may be accepted;
- material expansion of user-visible behavior, which requires PRD grounding or user clarification; and
- contradiction with the PRD, which is blocking.

### Architecture, handoffs, and contracts

Architecture constrains implementation structure and pipeline sequencing. It must not silently override required product behavior.

Handoffs and behavioral contracts are supporting evidence. Their authority is limited to their declared purpose unless the user explicitly grants broader authority.

### Conflict and ambiguity policy

Before writing any project files, Codex must:

1. compare the supplied sources under the authority rules above;
2. identify material contradictions;
3. present blocking conflicts clearly;
4. ask the user to resolve them; and
5. continue only after receiving an explicit resolution.

Codex must not write a partial project while waiting for a resolution.

Use this distinction:

- **Blocking ambiguity or conflict:** prevents safe initialization and must be resolved before generation commits.
- **Non-blocking durable ambiguity:** does not prevent a coherent initialization, can be resolved without adding, removing, or reordering the generated implementation work, and must be recorded in `system.md` under `## Unknowns` and represented by an early review slice.
- **UX-specific ambiguity:** belongs in `prd-ux-review.md`, with references to broader ambiguity recorded elsewhere.
- **Implementation uncertainty:** may remain an explicit unknown and be resolved by the relevant pipeline slice.

User resolutions made during initialization are durable decisions and belong in `decisions.md`.

Initialization may deliberately make visible ambiguity part of the generated work. A review slice may resolve that ambiguity, record the result in `decisions.md`, and update affected constraints in `system.md`. Later slices should refer to those authoritative artifacts rather than embed an unresolved assumption.

An ambiguity is blocking when one possible resolution would materially add, remove, split, combine, or reorder later slices. The Stage 1 executor does not permit an execution or review slice to rewrite pipeline declarations. The initializer therefore must not defer an ambiguity whose resolution could invalidate the generated backlog.

## Supported Project Contract

Every successful initialization produces the canonical eight-file RAES set:

```text
<project-root>/
├── raes.config.yaml
└── docs/
    ├── prd.md
    ├── system.md
    ├── pipeline.md
    ├── decisions.md
    ├── prd-ux-review.md
    ├── execution-guidance.md
    └── validation.md
```

When optional primary inputs are supplied, the project additionally contains:

```text
docs/srs.md
docs/architecture.md
```

A successful initialization therefore creates or preserves eight, nine, or ten owned paths depending on the supplied primary inputs.

The six-source map in `raes.config.yaml` remains unchanged. The complete Stage 1 configuration schema is:

```yaml
raes:
  contract_version: "1.0"
project:
  name: <project-name>
sources:
  build_intent: docs/prd.md
  system_constraints: docs/system.md
  next_slice:
    path: docs/pipeline.md
    selection_rule: first_unchecked_slice
  durable_decisions: docs/decisions.md
  execution_guidance: docs/execution-guidance.md
  validation: docs/validation.md
```

`<project-name>` is the basename of the resolved project root. The renderer must quote it when required by the supported YAML scalar grammar. No other top-level keys, source roles, or nested configuration fields are permitted in contract version `1.0`.

The source map identifies:

- build intent;
- system constraints;
- next-slice pipeline;
- durable decisions;
- execution guidance; and
- validation guidance.

`docs/srs.md` and `docs/architecture.md` are durable, unconfigured supporting sources. Stage 1 must not add config keys for them. Their relevant requirements and constraints must be compiled into the configured RAES artifacts so future execution does not require an external source copy or a config migration.

Before the initializer is considered interoperable, the Stage 1 `raes-execute` preflight must be updated to:

- require `raes.contract_version`;
- accept exactly the string value `"1.0"`;
- report a missing or unsupported version as a blocking compatibility error before resolving artifacts or selecting a slice; and
- report both the declared version, when present, and the executor-supported version.

The target repository may already contain application code, configuration, a README, `.git`, unrelated documentation, and unrelated files under `docs/`.

## Create-or-Fail Rules

Create-or-fail applies only to paths Stage 1 intends to create or copy. Unrelated project files do not block initialization.

### Canonical-source exceptions

These existing files are allowed only when each is the explicitly selected in-place source:

- `docs/prd.md`;
- `docs/srs.md`; and
- `docs/architecture.md`.

An allowed in-place source is read but never rewritten.

### Generated-output conflicts

Initialization must stop before mutation if any of these already exists:

- `docs/system.md`;
- `docs/pipeline.md`;
- `docs/decisions.md`;
- `docs/prd-ux-review.md`;
- `docs/execution-guidance.md`;
- `docs/validation.md`; or
- `raes.config.yaml`.

The conflict check must treat any existing filesystem object at a destination as a conflict, including a regular file, directory, symlink, or unreadable object.

### External-source conflicts

If the user supplies an external PRD, SRS, or architecture file and its canonical destination already exists, initialization must fail loudly.

This remains true even when the external file and existing canonical file are byte-for-byte identical. Stage 1 must not silently choose, merge, replace, or deduplicate the sources. The user may rerun initialization while explicitly selecting the existing canonical file.

Every conflict must be reported before content generation or target-project mutation.

## Artifact Generation

Codex reads the complete approved source set once, reasons across it, and generates the complete candidate artifact set as one coherent compilation.

### Canonical artifact headings

Generated Markdown artifacts use exact, zero-indented level-two heading lines in the order shown:

| Artifact | Required headings in order |
|---|---|
| `system.md` | `## Purpose`; `## Product Invariants`; `## Drift Guards`; `## Known Contracts`; `## Unknowns`; `## Anti-Patterns`; `## Definition of Done` |
| `pipeline.md` | `## Slice Backlog`; `## Handoff Notes` |
| `decisions.md` | `## Durable Decisions` |
| `prd-ux-review.md` | `## UX Gaps`; `## Open Questions`; `## Findings` |
| `execution-guidance.md` | `## Workflow Rules`; `## Anti-Patterns`; `## Definition of Done`; `## Sequencing Guidance` |
| `validation.md` | `## Testing Approach`; `## Validation Commands`; `## Known Constraints` |

These headings preserve the useful artifact boundaries established by the TypeScript initializer. `## Sequencing Guidance` replaces the legacy `## Milestone Guidance` because Stage 1 does not require or infer a milestone structure.

Validation must match complete heading lines, not substrings. Each required heading must appear exactly once and in the prescribed order. A required heading embedded in prose, a code fence, or a deeper heading does not satisfy the requirement.

`docs/prd.md`, `docs/srs.md`, and `docs/architecture.md` are preserved sources and are not required to adopt generated-artifact headings.

### `docs/prd.md`

- Preserve the selected PRD byte-for-byte.
- Copy an external PRD to the canonical path.
- Preserve an in-place canonical PRD without rewriting it.
- Do not synthesize or rewrite product intent.

### `docs/srs.md`

When an SRS is supplied:

- preserve it byte-for-byte;
- copy an external SRS to the canonical path; or
- preserve an in-place canonical SRS without rewriting it.

Do not create a synthetic SRS when none is supplied.

### `docs/architecture.md`

When architecture is supplied:

- preserve it byte-for-byte;
- copy an external architecture file to the canonical path; or
- preserve an in-place canonical architecture file without rewriting it.

Do not synthesize a standalone architecture document when none is supplied.

### `docs/system.md`

`system.md` owns the durable execution constraints that must remain true across future slices. It has authority aligned with the initialized project, but it must remain grounded in and consistent with approved sources.

It may include:

- cross-slice invariants derived from PRD behavior and non-goals;
- SRS technical contracts and non-functional constraints;
- architectural boundaries and structural constraints;
- compatibility constraints established by behavioral contracts;
- explicit decisions resolved during initialization;
- project-type statements only when they impose durable execution constraints; and
- unresolved non-blocking durable ambiguity under `## Unknowns`.

It must not:

- invent product behavior;
- become an ungrounded replacement for the PRD;
- restate every requirement without an execution purpose; or
- silently resolve a source conflict.

### `docs/pipeline.md`

The pipeline is an executable decomposition of the known project scope.

When an SRS exists, Codex must:

1. inventory its normative requirements;
2. group related requirements into capabilities;
3. identify dependencies and cross-cutting foundations;
4. convert capabilities into bounded implementation or review slices;
5. add work needed to establish validation;
6. check every slice against PRD intent and non-goals;
7. sequence work under architecture constraints;
8. check that known requirements are covered; and
9. surface uncovered behavior, unsupported expansion, contradiction, and low-confidence work.

When no SRS exists, Codex derives the pipeline from the PRD, architecture, handoffs, contracts, and existing repository evidence. It must not manufacture a hidden SRS or present inferred requirements as user-approved requirements.

Stage 1 should generate a complete high-confidence pipeline for the entire known scope. It must not invent low-confidence future work merely to appear complete. Uncertain work becomes an explicit unknown or review slice.

One requirement may require several slices, and one cohesive slice may satisfy several requirements. Per-slice source-requirement references are not required in Stage 1.

Pipeline ordering should generally:

1. resolve remaining non-blocking ambiguity;
2. establish contracts, repository structure, and test infrastructure;
3. implement foundational capabilities;
4. implement dependent product behavior;
5. add integration and edge-case behavior; and
6. perform final validation or readiness review.

Codex must reason about dependencies while generating the order, but no separate dependency graph or mandatory dependency heading is required. File order is authoritative.

### Pipeline grammar

The generated pipeline must contain:

```markdown
## Slice Backlog
```

Every selectable slice must use the Stage 1 executor’s flat declaration grammar:

```markdown
- [ ] <stable-id> | <execution|review> | <label>
```

Example:

```markdown
## Slice Backlog

- [ ] S-0001 | review | Resolve deployment-boundary ambiguity

  Description:

  Determine whether the first release supports a single region or multiple regions.

  Required output:

  - Record the approved boundary in `docs/decisions.md`.
  - Update affected execution constraints.

  Acceptance criteria:

  - The deployment boundary is explicit.
  - Dependent slices no longer require an assumption.

- [ ] S-0002 | execution | Establish the application test harness

  Description:

  Add the smallest test structure required by the approved project stack.

  Acceptance criteria:

  - The test harness exercises one representative behavior.
  - The established validation command succeeds.
```

Rules:

- IDs start at `S-0001`.
- IDs use four-digit zero padding and increase sequentially.
- IDs are unique.
- Type is exactly `execution` or `review`.
- Labels are non-empty.
- Declarations are zero-indented.
- The full indented Markdown body belongs to the preceding slice.
- Each slice body contains the exact label `Description:` followed by non-empty indented Markdown.
- Each slice body contains the exact label `Acceptance criteria:` followed by at least one non-empty indented bullet.
- Each execution slice contains the exact label `Validation:` when established commands or required checks apply, followed by at least one non-empty indented item.
- Each review slice contains the exact label `Required output:` followed by at least one non-empty indented bullet.
- A slice may contain the exact label `Constraints:` followed by non-empty indented Markdown.
- These labels are case-sensitive, must appear at the slice-body indentation level, and must each appear at most once.
- Nested bullets and checkboxes are context only and are never independently selectable.
- Milestone headings must not appear inside `## Slice Backlog`.
- Mixed “review and fix” slices are invalid and must be split.
- Pipeline entries do not require explicit SRS traceability metadata.

If unresolved non-blocking ambiguity remains, `S-0001` must be a review slice that attempts to resolve it. Its required output must record the resolution in `decisions.md` and update affected constraints in `system.md`. Every dependent later slice must remain valid under every permitted resolution and must obtain the resolved constraint from the authoritative artifacts rather than assume an answer in its declaration or body.

If resolving an ambiguity could invalidate the backlog inventory or order, initialization is blocked instead of generating the review slice. If no non-blocking ambiguity remains, the first slice is the first substantive setup, review, or implementation slice. A generic readiness review must not be added solely to occupy `S-0001`.

### `docs/decisions.md`

- Record only explicit, durable choices supported by the sources.
- Record conflicts resolved interactively by the user.
- Preserve known rationale when it is supplied.
- Do not invent rationale.
- Do not convert every requirement or constraint into a decision.
- Leave the decision log structurally valid and empty when no genuine decisions are known.

### `docs/prd-ux-review.md`

- Record user-experience gaps and ambiguities.
- Reference broader ambiguities maintained in `system.md` or pipeline review slices.
- Do not use this artifact as a general conflict log.
- Do not hide blocking conflicts here; blocking conflicts must be resolved before commit.

### `docs/execution-guidance.md`

Infer practical execution guidance from approved sources and repository evidence without using archetypes.

It may cover:

- repository layout;
- established coding and documentation conventions;
- safe work boundaries;
- test and validation workflow;
- dependency or toolchain expectations;
- implementation sequencing guidance; and
- instructions needed to preserve known constraints.

Do not invent tools, commands, dependencies, or conventions that have not been established.

### `docs/validation.md`

Record:

- known validation expectations;
- established automated commands;
- required manual checks;
- expected outcomes where useful; and
- responsibility for establishing missing validation mechanisms.

When exact commands are already established by repository evidence or approved sources, preserve them exactly in fenced code blocks and document the project root from which they run.

When commands do not yet exist:

- do not invent likely commands;
- do not emit placeholder commands such as `<test-command>`;
- state the validation outcomes that must eventually be proven;
- include an appropriate early pipeline slice to establish the toolchain or validation command; and
- require that slice to update `validation.md` after the command is real.

## Proposed Directory Structure

```text
skills/
└── raes-init/
    ├── SKILL.md
    ├── scripts/
    │   ├── preflight.py
    │   ├── validate_artifacts.py
    │   └── commit_project.py
    └── tests/
        ├── test_preflight.py
        ├── test_validate_artifacts.py
        ├── test_commit_project.py
        └── fixtures/
            ├── prd-only/
            ├── prd-srs-architecture/
            ├── canonical-inputs/
            ├── generated-output-conflict/
            ├── external-canonical-conflict/
            ├── malformed-pipeline/
            ├── duplicate-slice-id/
            ├── stale-target/
            └── rollback-failure/
```

Stage 1 should favor small, directly testable scripts over a larger framework.

## Deterministic Scripts

### `preflight.py`

#### Responsibilities

- resolve the explicit project root;
- resolve every supplied input path;
- validate input existence, type, readability, and required format;
- classify PRD, SRS, architecture, handoffs, and contracts from explicit arguments;
- identify canonical in-place primary inputs;
- detect competing external and canonical sources;
- compute every intended destination;
- reject existing generated outputs;
- reject invalid filesystem objects at intended destinations;
- verify that generated destinations remain inside the project root;
- capture relevant preflight state;
- hash canonical sources read in place;
- hash supporting inputs inside the project when they affect initialization;
- emit structured JSON; and
- make no project changes.

Preflight must not hash the entire repository. Unrelated application changes during generation do not stale the initialization.

#### Suggested JSON output

```json
{
  "status": "ready",
  "project_root": "/absolute/path/to/project",
  "sources": {
    "prd": {
      "path": "/absolute/path/to/prd.md",
      "destination": "docs/prd.md",
      "mode": "copy",
      "sha256": "..."
    },
    "srs": null,
    "architecture": null,
    "handoffs": [],
    "contracts": []
  },
  "destinations": [
    "docs/prd.md",
    "docs/system.md",
    "docs/pipeline.md",
    "docs/decisions.md",
    "docs/prd-ux-review.md",
    "docs/execution-guidance.md",
    "docs/validation.md",
    "raes.config.yaml"
  ],
  "state_token": "..."
}
```

Blocked output must use stable error codes and identify the path and reason.

#### Non-responsibilities

`preflight.py` does not:

- interpret product intent;
- resolve semantic conflicts;
- generate prose;
- infer project shape;
- write staging or target files; or
- migrate an existing project.

### `validate_artifacts.py`

#### Responsibilities

- consume a candidate manifest;
- verify that the complete required candidate set is present;
- verify that optional preserved sources are present exactly when applicable;
- verify source hashes and byte preservation;
- validate the exact required artifact headings, their order, and uniqueness;
- validate contract version `1.0`, the unchanged six-source map, the complete allowed config schema, and canonical paths;
- reject unrecognized config extensions introduced by initialization;
- parse the complete flat pipeline grammar;
- validate sequential deterministic IDs beginning at `S-0001`;
- validate unique IDs and supported slice types;
- validate exact slice-body labels, non-empty descriptions, acceptance-criteria bullets, applicable validation guidance, and review outputs;
- reject milestones and nested selectable slices;
- reject invented placeholder validation commands;
- verify that candidate paths do not escape the staging tree;
- emit structured JSON; and
- make no target-project changes.

Deterministic shape validation does not prove semantic grounding. Codex must separately review source alignment, coverage, and ambiguity.

### `commit_project.py`

#### Responsibilities

- consume a validated candidate manifest;
- verify that candidate validation succeeded;
- recheck every intended destination;
- recheck hashes of in-place canonical sources;
- recheck relevant supporting-input hashes;
- compare the current state with the preflight state token;
- reject stale or conflicting state;
- create destination directories only when safe;
- install generated files and copied sources;
- never rewrite an in-place canonical source;
- record every path created by this invocation;
- roll back every installed path if any installation step fails;
- leave all pre-existing files unchanged;
- report rollback failure explicitly if prior state cannot be fully restored;
- clean up temporary state after success or failure; and
- emit structured JSON.

The script must not provide a force or overwrite mode.

## Semantic Validation Boundary

Stage 1 separates deterministic candidate validation from semantic validation of the compiled project.

Deterministic validation proves mechanically checkable properties, including:

- source preservation;
- artifact presence and structure;
- exact headings and pipeline grammar;
- configuration and contract-version compatibility;
- destination safety;
- stale-state detection; and
- rollback-backed installation behavior.

These checks do not independently prove that the derived artifacts faithfully represent the approved sources. A candidate may be structurally valid while omitting a requirement, introducing unsupported behavior, contradicting an authoritative source, or assigning a requirement to the wrong artifact or slice.

Before commit, Codex must perform a separate semantic review of the complete staged candidate across three properties:

1. **Grounding:** Every substantive derived claim, constraint, behavior, validation expectation, and pipeline item is supported by an approved source or explicit repository evidence. Unsupported additions are removed or surfaced for user resolution.
2. **Consistency:** `system.md`, `pipeline.md`, `decisions.md`, `prd-ux-review.md`, `execution-guidance.md`, and `validation.md` do not contradict the PRD, the compatible requirements in the SRS, applicable architecture, resolved handoffs and contracts, or one another.
3. **Coverage:** Every approved actionable requirement is represented by an appropriate durable constraint, pipeline slice, validation expectation, explicit unknown, or blocking issue. Requirements intentionally excluded from the pipeline must have an authoritative reason.

The review must also confirm that:

- `system.md` contains the durable execution constraints required by the approved sources without becoming an ungrounded substitute for them;
- the pipeline covers the complete high-confidence known scope without inventing work;
- ambiguity is classified according to the Stage 1 blocking rules;
- deferred ambiguity cannot invalidate the generated backlog inventory or order; and
- no artifact silently changes source authority.

A successful semantic review is a required commit precondition, but Stage 1 does not represent it as a deterministic proof. The initialization report must distinguish:

- deterministic validation status;
- semantic review status;
- unresolved non-blocking ambiguities;
- blocking or uncovered requirements, when present; and
- the evidence basis used for grounding and coverage.

The Stage 1 trust boundary is therefore:

> Deterministic validation proves artifact structure, source preservation, pipeline grammar, configuration compatibility, and installation safety. It does not independently prove semantic grounding, cross-source consistency, or requirement coverage. Stage 1 relies on an interactive Codex semantic review for those properties. A successful initialization represents a reviewed compilation of project intent, not a mechanically proven requirements-to-pipeline correspondence.

This is a verification gap, not merely nondeterministic prose. Future stages should consider durable, independently inspectable semantic evidence, such as a requirements inventory or coverage manifest that maps authoritative PRD and SRS statements to `system.md` constraints, pipeline slices, validation expectations, or explicit exclusions. Stage 1 does not require traceability metadata on every pipeline declaration and must not invent such mappings when source boundaries are unclear.

## Candidate Manifest and Staging

Codex writes the complete candidate artifact tree into an operating-system temporary directory, not inside the target repository.

Suggested structure:

```text
<os-temp>/raes-init-<invocation-id>/
├── manifest.json
├── docs/
│   ├── prd.md
│   ├── srs.md
│   ├── architecture.md
│   ├── system.md
│   ├── pipeline.md
│   ├── decisions.md
│   ├── prd-ux-review.md
│   ├── execution-guidance.md
│   └── validation.md
└── raes.config.yaml
```

Only files applicable to the invocation are present.

The manifest records at least:

- manifest version;
- invocation ID;
- project root;
- source paths and categories;
- source hashes;
- destination paths;
- copy or preserve-in-place mode for each primary source;
- expected generated files;
- preflight state token;
- candidate file hashes;
- validation result; and
- paths created during commit for rollback accounting.

`validate_artifacts.py` and `commit_project.py` consume the manifest rather than receiving an unstructured list of individual paths.

Temporary state must be cleaned up after success or failure. If cleanup fails, report the remaining temporary path without treating the initialized project as failed after a successful commit.

## Transactional Workflow

Stage 1 uses a rollback-backed transaction because the target may be an existing repository and directory-wide atomic rename is not available.

The workflow is:

1. validate all inputs and destinations with `preflight.py`;
2. read every approved source completely;
3. identify source conflicts and blocking ambiguity;
4. obtain user resolution before proceeding when required;
5. infer project shape and compile every candidate artifact;
6. preserve or copy primary sources into the candidate tree;
7. build the candidate manifest;
8. validate all candidates with `validate_artifacts.py`;
9. perform Codex semantic review for grounding, coverage, and internal consistency;
10. recheck target and source state with `commit_project.py`;
11. install all owned files;
12. roll back every file created by the invocation if installation fails; and
13. clean up staging.

No target project file is written before steps 1 through 9 succeed.

The user’s explicit request to initialize authorizes the final create-or-fail commit after blocking ambiguities have been resolved. A redundant second approval gate is not required.

### Stale-state protection

The commit must fail before installation when any relevant state changed after preflight, including:

- existence or type of an intended destination;
- content of a canonical source read in place;
- content of a supplied supporting document inside the project;
- existence of the project root; or
- another change that invalidates a preflight assumption.

The initializer must not fail merely because an unrelated application file changed.

## Codex Skill Responsibilities

`SKILL.md` should instruct Codex to perform the following interactive workflow.

### 1. Preflight

- Resolve the one explicit or currently opened project root.
- Run `preflight.py` with explicitly categorized input paths.
- Stop on deterministic failure.
- Do not perform implicit source discovery.

### 2. Read and reconcile sources

- Read the PRD completely.
- Read the optional SRS and architecture completely.
- Read every supplied handoff and contract completely.
- Apply the authority-by-question rules.
- Identify blocking conflicts, durable ambiguity, UX gaps, and implementation uncertainty.
- Ask the user to resolve blocking conflicts before generating or writing the project.
- Record explicit user resolutions for `decisions.md`.

### 3. Compile the project

- Infer project shape and only those labels that influence execution.
- Derive durable execution constraints.
- Derive a validation strategy from known facts.
- Generate the complete high-confidence pipeline for known scope.
- Generate all canonical derived artifacts as one coherent set.
- Preserve source documents byte-for-byte.
- Do not use archetypes.
- Do not invent requirements, commands, rationale, dependencies, or tools.

### 4. Validate

- Write the complete candidate tree and manifest under the operating-system temporary directory.
- Run `validate_artifacts.py`.
- Stop on deterministic validation failure.
- Apply `## Semantic Validation Boundary` to review grounding, consistency, and coverage across the complete source and candidate set.
- Treat semantic review as a commit precondition without describing it as deterministic proof.
- Correct the candidate set and revalidate when necessary.

### 5. Commit

- Run `commit_project.py`.
- Stop and report stale state or conflict.
- Do not overwrite, merge, or force.
- Confirm cleanup or report the remaining temporary path.

### 6. Report

After success, report:

- absolute project root;
- generated files;
- primary sources copied or preserved in place;
- optional sources consulted but not copied;
- count of execution and review slices;
- unresolved non-blocking ambiguities;
- first runnable slice;
- deterministic and semantic validation result; and
- grounding, consistency, and coverage findings, including any unresolved exposure;
- the exact next `raes-execute` instruction when known.

If the executor invocation syntax is not established, identify the first slice without inventing a command.

Do not dump full artifact contents unless requested.

## Error and Blocking Behavior

Stage 1 must fail closed when:

- no PRD is supplied;
- the project root is ambiguous or invalid;
- an input is missing, unreadable, or not a regular file;
- a primary source is not Markdown;
- more than one PRD, SRS, or architecture source is supplied;
- an external primary source conflicts with an existing canonical source;
- a generated destination already exists;
- an intended destination is an unexpected filesystem object;
- a generated destination escapes the project root;
- supplied sources contain a material unresolved conflict;
- multiple handoffs conflict without declared authority;
- generated artifacts fail structural validation;
- the config changes the supported Stage 1 source contract;
- the config omits `raes.contract_version` or declares a value other than `"1.0"`;
- pipeline IDs are missing, duplicated, non-sequential, or malformed;
- a pipeline type is unsupported;
- a pipeline slice lacks required bounded content;
- a milestone or nested selectable slice appears in the backlog;
- placeholder or invented validation commands are presented as runnable;
- source preservation cannot be verified;
- relevant target or source state becomes stale;
- commit cannot safely install every owned file; or
- rollback cannot restore the pre-commit state.

A blocked result must explain:

- what is blocking;
- why continuing would be unsafe;
- which path, source, or state is involved;
- whether any target files were created;
- whether rollback completed; and
- what the user must resolve before retrying.

## Required Tests

At minimum, automated tests must cover:

### Preflight

- PRD-only initialization;
- PRD with optional SRS and architecture;
- external and canonical in-place primary sources;
- missing or unreadable inputs;
- non-regular input paths;
- external source with an existing canonical destination;
- identical external and canonical source conflict;
- every generated-output conflict;
- unrelated files under the project and `docs/`;
- destination boundary escape;
- multiple supporting documents;
- structured ready and blocked output; and
- no mutation during preflight.

### Artifact validation

- canonical eight-file candidate;
- nine- and ten-file candidates;
- byte-for-byte source preservation;
- exact required artifact headings in the prescribed order;
- duplicate, misplaced, substring-only, fenced, and wrong-level required headings;
- contract version `1.0` and the unchanged six-source source map;
- missing, unsupported, and malformed contract versions;
- valid Stage 1 pipeline grammar;
- IDs beginning at `S-0001`;
- sequential and unique IDs;
- execution and review slices;
- required review outputs;
- missing acceptance criteria;
- malformed and nested declarations;
- milestone headings;
- placeholder validation commands; and
- candidate path escape.

### Commit and rollback

- successful install into an existing non-RAES repository;
- preservation of unrelated files;
- preservation of canonical in-place sources;
- copying of external primary sources;
- stale destination creation after preflight;
- stale canonical-source content;
- stale supporting input;
- unrelated repository change allowed;
- failure during each installation step;
- removal of every path created by a failed invocation;
- preservation of all pre-existing files;
- explicit rollback failure reporting; and
- cleanup after success and failure.

### Skill-level scenarios

- PRD-only compilation;
- SRS-guided pipeline generation;
- architecture-constrained sequencing;
- compatible SRS elaboration accepted;
- user-visible SRS expansion surfaced;
- PRD/SRS contradiction blocked before write;
- handoff narrowing current scope;
- conflicting handoffs blocked;
- non-blocking ambiguity producing `S-0001 | review`;
- ambiguity whose resolution could invalidate later work blocking initialization;
- ambiguity-review output updating `decisions.md` and `system.md` without changing pipeline declarations;
- dependent slices remaining valid across every permitted ambiguity resolution;
- no ambiguity producing a substantive `S-0001`;
- missing validation toolchain producing setup work without invented commands;
- genuine decisions recorded without invented rationale;
- UX gaps separated from broader unknowns; and
- complete high-confidence known-scope coverage.

## Acceptance Criteria

Stage 1 is complete when:

1. a user can initialize one explicit project root from a required PRD;
2. optional SRS and architecture inputs are preserved at canonical paths;
3. optional handoffs and contracts influence generation without being copied;
4. an SRS, when supplied, guides pipeline decomposition;
5. PRD product behavior and non-goals constrain every generated artifact;
6. architecture constrains technical structure and sequencing;
7. material conflicts stop before any target write;
8. existing canonical sources are exempt only when explicitly selected in place;
9. competing external and canonical sources fail loudly;
10. existing generated RAES outputs always block initialization;
11. unrelated repository and `docs/` files are preserved;
12. the canonical eight-file RAES set is generated;
13. the generated config declares RAES contract version `1.0` and preserves the six-source source map;
14. the pipeline passes the Stage 1 executor grammar without migration;
15. slice IDs are deterministic and begin with `S-0001`;
16. non-blocking ambiguity conditionally becomes the first review slice;
17. every deferred ambiguity can be resolved without adding, removing, or reordering later slices;
18. ambiguity that could invalidate the backlog blocks initialization;
19. generated validation guidance contains no invented or placeholder commands;
20. all candidates pass deterministic and semantic validation before mutation;
21. stale relevant state blocks commit;
22. installation failure rolls back every file created by the invocation;
23. pre-existing files are never modified or removed;
24. successful completion reports the generated project and first executable slice; and
25. all required automated tests pass.

The interoperability acceptance test must initialize a candidate project and run the actual Stage 1 `raes-execute` preflight against it. The executor must report the project as ready, select `S-0001`, and report contract version `1.0`.

## Implementation Order

A practical implementation sequence is:

1. record RAES project contract version `1.0` and its exact config schema;
2. update and test the Stage 1 executor preflight to require exactly contract version `1.0`;
3. define manifest, error, and structured-output schemas;
4. implement and test initializer `preflight.py`;
5. implement the exact artifact and pipeline validators;
6. implement and test rollback-backed `commit_project.py`;
7. build fixtures covering all source and conflict modes;
8. author `SKILL.md` with the authority and ambiguity workflow;
9. test PRD-only initialization end to end;
10. test SRS- and architecture-informed initialization end to end;
11. test conflict resolution and conditional ambiguity slices;
12. verify generated projects with the actual Stage 1 executor preflight; and
13. document known Stage 1 limitations.

## Stopping Condition

After a successful initialization, Codex reports the result and stops.

It must not automatically execute the first slice. The initialized project is handed to the Stage 1 Codex-native RAES executor as a separate user-authorized operation.
