# RAES Execute

## Purpose

RAES Execute is a CLI tool that automates disciplined, ambiguity-resistant AI-assisted software development by executing one slice of work at a time. It ensures each decision and artifact stays in its proper place, prevents drift from project intent, and enforces RAES workflow constraints at every step. The tool is designed for engineers and operators using the RAES methodology to produce reliable, testable outcomes with minimal execution drift and maximum transparency into project state.

---

## Invariants

### Product Invariants

* **Single-Slice Execution:** Each CLI invocation executes exactly one bounded slice of work. Multi-slice or batch execution is explicitly out of scope; users invoke the tool once per slice advancement.
* **Artifact Boundary Discipline:** Artifacts are updated only in their correct roles as defined by RAES reference. Constraints, rationale, product intent, and system design must never be mingled or overwritten outside their proper boundaries.
* **No Artifact Reinterpretation:** The tool does not merge, overwrite, or reinterpret artifact files outside the strict rules defined in RAES. All writes are narrowly scoped to the slice being executed.
* **Halt on Ambiguity:** If any artifact is missing, ambiguous, conflicting, or violates boundary rules, execution halts immediately with actionable error output. No work proceeds until the human resolves the issue and confirms continuation.
* **Durable Configuration:** raes.config.yaml is the single source of truth for project structure, artifact paths, slice definitions, and milestones. The tool validates it on every invocation and refuses to proceed if it is invalid or references missing artifacts.

### Drift Guards

* **Boundary Validation:** Before and during execution, the tool validates that no artifact references or updates cross defined boundaries (e.g., system.md constraints must align with decisions.md; product intent in prd.md must not be restated as system constraint).
* **Safe I/O:** All artifact writes are atomic; partial writes or corrupted state is prevented by using transactional or temporary-file patterns.
* **Forced Clarity on Unknowns:** If a constraint is added to decisions.md but not promoted to system.md, or vice versa, the tool warns and optionally blocks advancement, forcing explicit team resolution.
* **History & Auditability:** Every slice execution, flag, and artifact change is logged with timestamp, type, and scope so drift or skipped steps can be detected in review.
* **No Bypass of Execution Flow:** Core RAES execution flow (Execution Loop or Review Loop, as determined by slice type) cannot be skipped or altered by CLI options; the tool enforces the loop in full.

---

## Known Contracts

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

---

## Unknowns

* **Third-Party CLI Runner Support:** The extent to which RAES Execute should support scripting via shell, npm, Python, or other environments is not yet defined. Minimal interface is planned (stdout, exit codes, machine-readable output), but deeper integration patterns (e.g., plugins, hooks, environment variables) are deferred.

* **Extensibility for New Artifact Types:** While the tool is designed to be extensible for new artifact types, the mechanism for registering custom artifacts and their validation rules is not yet finalized. Current scope covers core RAES artifacts (prd, system, decisions); support for user-defined artifact types is future work.

* **Telemetry & Data Collection:** Whether and how to collect anonymized invocation and error data for product improvement is not finalized. Current scope assumes local-only data; any remote telemetry requires explicit user consent and is out of v1 scope.

* **Multi-Team / Multi-Repo Orchestration:** Support for running RAES Execute across multiple projects or coordinating slices across team boundaries is not in scope for v1. Each project is assumed to be independent.

* **Conflict Resolution Workflow:** The exact interactive flow for resolving flagged ambiguities or boundary violations (e.g., prompts, approval workflows, automatic remediation suggestions) is underspecified and will be refined during Milestone 3 based on early testing.

* **Performance Baselines for Large Projects:** The tool is estimated to handle projects with <500 slices per project. Behavior and performance for larger projects (>500 slices, >1000 artifacts) is not yet tested or specified.

---

## Slice Backlog

- [x] Slice 1: Scaffold CLI project and implement foundational command parser with --help, error-handling for missing/extra params, and support for short/long options (subcommands TBD).

- [x] Slice 2: Implement raes.config.yaml schema validation and file existence check; ensure all referenced artifact paths are present and readable; output actionable errors if config is invalid.

- [x] Slice 3: Build artifact loader module for prd.md, system.md, decisions.md, and config-defined custom artifacts; implement boundary validation to detect mixing of constraint/rationale/intent across artifact types.

- [ ] Slice 4: Enhance --check-config output with per-error fix guidance, structured multi-line error blocks, error-count summary, and detailed success listing. Extends Slice 2 foundation; color/icon formatting deferred to Slice 18.

- [ ] Slice 5: Implement --status (-s) command to output current project status: next slice, milestone, total slices complete/remaining, active flags/ambiguity.

- [ ] Slice 6: Implement --list-slices (-l) command to output a list of all pipeline slices with position, status (checked/unchecked), type, assignee, and label.

