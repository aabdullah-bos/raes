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

- [x] Slice 3a: In Slice 3, it was identified that system.md, existed, but was not  a formal config artifact or document. system.md has been added, so we now need to extend RaesConfig, extractConfig, validatePaths (src/config.ts), ArtifactRole, and FOREIGN_RULES (src/artifacts.ts) and update tests.

- [x] Slice 4: Enhance --check-config output with per-error fix guidance, structured multi-line error blocks, error-count summary, and detailed success listing. Extends Slice 2 foundation; color/icon formatting deferred to Slice 18.

- [x] Slice 5: Implement --status (-s) command to output current project status: next slice, milestone, total slices complete/remaining, active flags/ambiguity.

- [x] Slice 6: Implement --list-slices (-l) command to output a list of all pipeline slices with position, status (checked/unchecked), type, assignee, and label.

- [x] Slice 7: Implement --show-next-slice (-n) command to print details of the next unchecked slice (type, constraints, goal, acceptance criteria, related files).

- [x] Slice 8: Implement --print-artifact (-p) command to print the content of a named RAES artifact to stdout for debugging and inspection.

- [x] Slice 9: Design and implement safe, atomic file I/O for artifact updates; establish transactional patterns to prevent partial writes or corrupted state.

- [x] Slice 10: Implement --execute-next-slice (-e) command skeleton; integrate slice determination logic and execution loop routing (Execution Loop vs. Review Loop based on slice type).

- [x] Slice 11: Implement Execution Loop for --execute-next-slice: prompt for and record execution decisions, validate artifact boundaries, write results to correct artifact(s) only.

- [x] Slice 12: Implement Review Loop for --execute-next-slice: prompt for and record review decisions, validate artifact boundaries, update slice status and history upon completion.
  
- [x] Slice 12a: REVIEW SLICE - Slice 11 and Slice 12 implemented the core experince of raes-execute, but there appears to be a gap between intent and implementation. Both an execution and a review slice require an AI Provider so that they can use the default prompt and AI Provider agent to accomplish the slice.
  - Perform a gap review to determine if existing implementation calls an AI agent to execute the next slice
  - If an AI agent is not used then then the next slices should be to create a provider abstraction
  - This is a critical point, do not make assumptions Flag all ambiguities
  - No tests requried for this slice

- [x] Slice 13a: Extract canonical prompt into raes-execute runtime artifact.
  - Copy the canonical prompt text from raes-reference.md (Section 7,
    "Default Prompt (canonical form)") into src/prompts/execution-loop.md
    inside raes-execute. The file is the operative runtime copy; divergence
    from raes-reference.md is accepted and managed manually (see decisions.md).
  - Implement loadPrompt() in src/prompt.ts: reads
    src/prompts/execution-loop.md relative to the module location, returns
    the full string. Throws a structured error with a fix string if the file
    is missing.
  - Tests: assert file exists and is non-empty; assert loadPrompt() returns
    a string containing the EXECUTION SLICE and REVIEW SLICE section headers.
  - No provider call. No config change. Prompt file and loader only.

- [x] Slice 13b: Extend raes.config.yaml schema with provider key and
  add config validation.
  - Add provider block to RaesConfig in src/config.ts:
      provider:
        name: anthropic | openai   (required)
        model?: string             (optional, defaults per provider)
        sandbox?:
          write_access?: boolean   (optional, defaults to true)
  - Update extractConfig to read and validate provider.name. If missing or
    not one of the two known values, emit a ConfigError with a fix string.
  - model and sandbox.write_access are optional; emit no error if absent.
  - Update the project's own docs/raes.config.yaml to include a provider
    block with a valid provider.name so --check-config continues to pass
    on the project's own config after this slice.
  - Update --check-config success output to include provider.name in the
    verified fields table.
  - Tests: valid config with each provider name; missing provider.name;
    unknown provider.name; missing sandbox block (must not error);
    write_access false (must not error). All existing tests must pass.

- [x] Slice 13c: Implement Provider interface and ClaudeCodeProvider.
  - Define Provider interface in src/provider.ts:
      interface Provider {
        submit(prompt: string): Promise<ProviderResult>
      }
      interface ProviderResult { output: string; error?: string }
  - Implement ClaudeCodeProvider: spawns `claude -p --output-format json`
    subprocess via child_process.spawn. Pipes prompt to stdin. Reads stdout
    as JSON and extracts text content from the response. If provider.sandbox
    .write_access is true (default), passes `--allowedTools Edit,Write,Read`.
    If write_access is false, omits the flag. Reads ANTHROPIC_API_KEY from
    environment; if missing, returns a ProviderResult with a structured error
    and fix string (do not throw).
  - Tests: mock child_process.spawn; assert correct flags passed for
    write_access true and false; assert missing API key returns error result
    not a thrown exception; assert prompt is passed via stdin not argv.
  - No live subprocess calls in tests.

