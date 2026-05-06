<!--
Slice B1 displaced content staging
Source file: docs/pipeline.md
Date: 2026-05-06

Working list:
1. Heading: ## Purpose
   Destination: docs/prd.md
   Content staged below under "## Destination: docs/prd.md"
2. Heading: ## Invariants
   Destination: docs/system.md
   Content staged below under "## Destination: docs/system.md"
3. Heading: ## Known Contracts
   Destination: docs/system.md
   Content staged below under "## Destination: docs/system.md"
4. Heading: ## Unknowns
   Destination: docs/system.md
   Content staged below under "## Destination: docs/system.md"
-->

# B1 Displaced Content

## Destination: docs/prd.md

### From `pipeline.md` — `## Purpose`

RAES Execute is a CLI tool that automates disciplined, ambiguity-resistant AI-assisted software development by executing one slice of work at a time. It ensures each decision and artifact stays in its proper place, prevents drift from project intent, and enforces RAES workflow constraints at every step. The tool is designed for engineers and operators using the RAES methodology to produce reliable, testable outcomes with minimal execution drift and maximum transparency into project state.

## Destination: docs/system.md

### From `pipeline.md` — `## Invariants`

#### Product Invariants

* **Single-Slice Execution:** Each CLI invocation executes exactly one bounded slice of work. Multi-slice or batch execution is explicitly out of scope; users invoke the tool once per slice advancement.
* **Artifact Boundary Discipline:** Artifacts are updated only in their correct roles as defined by RAES reference. Constraints, rationale, product intent, and system design must never be mingled or overwritten outside their proper boundaries.
* **No Artifact Reinterpretation:** The tool does not merge, overwrite, or reinterpret artifact files outside the strict rules defined in RAES. All writes are narrowly scoped to the slice being executed.
* **Halt on Ambiguity:** If any artifact is missing, ambiguous, conflicting, or violates boundary rules, execution halts immediately with actionable error output. No work proceeds until the human resolves the issue and confirms continuation.
* **Durable Configuration:** raes.config.yaml is the single source of truth for project structure, artifact paths, slice definitions, and milestones. The tool validates it on every invocation and refuses to proceed if it is invalid or references missing artifacts.

#### Drift Guards

* **Boundary Validation:** Before and during execution, the tool validates that no artifact references or updates cross defined boundaries (e.g., system.md constraints must align with decisions.md; product intent in prd.md must not be restated as system constraint).
* **Safe I/O:** All artifact writes are atomic; partial writes or corrupted state is prevented by using transactional or temporary-file patterns.
* **Forced Clarity on Unknowns:** If a constraint is added to decisions.md but not promoted to system.md, or vice versa, the tool warns and optionally blocks advancement, forcing explicit team resolution.
* **History & Auditability:** Every slice execution, flag, and artifact change is logged with timestamp, type, and scope so drift or skipped steps can be detected in review.
* **No Bypass of Execution Flow:** Core RAES execution flow (Execution Loop or Review Loop, as determined by slice type) cannot be skipped or altered by CLI options; the tool enforces the loop in full.

### From `pipeline.md` — `## Known Contracts`

* **Input Contract:** RAES Execute expects a valid RAES-initialized project directory containing:
  * `raes.config.yaml` (validated against schema)
  * All artifact files referenced in config (prd.md, system.md, decisions.md, and any custom artifacts defined)
  * Slice definitions and milestone structure within config, following RAES reference format

* **Output Contract:** RAES Execute produces:
  * Updated artifact files (only in their correct roles and scopes)
  * Updated status and history records (stored locally in project directory, e.g., .raes/history.log, .raes/status.json)
  * CLI output to stdout (help, status, lists, artifact contents, error messages)
  * Optionally, flags and ambiguity records in a machine-readable format for later ingestion

* **Artifact Schema Contract:** All artifacts updated by RAES Execute conform to the RAES reference schema (document structure, metadata, section ordering). The tool does not allow deviation from this schema.

* **Slice Definition Contract:** Slices are defined in raes.config.yaml and include:
  * Type (Execution Loop or Review Loop)
  * Assignee / Accountable party
  * Goal and acceptance criteria
  * Constraints and related artifacts
  * Milestone association
  * Completion status (checked/unchecked)

* **Integration with RAES Init:** Outputs of RAES Init (initial config, artifact templates, milestone structure) must match the expected input contract for RAES Execute. The two tools share a common schema and directory structure.

* **Optional Future Integration with RAES Discover:** When brownfield flow is live, RAES Execute may accept input from RAES Discover for discovering existing constraints and artifacts in legacy codebases. The integration point and data format are TBD.

### From `pipeline.md` — `## Unknowns`

* **Third-Party CLI Runner Support:** The extent to which RAES Execute should support scripting via shell, npm, Python, or other environments is not yet defined. Minimal interface is planned (stdout, exit codes, machine-readable output), but deeper integration patterns (e.g., plugins, hooks, environment variables) are deferred.

* **Extensibility for New Artifact Types:** While the tool is designed to be extensible for new artifact types, the mechanism for registering custom artifacts and their validation rules is not yet finalized. Current scope covers core RAES artifacts (prd, system, decisions); support for user-defined artifact types is future work.

* **Telemetry & Data Collection:** Whether and how to collect anonymized invocation and error data for product improvement is not finalized. Current scope assumes local-only data; any remote telemetry requires explicit user consent and is out of v1 scope.

* **Multi-Team / Multi-Repo Orchestration:** Support for running RAES Execute across multiple projects or coordinating slices across team boundaries is not in scope for v1. Each project is assumed to be independent.

* **Conflict Resolution Workflow:** The exact interactive flow for resolving flagged ambiguities or boundary violations (e.g., prompts, approval workflows, automatic remediation suggestions) is underspecified and will be refined during Milestone 3 based on early testing.

* **Performance Baselines for Large Projects:** The tool is estimated to handle projects with <500 slices per project. Behavior and performance for larger projects (>500 slices, >1000 artifacts) is not yet tested or specified.