- [ ] Slice 7: Implement --show-next-slice (-n) command to print details of the next unchecked slice (type, constraints, goal, acceptance criteria, related files).

- [ ] Slice 8: Implement --print-artifact (-p) command to print the content of a named RAES artifact to stdout for debugging and inspection.

- [ ] Slice 9: Design and implement safe, atomic file I/O for artifact updates; establish transactional patterns to prevent partial writes or corrupted state.

- [ ] Slice 10: Implement --execute-next-slice (-e) command skeleton; integrate slice determination logic and execution loop routing (Execution Loop vs. Review Loop based on slice type).

- [ ] Slice 11: Implement Execution Loop for --execute-next-slice: prompt for and record execution decisions, validate artifact boundaries, write results to correct artifact(s) only.

- [ ] Slice 12: Implement Review Loop for --execute-next-slice: prompt for and record review decisions, validate artifact boundaries, update slice status and history upon completion.

- [ ] Slice 13: Implement halt-on-ambiguity behavior: detect missing, conflicting, or boundary-violating artifacts; output actionable error messages and prevent advancement until resolved.

- [ ] Slice 14: Implement --flag command to add ambiguity/blocking/known-issues flags to current slice or config; ensure flagged slices block advancement until flag is cleared by human.

- [ ] Slice 15: Implement history recording and storage (local .raes/history.log or equivalent); track executed slices, artifact changes, and flag/resolution events with timestamps.

- [ ] Slice 16: Implement --history command to list most recent N executed slices, showing what changed and when; output in plain text and optional machine-readable format (JSON/YAML future).

- [ ] Slice 17: Implement durable constraint promotion validation: detect when constraint is added to decisions.md but not promoted to system.md (or vice versa); warn or block advancement as configured.

- [ ] Slice 18: Implement CLI output formatting: color-coded status, clear icons/symbols for errors/warnings/completions, pipe-friendly plain text output, optional JSON/YAML modes (future).

- [ ] Slice 19: Write comprehensive --help text and usage documentation; ensure all options, error messages, and flags are self-documenting and accessible from the CLI.

- [ ] Slice 20: End-to-end testing: validate core workflow (--check-config → --show-next-slice → --execute-next-slice → --status) with test project; verify artifact boundaries, history recording, and flag behavior.

---

## Handoff Notes

### Slice 3 — 2026-05-03

**New module:** `src/artifacts.ts` — exports `ArtifactRole`, `Artifact`, `BoundaryViolation`, `loadArtifact`, `loadAllArtifacts`, `validateBoundaries`. All functions are sync; no external dependencies added.

**`loadArtifact` return pattern:** Returns `{ artifact?, error? }` — same optional-result pattern used throughout the codebase. On success, `artifact` is set and `error` is `undefined`; on failure (file missing or unreadable), `error` is a human-readable string and `artifact` is `undefined`.

**`loadAllArtifacts` return pattern:** Returns `{ artifacts?, errors }` — consistent with `checkConfig`. If any file is missing, `artifacts` is `undefined` and `errors` lists one string per missing file. On success, `errors` is an empty array and `artifacts` is a fully-populated `Record<ArtifactRole, Artifact>`. Future callers that need to act on all artifacts must check `errors.length === 0` before using `artifacts`.

**Boundary validation approach:** `validateBoundaries` checks each artifact for section headers (markdown `#`/`##`/`###`) that belong to a foreign artifact role. Violations are detected via regex against individual lines. Each `BoundaryViolation` carries `role`, `path`, `issue` (which foreign domain was detected), and `evidence` (the exact offending header line). False positives are possible if artifact content discusses another role's section names in prose — this is acceptable for v1; detection is section-header-level only, not full NLP.

**`system.md` not in config:** The Slice 3 definition referenced `system.md`, but the current config has no `system.md` artifact. The `execution_guidance` and `next_slice` (pipeline) artifacts serve the system contract role in this project. Boundary validation covers all five configured roles; no `system.md`-specific handling was added. Flagged for awareness — if a `system.md` artifact is introduced in a future slice, `ArtifactRole` and `FOREIGN_RULES` in `src/artifacts.ts` must be extended.

**59 tests, all passing; typecheck clean.**

**Next operator:** Slice 3 is complete. The next unchecked slice is Slice 4 — enhance `--check-config` output with per-error fix guidance, structured multi-line error blocks, error-count summary, and detailed success listing. (Note: per the Slice 4 handoff below, this was substantially completed in Slice 2; Slice 4 may be re-scoped or marked redundant.) After Slice 4, the artifact loader in `src/artifacts.ts` is the foundation for Slice 5 (`--status`) and Slice 8 (`--print-artifact`).

---

### Slice 4 — 2026-05-03

**Scope note:** Slice 4 was re-scoped from its original definition ("implement --check-config command") because Slice 2 had already delivered the command and its core validation logic. Slice 4 extended the output layer only: per-error fix guidance, structured multi-line error blocks, error-count summary, and detailed success listing.