- [x] Slice 13c-fix: Correct ClaudeCodeProvider authentication behavior.
  - Remove the ANTHROPIC_API_KEY check from ClaudeCodeProvider.submit
    in src/provider.ts. Authentication is handled by the operator's
    existing `claude login` session or ANTHROPIC_API_KEY if already
    present in the inherited environment; raes-execute must not read
    or inject it.
  - Replace the missing-key error path with subprocess exit-code detection:
    if the subprocess exits non-zero, inspect stderr for auth-related
    output and return a ProviderResult with error and fix:
    "Run `claude login` to authenticate before using the anthropic provider."
  - Update tests: remove the "missing API key returns error" test case;
    add "subprocess exits non-zero with auth error output returns
    ProviderResult with error and fix string" using a stderr fixture.
  - All existing passing tests must continue to pass.

- [x] Slice 13d: Implement CodexProvider.
  - Implement CodexProvider in src/provider.ts following the same Provider
    interface as ClaudeCodeProvider.
  - Spawns `codex exec -` subprocess. Pipes prompt to stdin (the `-` sentinel
    makes stdin the full prompt). If write_access is true (default), passes
    `--sandbox workspace-write`. If false, omits the flag.
  - Does not read or inject API keys. Authentication is handled by the
    operator's existing `codex login` session; the subprocess inherits
    the operator's environment as-is. If the subprocess exits non-zero,
    inspect stderr for auth-related output and return a ProviderResult
    with error and fix: "Run `codex login` to authenticate before using
    the openai provider."
  - Codex emits JSONL events on stdout; parse the stream and extract the
    final text response from the turn/completed event.
  - Tests: remove "missing API key" test case; mock child_process.spawn; 
-   assert correct flags for write_access true and false;
-   prompt piped via stdin; JSONL stream parsed correctly from a fixture.
  - No live subprocess calls in tests.

- [x] Slice 13e: Implement provider factory and wire into execution and
  review loops with operator confirmation gate.
  - Add createProvider(config: RaesConfig): Provider factory in
    src/provider.ts. Returns ClaudeCodeProvider for 'anthropic', CodexProvider
    for 'openai'. Throws if name is unknown (config validation in 13b should
    prevent this, but guard anyway).
  - In execution-loop.ts: after artifact validation and before the existing
    Proceed? prompt, call loadPrompt(), call provider.submit(prompt), print
    the full response to io.out. Then prompt:
    `Agent output shown above. Record this slice as complete? [y/N]`
    On y: mark slice complete via markSliceComplete + writeFileAtomic, exit 0.
    On n: print `Slice not recorded. No artifacts written.`, exit 0.
    On provider error: print the error and fix string to io.err, exit 2.
  - Apply the same pattern in review-loop.ts.
  - Tests: mock Provider interface; assert output is printed before
    confirmation prompt; assert y records slice; assert n does not write;
    assert provider error exits 2 without writing. No live provider calls.

- [x] Slice 13f: Add dry-run mode for `--execute-next-slice`.
  - Add a dry-run option that resolves config, selects the next slice,
    determines loop type, loads the canonical prompt, and reports what would
    happen without invoking provider submission or writing any artifact.
  - Output must include the slice label, loop type, provider name, prompt
    source path, pipeline path, and whether provider write access is enabled.
  - Dry-run must exit 0 on a clean preflight and exit 2 on the same config,
    prompt, or artifact errors that would block a real execution.
  - Tests: CLI-path coverage for execution slice and review slice dry-run
    output; assert no provider submission and no pipeline write occur.

- [ ] Slice 13g: Add missing-binary handling for provider subprocesses.
  - Detect the case where `claude` or `codex` is not installed or not present
    on PATH before or during subprocess spawn, and return a structured
    ProviderResult error with an actionable fix string.
  - Anthropic fix guidance must tell the operator to install Claude Code or
    make `claude` available on PATH. OpenAI fix guidance must tell the
    operator to install Codex CLI or make `codex` available on PATH.
  - Execution and review loops must surface these errors on stderr and exit 2
    without writing any artifact.
  - Tests: mock spawn failure / ENOENT for both providers; assert fix guidance
    and no artifact write in CLI-path execution.

- [ ] Slice 13h: Add clearer provider/preflight output.
  - Before provider submission in execution-loop.ts and review-loop.ts, print a
    concise preflight block showing slice label, loop type, provider name,
    pipeline path, prompt source, and provider write-access mode.
  - Distinguish at least these runtime failure classes in stderr output:
    prompt load failure, provider auth failure, provider binary missing,
    provider output parse failure, and generic provider non-zero exit.
  - Keep exit code behavior unchanged: usage errors remain 1; runtime/config
    failures remain 2.
  - Tests: assert preflight output ordering and class-specific stderr messages
    for representative provider failures.

- [ ] Slice 13i: Add empty-output guard before slice recording.
  - If provider submission returns success but the final output is empty or
    whitespace-only, treat that as an ambiguity/runtime failure rather than
    prompting to record completion.
  - Execution and review loops must print an actionable error telling the
    operator to rerun after resolving the provider issue, then exit 2 with no
    artifact write.
  - Tests: mock Provider success with empty output for both loops; assert no
    confirmation prompt appears and pipeline remains unchanged.

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

