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

- [ ] Slice 2: Implement raes.config.yaml schema validation and file existence check; ensure all referenced artifact paths are present and readable; output actionable errors if config is invalid.

- [ ] Slice 3: Build artifact loader module for prd.md, system.md, decisions.md, and config-defined custom artifacts; implement boundary validation to detect mixing of constraint/rationale/intent across artifact types.

- [ ] Slice 4: Implement --check-config (-c) command to validate raes.config.yaml and all referenced artifacts; provide detailed output on any validation failures.

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

### Slice 1 — 2026-05-03

**Stack established:** TypeScript + Node.js native test runner (`node --experimental-strip-types --test`), no external dependencies, matching the `raes-init` sibling project exactly. Files created: `package.json`, `tsconfig.json`, `src/cli.ts`, `tests/cli.test.ts`.

**Exit codes introduced:** `0` = success/help/version; `1` = usage error (unknown option, extra positional arg). Code `2` is reserved for config/runtime errors (not yet used). Recorded in `decisions.md`.

**Architecture note:** `main(argv, io)` accepts injectable `out`/`err` sinks for testability — this pattern must be preserved in all future commands. The `IO` interface is exported from `src/cli.ts`; other modules should import and reuse it rather than re-defining it.

**Known stubs:** All option flags beyond `--help`/`-h`/`--version` are recognized (won't error) but return exit 1 "not yet implemented". Slice 2 will implement `--check-config`; the stub infrastructure is already in place.

**What's left incomplete:** `--print-artifact` and `--flag` accept an argument value (e.g. `--print-artifact prd`). The current arg parser only handles boolean flags; Slice 2 or whichever slice introduces value-bearing options must extend the parser to handle `--option <value>` pairs before those options go live.

**Next operator:** Start Slice 2. The `KNOWN_FLAGS` set in `src/cli.ts` already lists `--check-config`/`-c`; implement the handler there rather than creating a separate file for now.