**`ConfigError.fix` added:** `src/config.ts` — `ConfigError` now has an optional `fix?: string` field. Every error emitted by `extractConfig`, `validatePaths`, and `checkConfig` populates `fix` with a one-line remediation action. Future slices that introduce new validation errors must also populate `fix`; a `ConfigError` without `fix` is incomplete.

**`checkConfig` return type changed:** Was `ConfigError[]`; now `{ errors: ConfigError[]; config?: RaesConfig }`. On success, `config` is populated and `errors` is empty. On failure, `config` is `undefined`. Any future caller must destructure the result — direct array indexing on the return value will not compile. Recorded in `decisions.md`.

**`--check-config` success output:** Lists all five verified artifact paths in a column-aligned table (field label → path), then the count summary line (`raes.config.yaml OK — 5 artifact paths verified.`). Written to `stdout`.

**`--check-config` failure output:** One structured block per error to `stderr` — `error: <message>` / `  field: <field>` / `  fix: <guidance>` / blank line — followed by a summary line (`N error(s) found. Fix the issue(s) above and re-run --check-config.`).

**36 tests, all passing; typecheck clean.**

**Next operator:** Slice 4 is complete. The next unchecked slice is Slice 3 — artifact loader module for `prd.md`, `system.md`, `decisions.md`, and boundary validation. The `RaesConfig` type and `checkConfig` in `src/config.ts` are the natural starting point.

---

### Slice 2 — 2026-05-03

**New module:** `src/config.ts` — exports `parseYaml`, `extractConfig`, `validatePaths`, `checkConfig`. All are pure-function or sync-only (uses `readFileSync`/`existsSync`); no external dependencies added.

**YAML parser scope:** `parseYaml` is a minimal indent-based parser for the fixed `raes.config.yaml` schema (max 2 levels deep). It is not a general YAML parser. Values containing colons after the first are preserved correctly (e.g. `msg: error: foo` → `{msg: 'error: foo'}`). Do not extend it to handle multi-line values, lists, or anchors without adding a proper YAML library.

**`IO.cwd` added:** The `IO` interface in `src/cli.ts` now includes `cwd?: string` (defaults to `process.cwd()`). All future command handlers that need the project root must read `io.cwd` (resolved at the top of `main`) rather than calling `process.cwd()` directly — this is required for testability without spawning subprocesses.

**Exit code 2 now live:** `--check-config` is the first command to return exit code 2 on failure. The reserved meaning (config/runtime errors) established in decisions.md is now in active use.

**`--check-config` wired:** `-c`/`--check-config` now calls `checkConfig(cwd)` and exits 0 (success) or 2 (error). Existing stub infrastructure for other flags is unchanged.

**Slice 4 overlap:** Slice 4 ("Implement --check-config command with detailed output") is now substantially satisfied by this slice. Slice 4 can be used to refine output formatting (color, icons, column-aligned error display) once Slice 18 output-formatting work is scoped, or it can be re-scoped or marked redundant.

**34 tests, all passing; typecheck clean.**

**Next operator:** Start Slice 3 — build the artifact loader module for `prd.md`, `system.md`, `decisions.md`, and config-defined custom artifacts; implement boundary validation. The `src/config.ts` types (`RaesConfig`, `ConfigError`) and `checkConfig` are the natural foundation; import and reuse them.

---

### Slice 1 — 2026-05-03

**Stack established:** TypeScript + Node.js native test runner (`node --experimental-strip-types --test`), no external dependencies, matching the `raes-init` sibling project exactly. Files created: `package.json`, `tsconfig.json`, `src/cli.ts`, `tests/cli.test.ts`.

**Exit codes introduced:** `0` = success/help/version; `1` = usage error (unknown option, extra positional arg). Code `2` is reserved for config/runtime errors (not yet used). Recorded in `decisions.md`.

**Architecture note:** `main(argv, io)` accepts injectable `out`/`err` sinks for testability — this pattern must be preserved in all future commands. The `IO` interface is exported from `src/cli.ts`; other modules should import and reuse it rather than re-defining it.

**Known stubs:** All option flags beyond `--help`/`-h`/`--version` are recognized (won't error) but return exit 1 "not yet implemented". Slice 2 will implement `--check-config`; the stub infrastructure is already in place.

**What's left incomplete:** `--print-artifact` and `--flag` accept an argument value (e.g. `--print-artifact prd`). The current arg parser only handles boolean flags; Slice 2 or whichever slice introduces value-bearing options must extend the parser to handle `--option <value>` pairs before those options go live.

**Next operator:** Start Slice 2. The `KNOWN_FLAGS` set in `src/cli.ts` already lists `--check-config`/`-c`; implement the handler there rather than creating a separate file for now.