### Slice 13f — 2026-05-05

**`--dry-run` added for `--execute-next-slice`.** `src/cli.ts` now accepts `--execute-next-slice --dry-run` and rejects `--dry-run` on its own as a usage error. The dry-run path resolves config, reads the pipeline, selects the next unchecked slice, determines loop type, runs the same artifact/prompt preflight as real execution, and exits before provider submission or artifact writes.

**Preflight output is intentionally narrow.** Dry-run currently prints the slice label, loop type, provider name, canonical prompt source path, pipeline path, provider write-access mode, and a final line stating that provider submission and artifact writes were skipped. This is enough for Slice 13f; clearer runtime preflight formatting remains open in Slice 13h.

**Artifact and prompt validation are now shared.** New module `src/slice-preflight.ts` centralizes artifact loading, boundary validation, and prompt loading. `src/execution-loop.ts`, `src/review-loop.ts`, and the dry-run path in `src/cli.ts` all use it so dry-run fails on the same pre-provider conditions as real execution.

**Prompt path resolution is now explicit.** `src/prompt.ts` exports `getPromptPath()` so CLI output can report the runtime prompt source without duplicating path-building logic.

**Validation:** `npm test` and `npm run typecheck` both pass from `projects/raes-execute/`. Test count is now 201 passing.

**Next operator:** Slice 13g is now next. It should add structured missing-binary handling for `claude` and `codex` subprocess startup failures and surface those errors through the existing provider/runtime error path without writing artifacts.

### Slice 13e — 2026-05-05

**Provider factory added:** `src/provider.ts` now exports `createProvider(config)`, returning `ClaudeCodeProvider` for `provider.name: anthropic` and `CodexProvider` for `provider.name: openai`. The factory still guards unknown names and throws even though config validation should block them earlier.

**Execution and review loops now submit through the configured provider before recording completion.** `src/execution-loop.ts` and `src/review-loop.ts` both load the canonical runtime prompt with `loadPrompt()`, call `provider.submit(prompt)`, print the full provider output to `io.out`, and only then ask: `Agent output shown above. Record this slice as complete? [y/N]`.

**No-write path is explicit.** If the operator answers anything other than `y`, both loops exit 0 and print `Slice not recorded. No artifacts written.`. Pipeline writes still happen only after confirmation and still use `writeFileAtomic`, so the existing atomic write contract remains intact.

**Provider and prompt failures halt with runtime exit code 2.** Both loops now print the provider error string and optional fix guidance to `io.err`. Missing prompt file errors also surface their `fix` guidance from `src/prompt.ts` and exit 2 before any artifact write.

**Test-only injection path added to keep CLI tests offline.** `main(argv, io)` in `src/cli.ts` now accepts optional `io.provider` and `io.loadPrompt`, which are passed through only to `runExecutionLoop`/`runReviewLoop`. Production behavior is unchanged; tests use this to avoid live `claude`/`codex` subprocesses while still exercising the CLI path.

**Validation:** `npm test` and `npm run typecheck` both pass from `projects/raes-execute/`. Test count is now 198 passing.

**Next operator:** Slice 13 is now the next unchecked slice. It should build on the provider-backed loop flow by enforcing halt-on-ambiguity for missing, conflicting, or boundary-violating artifacts beyond the current boundary validation surface, with actionable errors and no advancement until resolved.

### Slice 13d — 2026-05-05

**`CodexProvider` added to `src/provider.ts`.** The new provider implements the existing `Provider` interface and mirrors the Claude adapter shape. It spawns `codex exec -`, writes the full prompt to stdin, and reads stdout/stderr from the subprocess. When `config.provider.sandbox?.write_access !== false`, it passes `--sandbox workspace-write`; when write access is explicitly disabled, the sandbox flag is omitted.

**Auth handling matches the recorded provider contract.** `CodexProvider` does not read or inject `OPENAI_API_KEY`. It treats authentication as an operator/session concern and detects auth failures from non-zero subprocess exit plus stderr inspection. On auth failure, it returns `ProviderResult { output: '', error, fix }` with `fix: 'Run \`codex login\` to authenticate before using the openai provider.'`.

**Codex stdout parsing is JSONL-based.** Successful output is parsed line-by-line until a `type: "turn/completed"` event is found. The implementation extracts the final text from `output_text` first, then falls back to `result` or `text`, with the same fallback search inside a nested `turn` object. If no `turn/completed` event is present, the provider returns an error instead of guessing from partial events.

**Tests updated in `tests/provider.test.ts`.** Added coverage for:
- `--sandbox workspace-write` when write access is enabled
- omitting `--sandbox` when write access is disabled
- auth failure returning `error` + `fix`
- prompt sent via stdin rather than argv
- JSONL parsing from a `turn/completed` fixture

**Validation:** `npm test` and `npm run typecheck` both pass from `projects/raes-execute/`. Test count is now 187 passing.

**Next operator:** Slice 13e — implement provider factory and wire provider submission into `execution-loop.ts` and `review-loop.ts` with the operator confirmation gate described in the backlog. `CodexProvider` is available now, so the next slice can focus on runtime wiring rather than adapter behavior.

### Slice 13c-fix — 2026-05-05

**`ANTHROPIC_API_KEY` check removed from `ClaudeCodeProvider.submit` in `src/provider.ts`.** The early-return error path that read `process.env['ANTHROPIC_API_KEY']` and returned a structured error when absent has been deleted. Authentication is now handled by the operator's pre-existing `claude login` session (or `ANTHROPIC_API_KEY` if already in the inherited environment); `raes-execute` does not inspect or inject it.

**`ProviderResult` extended with optional `fix?: string` field.** Callers consuming `ProviderResult` should check `result.fix` when `result.error` is set to surface remediation guidance to the operator.

**Non-zero exit handler now detects auth errors.** If the subprocess exits non-zero and stderr matches `/not logged in|unauthorized|unauthenticated|authentication|login required/i`, the returned `ProviderResult` includes `fix: 'Run \`claude login\` to authenticate before using the anthropic provider.'`. Non-auth non-zero exits return a plain error string with no `fix` field (same as before).

**Test cleanup.** The "missing API key returns error" test was removed. The three `--allowedTools` flag tests no longer set/restore `ANTHROPIC_API_KEY` (the key check is gone, so the env var manipulation was noise). The new test "subprocess exits non-zero with auth error output returns ProviderResult with error and fix string" uses a `stderrData` fixture and asserts `result.fix` matches `/claude login/`.

**`makeSpawnMock` extended with `stderrData` option.** `stderrData` is emitted before the `close` event when non-empty. All existing tests continue to work without changes to their call sites (default is `''`).

**182 tests, all passing; typecheck clean.**

**Next operator:** Slice 13d — implement `CodexProvider` in `src/provider.ts` following the same `Provider` interface. Spawns `codex exec -`; pipes prompt via stdin; `--sandbox workspace-write` when `write_access` is true. Does not read or inject API keys. Parses JSONL event stream and extracts the final text from the `turn/completed` event. Auth failure detected from non-zero exit + stderr inspection. `ProviderResult.fix` should be populated for auth errors with "Run `codex login` to authenticate before using the openai provider."

---

### Slice 13c — 2026-05-05

**New module: `src/provider.ts`.** Exports `ProviderResult`, `Provider`, `SpawnFn`, and `ClaudeCodeProvider`.

**`SpawnFn` is exported** as a structural type describing only what `ClaudeCodeProvider` consumes from the child process (`stdin.write`/`end`, `stdout.on('data')`, `stderr.on('data')`, `on('close')`). Exporting it allows tests to construct mock spawn functions without importing `node:child_process` or casting through `any`. The real `spawn` from node is cast to `SpawnFn` inside the constructor default via `as unknown as SpawnFn`.

**`ClaudeCodeProvider.submit`** checks `ANTHROPIC_API_KEY` first; returns a structured `ProviderResult` with `error` and empty `output` if missing — does not throw. Spawns `claude -p --output-format json`; passes `--allowedTools Edit,Write,Read` unless `config.provider.sandbox.write_access` is explicitly `false`. Writes prompt to stdin. Parses stdout as JSON; extracts the `result` field as the output string.

**6 new tests in `tests/provider.test.ts` — all passing. 182 tests total, all passing; typecheck clean.**

**Next operator:** Slice 13d — implement `CodexProvider` in `src/provider.ts` following the same `Provider` interface. Spawns `codex exec -`; pipes prompt via stdin; `--sandbox workspace-write` when `write_access` is true. Reads `OPENAI_API_KEY`. Parses JSONL event stream and extracts the final text from the `turn/completed` event.

---

### Slice 13b — 2026-05-05

**`RaesConfig` extended with `provider` field.** Added to `src/config.ts`:
```
provider: {
  name: 'anthropic' | 'openai';   // required
  model?: string;                  // optional
  sandbox?: { write_access?: boolean };  // optional
}
```

**`extractConfig` updated.** Validates `provider.name` is present and is one of `anthropic` or `openai`. Missing `provider` section or unknown `provider.name` emits a `ConfigError` with a `fix` string. `model` and `sandbox.write_access` are optional — no error if absent. `write_access` is parsed from the YAML string `'true'`/`'false'` and stored as a boolean.

**`--check-config` success output updated.** `provider.name` now appears as a row in the verified fields table. Summary line changed to `raes.config.yaml OK — 6 artifact paths verified, provider: <name>.`

**`docs/raes.config.yaml` updated.** Added `provider: name: anthropic` so the project's own `--check-config` continues to pass.

**`tests/artifacts.test.ts` updated.** `makeConfig()` helper now includes `provider: { name: 'anthropic' }` to satisfy the updated `RaesConfig` type.

**8 new tests, all passing. 176 tests total, all passing; typecheck clean.**

**Next operator:** Slice 13c — implement `Provider` interface and `ClaudeCodeProvider` in `src/provider.ts`. `config.provider.name` is now validated before any provider is instantiated; `config.provider.sandbox.write_access` (default `true`) controls whether `--allowedTools Edit,Write,Read` is passed to the `claude` subprocess.

---

### Slice 13a — 2026-05-05

**New file: `src/prompts/execution-loop.md`.** Contains the canonical prompt text copied verbatim from `raes-reference.md` Section 7, "Default Prompt (canonical form)". This is the operative runtime copy; the raes-reference.md copy is the human-readable source of truth. Divergence between the two is accepted and managed manually.

**New module: `src/prompt.ts`.** Exports `loadPrompt(): string`. Reads `src/prompts/execution-loop.md` relative to its own module location using `import.meta.url`. Throws a `PromptLoadError` (extends `Error` with a `fix: string` field) if the file is missing. No config change, no provider call.

**`decisions.md` updated.** The existing decision entry that said "path TBD in provider slice" has been updated to reflect the resolved path: `src/prompts/execution-loop.md`.

**4 new tests in `tests/prompt.test.ts` — all passing. 168 tests total, all passing; typecheck clean.**

**Next operator:** Slice 13b — extend `raes.config.yaml` schema with `provider` key and add config validation. `loadPrompt()` from `src/prompt.ts` is the prompt loader; Slice 13c (ClaudeCodeProvider) and 13d (CodexProvider) will call it. The `provider.name` validation is the first thing needed before any provider can be instantiated.

---

### Slice 12a — 2026-05-05

**Finding: No AI provider is called.** Both `runExecutionLoop` (`src/execution-loop.ts`) and `runReviewLoop` (`src/review-loop.ts`) validate artifact boundaries, prompt `Proceed? [y/N]`, mark the slice complete in the pipeline, and exit. No AI API is called, no structured prompt is emitted, and no slice content (goal, acceptance criteria, constraints) is consumed or passed anywhere. The operator receives `Slice complete` without any work having been done.

**Three open flags — must be resolved before the next implementation slice:**

1. **CRITICAL AMBIGUITY — CLI calls AI vs. CLI emits prompt.** Slice 12a states loops require an AI Provider. `execution-guidance.md` Invariant 6 states the CLI "does not author, infer, or rewrite content" and that "Human or external AI agent is responsible for all substantive decisions." These are in tension: does the CLI call an AI API directly (Option A), or does it emit a structured prompt for the operator/external AI to act on (Option B)? Option A risks crossing Invariant 6; Option B keeps the CLI as a workflow enforcer. Human must decide before any provider abstraction is designed.

2. **"Default prompt" does not exist.** No prompt template for the Execution Loop or Review Loop exists anywhere in `src/` or `docs/`. The prompt format, content, and structure must be defined before a provider abstraction can be built.

3. **Scope of Slices 13–20 may shift.** If the resolution to flag 1 is Option A (CLI calls AI), slice definitions for 13–20 likely need revision. If Option B, the existing skeleton is closer to sufficient.

**No tests written (per slice definition).** No implementation code produced.

**Next operator:** Resolve the three flags above with the human before proceeding. Once the AI-provider/prompt question is answered, the next implementation slice should be: define the prompt template(s) for both loop types, then build the provider abstraction (or the prompt-emission surface) on top of the existing loop skeletons in `src/execution-loop.ts` and `src/review-loop.ts`.

---

### Slice 12 — 2026-05-05

**New module: `src/review-loop.ts`.** Exports `runReviewLoop(slice, config, cwd, io)`. Follows the same load → validate → prompt → write pattern as `runExecutionLoop`: loads all artifacts → validates boundaries → halts with exit 2 on violation → prompts `Proceed with review? [y/N]` → on confirmation, marks slice complete via `markSliceComplete` + `writeFileAtomic` → prints `Review complete: {label}` → exit 0; on decline or null input, prints `Review cancelled.` → exit 0.

**`markSliceComplete` imported from `src/execution-loop.ts`.** The function is already exported from there and shared between both loop modules. No new module or re-export was introduced.

**`-e` handler in `src/cli.ts` updated.** The `// Review Loop not yet implemented (Slice 12)` stub block is replaced with `return runReviewLoop(nextSlice, config, cwd, io)`. `runReviewLoop` is imported at the top of `src/cli.ts`.

**Existing "shows Review Loop" test updated.** Added `in: async () => null` to prevent the test from blocking once the Review Loop prompts for input. Previously safe because the stub exited before calling `io.in`; now required.

**164 tests, all passing; typecheck clean.**

**Next operator:** Slice 12 is complete. The next unchecked slice is Slice 13 — halt-on-ambiguity behavior: detect missing, conflicting, or boundary-violating artifacts; output actionable error messages and prevent advancement until resolved. Both `runExecutionLoop` and `runReviewLoop` already halt on boundary violations (exit 2), but the broader ambiguity detection (missing artifacts, conflicting constraints) is not yet systematic. Slice 13 is the place to harden this across the full execution path.

---

### Slice 11 — 2026-05-05

**New module: `src/execution-loop.ts`.** Exports two public symbols: `markSliceComplete(content, slice)` and `runExecutionLoop(slice, config, cwd, io)`. `markSliceComplete` does a plain string replace of `- [ ] {slice.label}` → `- [x] {slice.label}` and returns `null` if no matching unchecked line is found. `runExecutionLoop` is the full Execution Loop body: load all artifacts → validate boundaries → prompt `Proceed? [y/N]` → on confirmation, mark slice complete in pipeline via `writeFileAtomic` → exit 0; on decline or null input, print "Execution cancelled." → exit 0; on boundary violation, print violations to err → exit 2.

**`IO` interface in `src/cli.ts` extended with `in?: () => Promise<string | null>`.** Default implementation (used in production) reads one line from `process.stdin` via Node's `readline`. Injectable in tests. All existing commands that do not reach the Execution Loop are unaffected — `in` is only consumed inside `runExecutionLoop`.

**`-e` handler updated in `src/cli.ts`.** The stub tail (`err`/`return { exitCode: 1 }`) is replaced: for `loopType === 'execution'`, the handler now calls `runExecutionLoop(nextSlice, config, cwd, io)` and returns its result. For `loopType === 'review'`, the handler still prints "Review Loop is not yet implemented" and exits 1 — that stub is the insertion point for Slice 12.

**Boundary validation runs before the confirmation prompt.** If any artifact boundary is violated, execution halts immediately with exit 2 and the operator is shown the artifact path, issue description, and the offending header line. No confirmation prompt is shown.

**`markSliceComplete` replaces only the first matching unchecked line.** If the pipeline contains duplicate labels (unusual but possible), only the first `- [ ] {label}` occurrence is marked complete. This is consistent with `getPipelineStatus`, which also returns only the first unchecked slice.

**159 tests, all passing; typecheck clean.**

**Next operator:** Slice 11 is complete. The next unchecked slice is Slice 12 — Review Loop for `--execute-next-slice`: prompt for and record review decisions, validate artifact boundaries, update slice status and history upon completion. The insertion point in `src/cli.ts` is the `// Review Loop not yet implemented (Slice 12)` comment block in the `-e` handler. `runExecutionLoop` in `src/execution-loop.ts` is the reference implementation — the Review Loop follows the same load → validate → prompt → write pattern, but with review-specific prompts and the same `markSliceComplete` + `writeFileAtomic` for the pipeline update.

---

### Slice 10 — 2026-05-05

**New export: `determineLoopType` in `src/pipeline.ts`.** Accepts a `Slice`, returns `'execution' | 'review'`. Infers type by testing the slice label against `/\breview\b/i` — whole-word match, case-insensitive. This is an acknowledged limitation of the current pipeline format, which carries no explicit type metadata (the same deferred-metadata gap recorded for `--list-slices` and `--show-next-slice`). The inference rule is: label contains the word "review" → Review Loop; everything else → Execution Loop. A durable decision has been recorded in `decisions.md`.

**`--execute-next-slice`/`-e` handler added to `src/cli.ts`.** Follows the same pattern as `--show-next-slice`: `checkConfig` → read pipeline file → `getPipelineStatus`. If no next slice, prints "all slices complete" and exits 0. Otherwise, calls `determineLoopType`, prints the slice label and determined loop name to `out`, then writes a not-yet-implemented error to `err` and exits 1. The routing is fully implemented; only the loop bodies are stubs.

**`writeFileAtomic` is not called in this slice.** The skeleton makes no artifact writes. Slices 11 and 12 (loop implementations) are the first callers; they must import `writeFileAtomic` from `src/io.ts` for all artifact updates.

**148 tests, all passing; typecheck clean.**

**Next operator:** Slice 10 is complete. The next unchecked slice is Slice 11 — Execution Loop for `--execute-next-slice`: prompt for and record execution decisions, validate artifact boundaries, write results to correct artifact(s) only. The routing stub in the `-e` handler (the `if (argv.includes('--execute-next-slice') || argv.includes('-e'))` block) is the insertion point — replace the `err`/`return { exitCode: 1 }` tail with the full Execution Loop body. `writeFileAtomic` from `src/io.ts` is the required write primitive.

---

### Slice 9 — 2026-05-05

**New module: `src/io.ts`.** Exports a single function `writeFileAtomic(absolutePath, content): { error? }`. Writes content to `.raes-tmp-<8-byte-hex>` in the same directory as the target, then calls `renameSync` to swap atomically. On any failure (write or rename) the temp file is removed with a best-effort `unlinkSync` and an error string is returned. Returns `{}` on success.

**Module placement rationale.** `src/io.ts` is a new module, not an extension of `artifacts.ts` or `config.ts`. This keeps the I/O primitive separate from the artifact-loading logic and the config layer, consistent with system.md's "Command parsing, business logic, and I/O are separate layers" constraint. All future artifact write callers must import `writeFileAtomic` from `src/io.ts` — do not call `writeFileSync` directly on artifact paths elsewhere in the codebase.

**Temp file location is same directory as target.** `rename` is only atomic when source and target are on the same mount point. Placing the temp file in `dirname(absolutePath)` guarantees this without any runtime filesystem checks. A decision has been recorded in `decisions.md`.

**134 tests, all passing; typecheck clean.**

**Next operator:** Slice 9 is complete. The next unchecked slice is Slice 10 — `--execute-next-slice (-e)` command skeleton: integrate slice determination logic and execution loop routing (Execution Loop vs. Review Loop based on slice type). The `writeFileAtomic` function in `src/io.ts` is the write primitive for Slices 10–12; import it from there for all artifact updates.

---

### Slice 8 — 2026-05-05

**Arg parser extended to handle value-bearing flags.** The existing `for (const arg of argv)` validation loop was replaced with a `while` loop in `src/cli.ts`. When `--print-artifact` / `-p` is encountered, the loop reads `argv[i+1]` as the value and advances `i` by 2. If no value follows (or the next element starts with `-`), the loop returns exitCode 1 immediately with a usage message. All other flag and positional-arg validation is unchanged. No new module was created; the parser lives inline in `main`.

**`--print-artifact` handler added to `src/cli.ts`.** After the existing `--show-next-slice` handler. The handler: runs `checkConfig` → resolves the artifact name to a path via an inline `artifactMap` → reads the file → prints a two-line header (`Artifact:`, `Path:`), a blank line, then the full file content via the injected `out` sink. Exits 0 on success; exits 1 for unknown artifact name; exits 2 on config error or unreadable file.

**Artifact name map** (case-insensitive): `prd` → `build_intent`, `system` / `system_constraints` → `system_constraints`, `decisions` / `durable_decisions` → `durable_decisions`, `pipeline` / `next_slice` → `next_slice.path`, `execution-guidance` / `execution_guidance` → `execution_guidance`, `validation` → `validation`.

**`--flag` also needs a value argument** (not implemented in this slice). The `--flag` option is listed in `KNOWN_FLAGS` but remains a stub. When `--flag` is implemented (Slice 14), extend the while-loop parser by adding `'--flag'` to the value-bearing branch — the same pattern used here.

**125 tests, all passing; typecheck clean.**

**Next operator:** Slice 8 is complete. The next unchecked slice is Slice 9 — design and implement safe, atomic file I/O for artifact updates; establish transactional patterns to prevent partial writes or corrupted state. This is a foundational infrastructure slice that unblocks Slices 10–12 (execute-next-slice and its loops).

---

### Slice 7 — 2026-05-05

**New export: `formatNextSlice` in `src/pipeline.ts`.** Accepts a `Slice`, returns `string[]` — three labeled lines: `Position`, `Status`, `Label`. Status is `pending` for incomplete slices, `complete` for complete ones. Column alignment uses `padEnd(maxKey + 3)` where `maxKey` is the length of the longest key (`"Position"` = 8), giving consistent indentation across all three fields. Pure/sync, no external dependencies.

**`src/cli.ts` updated:** Added `formatNextSlice` to the import from `./pipeline.ts`. Handler for `--show-next-slice` / `-n` follows the same pattern as `--status` and `--list-slices`: `checkConfig` → read pipeline file → `getPipelineStatus` → if `nextSlice` exists, `formatNextSlice` → else `"all slices complete"`. Exits 0 on success; exits 2 on config error or unreadable pipeline file.

**PRD metadata fields deferred.** The PRD requires `--show-next-slice` to display type, constraints, goal, acceptance criteria, and related files. The current pipeline backlog format (`- [x] Slice N: label`) carries none of this. All deferred fields are omitted in v1 (not shown as placeholders); a decision has been recorded in `decisions.md`. Future slices that introduce structured metadata in the pipeline format must extend `Slice` in `src/pipeline.ts` and update `formatNextSlice`.

**116 tests, all passing; typecheck clean.**

**Next operator:** Slice 7 is complete. The next unchecked slice is Slice 8 — `--print-artifact (-p)`: print the content of a named RAES artifact to stdout. This command requires a value argument (e.g. `--print-artifact prd`). The Slice 1 handoff noted that the current arg parser only handles boolean flags; extending it to `--option <value>` pairs is the first task for Slice 8. `RaesConfig` in `src/config.ts` provides the artifact path map needed to resolve artifact names to file paths.

### Slice 6 — 2026-05-05

**New export: `formatSliceList` in `src/pipeline.ts`.** Accepts `Slice[]`, returns `string[]` — one formatted line per slice. Format: `{position padded}  {✓|○}  {label}`. Position column is right-padded to the width of the largest position number. Pure/sync, no external dependencies. Exported and tested alongside `parseSlices` and `getPipelineStatus`.

**`src/cli.ts` updated:** Added `formatSliceList` to the import from `./pipeline.ts`. Handler for `--list-slices` / `-l` follows the same pattern as `--status`: `checkConfig` → read pipeline file → `getPipelineStatus` → `formatSliceList` → write each line to `out`. Exits 0 on success; exits 2 on config error or unreadable pipeline file.

**`type` and `assignee` fields not shown.** The PRD requires `--list-slices` to display type and assignee per slice. The current pipeline backlog format (`- [x] Slice N: label`) carries no type or assignee metadata. Displaying these fields would require inference from label text, which violates the no-guessing anti-pattern. Both fields are deferred. A decision has been recorded in `decisions.md`. Future slices that introduce type/assignee metadata in the pipeline format must extend `Slice` in `src/pipeline.ts` and update `formatSliceList` accordingly.

**100 tests, all passing; typecheck clean.**

**Next operator:** Slice 6 is complete. The next unchecked slice is Slice 7 — `--show-next-slice (-n)`: print full details of the next unchecked slice (type, constraints, goal, acceptance criteria, related files). `parseSlices` from `src/pipeline.ts` is the natural foundation; the challenge is that the current `Slice` interface holds only `position`, `label`, and `complete` — it carries no structured metadata beyond the label string. The same type/assignee gap from Slice 6 applies here.

---

### Slice 5 — 2026-05-03

**New module: `src/pipeline.ts`.** Exports `Slice`, `PipelineStatus`, `parseSlices`, and `getPipelineStatus`. `parseSlices` scopes to the `## Slice Backlog` section (stops at the next `##`-level heading), matching `- [x]` and `- [ ]` lines via regex. All functions are pure/sync; no external dependencies.

**`src/cli.ts` updated:** Added `readFileSync` and `join` imports; added `getPipelineStatus` import from `./pipeline.ts`. The `--status`/`-s` handler reads the pipeline file at `config.sources.next_slice.path` relative to `cwd`, calls `getPipelineStatus`, and writes four labeled lines to `io.out`: `Project`, `Slices`, `Next`, `Flags`. Exits 0 on success, 2 on config or I/O error.

**Milestone not shown.** The pipeline format carries no per-slice milestone metadata. `--status` omits a milestone field; see `decisions.md` for the recorded decision.

**Flags stub.** `Flags: none` is hardcoded. The flag system (Slice 14) will replace this once implemented.

**Smoke test note.** The live `docs/raes.config.yaml` meta-project is not runnable via `node src/cli.ts --status` from the source tree because `raes.config.yaml` is in `docs/` rather than the project root. Tests against temp directories are the authoritative validation.

**85 tests, all passing; typecheck clean.**

**Next operator:** Slice 5 is complete. The next unchecked slice is Slice 6 — `--list-slices (-l)`. `parseSlices` from `src/pipeline.ts` is the natural foundation; `--list-slices` will need to format the full `Slice[]` array as a table (position, status icon, label).

---

### Slice 3a — 2026-05-03

**`system_constraints` now a formal config artifact.** `raes.config.yaml` already contained `system_constraints: docs/system.md`; this slice wired that field through the full stack.

**`RaesConfig.sources` extended:** Added `system_constraints: string`. `extractConfig` validates it as a required non-empty string (placed between `build_intent` and `next_slice` in the `requiredStringKeys` array). `validatePaths` checks it. The `RaesConfig` object literal in `extractConfig` populates it.

**`ArtifactRole` extended:** `'system_constraints'` added to the union in `src/artifacts.ts`. `loadAllArtifacts` specs array now includes `{ role: 'system_constraints', path: config.sources.system_constraints }`.

**`SYSTEM_EXEC_HEADERS` narrowed:** Removed `Known Contracts` and `Drift Guards` — those patterns belong to `system_constraints`, not `execution_guidance`. New value covers `Invariants|Anti-Patterns|Definition of Done|Workflow Rules` only.

**`SYSTEM_CONSTRAINTS_HEADERS` added:** `/^#{1,3}\s+(Product Invariants|Drift Guards|Known Contracts)\s*$/m`. Added as a forbidden pattern in `FOREIGN_RULES` for all roles except `system_constraints` itself. `system_constraints` FOREIGN_RULES excludes `SYSTEM_EXEC_HEADERS` because `system.md` legitimately contains `Anti-Patterns` and `Definition of Done`.

**`--check-config` success output:** Now lists 6 artifact paths (previously 5). `sources.system_constraints` appears second in the column-aligned table.

**65 tests, all passing; typecheck clean.**

**Next operator:** Slice 3a is complete. The next unchecked slice is Slice 4 — enhance `--check-config` output with per-error fix guidance, structured multi-line error blocks, error-count summary, and detailed success listing. (Note: this was substantially delivered in Slices 2 and 3a; Slice 4 may be re-scoped or skipped.) After Slice 4, the navigation commands (`--status`, `--list-slices`, `--show-next-slice`) are Slices 5–7.

---

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
