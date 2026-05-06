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

- [x] Slice 13f-config: Add explicit project-targeting config behavior for monorepos.
  - Update config loading so `raes-execute` reads `./raes.config.yaml` from the current working directory by default.
  - Add optional `--config <path>` override so operators can target a specific RAES project from a monorepo root or sibling directory.
  - Do not implement implicit upward search or repo-wide discovery.
  - Standardize the canonical config location to the RAES project root; update error messages and help text accordingly.
  - Tests: current-directory config success; explicit `--config` success; missing local config with actionable error; ambiguous/discovery behavior must not exist.

- [x] Slice 13f-compat: Support explicit legacy `docs/raes.config.yaml` targeting without changing canonical layout.
  - Keep the canonical default config location at the RAES project root.
  - When `--config` points to a legacy `docs/raes.config.yaml`, resolve artifact paths relative to the RAES project root rather than `docs/`.
  - Do not add implicit upward search or repo-wide discovery.
  - Decide whether to emit a deprecation notice for legacy config paths; if so, keep it informational and non-blocking.
  - Tests: `--config ./docs/raes.config.yaml` works for a legacy project fixture; root-config behavior remains unchanged.

- [x] Slice 13r-file-rights: Review Slice — Define the canonical artifact boundary rules
  - Read the current `docs/raes-reference.md` in full. Locate the existing section that describes artifact file roles (Section 3 or equivalent). Note the exact heading and location where the File Boundaries section will be inserted.
  - Read `docs/artifact-boundaries.md` in full. This is the authoritative input for this slice — do not modify its content during this review; treat it as the draft to be promoted.
  - Compare the permitted and forbidden heading lists in `docs/artifact-boundaries.md` against the current `docs/raes-reference.md` artifact descriptions. Flag any conflict or gap between the two before writing anything.
  - If no conflicts are found, insert the File Boundaries section from `docs/artifact-boundaries.md` into `docs/raes-reference.md` at the identified location. Do not rewrite or summarize — insert the content as-is.
  - If conflicts are found, do not write. Record each conflict as a flag with a description of what must be resolved by human decision before this slice can complete.
  - After insertion, verify that `raes-reference.md` contains exactly one authoritative definition for each artifact's job, decision right, mutation rule, and permitted/forbidden headings. No duplication with existing sections.
  - Append handoff notes to `projects/raes-execute/docs/pipeline.md` recording:
    - What was inserted and at what location in `docs/raes-reference.md`
    - Any conflicts found and how they were resolved or flagged
  - No new slices need to be generated in this step

- [x] Slice B1: Strip `pipeline.md` to backlog and handoff state only

  **Loop:** Execution Loop
  **Artifacts read:** `docs/raes-reference.md` (File Boundaries section), `pipeline.md`
  **Artifacts written:** `pipeline.md`, `decisions.md`
  **Tests:** Verify `pipeline.md` contains only permitted headings per `raes-reference.md`

  **Steps:**

  1. Read the File Boundaries section of `docs/raes-reference.md`. This is the
     sole authority for what headings are permitted and forbidden in `pipeline.md`.

  2. Read `pipeline.md` in full. For each heading present, check it against the
     permitted heading list for `pipeline.md` in `raes-reference.md`.

  3. For each forbidden heading found, record in a working list:
     - The heading name
     - The destination artifact as specified in `raes-reference.md`
     - The full content under that heading

  4. Remove all forbidden headings and their content from `pipeline.md`.
     Do not place them in their destination artifacts yet — that is the work
     of B2 and B3. Write the working list as a comment block at the top of
     a temporary file `docs/b1-displaced-content.md` so B2 and B3 have an
     explicit handoff rather than relying on this conversation.

  5. Verify the resulting `pipeline.md` contains only headings from the
     permitted list in `raes-reference.md`.

  6. Record in `decisions.md`: confirmation that `pipeline.md` has been
     scoped to backlog and handoff state only, with date.

  7. Append handoff notes to `pipeline.md` recording what was removed,
     where displaced content is staged, and that B2 and B3 must consume
     `docs/b1-displaced-content.md` before it is deleted.

  **Acceptance criteria:**
  - `pipeline.md` contains only `## Slice Backlog` and `## Handoff Notes`
  - All removed content is staged in `docs/b1-displaced-content.md` with
    destination artifact noted for each section per `raes-reference.md`
  - `raes-execute --check-config` passes


- [x] Slice B2: Reconstruct `system.md` from `raes-reference.md` and staged content

  **Loop:** Execution Loop
  **Artifacts read:** `docs/raes-reference.md` (File Boundaries section),
    `docs/b1-displaced-content.md`, `system.md`
  **Artifacts written:** `system.md`, `decisions.md`
  **Tests:** Verify `system.md` contains only permitted headings per `raes-reference.md`

  **Steps:**

  1. Read the File Boundaries section of `docs/raes-reference.md`. This is the
     sole authority for what headings are permitted and forbidden in `system.md`.

  2. Read `docs/b1-displaced-content.md`. Identify all sections marked with
     destination `system.md`.

  3. Read the current `system.md` in full. For each section in the displaced
     content marked for `system.md`, determine whether equivalent content
     already exists in `system.md`.

  4. For each displaced section:
     - If no equivalent exists in `system.md`: insert it under the correct
       permitted heading as defined in `raes-reference.md`.
     - If an equivalent exists: compare the two versions. Keep the more
       specific and accurate version. Record the resolution in `decisions.md`.
     - If the content is a resolved Unknown (already answered in `decisions.md`):
       do not insert it into `system.md`. Record its resolution in `decisions.md`
       with today's date and remove it from the displaced content list.

  5. Scan `system.md` for any headings that are on the forbidden list in
     `raes-reference.md`. Flag any found — do not proceed past this check
     if violations remain.

  6. Verify the resulting `system.md` contains only permitted headings.

  7. Record in `decisions.md`: what was merged, what was discarded as duplicate,
     and what Unknowns were closed, each with date and rationale.

  8. Append handoff notes to `pipeline.md`. Mark `docs/b1-displaced-content.md`
     sections consumed by this slice as done. Note remaining sections for B3.

  **Acceptance criteria:**
  - `system.md` contains only headings from the permitted list in `raes-reference.md`
  - No content that belongs in `system.md` remains in `b1-displaced-content.md`
  - All resolved Unknowns are recorded in `decisions.md` with date
  - No duplicate constraint definitions exist between `system.md` and any
    other artifact
  - `raes-execute --check-config` passes

- [x] Slice B3: Reconstruct `execution-guidance.md` from `raes-reference.md` and staged content

  **Loop:** Execution Loop
  **Artifacts read:** `docs/raes-reference.md` (File Boundaries section),
    `docs/b1-displaced-content.md`, `execution-guidance.md`, `system.md`
  **Artifacts written:** `execution-guidance.md`, `decisions.md`
  **Tests:** Verify `execution-guidance.md` contains only permitted headings
    per `raes-reference.md`

  **Steps:**

  1. Read the File Boundaries section of `docs/raes-reference.md`. This is the
     sole authority for what headings are permitted and forbidden in
     `execution-guidance.md`.

  2. Read `docs/b1-displaced-content.md`. Confirm all sections are now marked
     as consumed (by B2) or marked with destination `execution-guidance.md`.
     If any sections remain unmarked, flag before proceeding.

  3. Read the current `execution-guidance.md` in full. Identify the six-item
     `## Invariants` section. Per `raes-reference.md`, Invariants belong in
     `system.md`, not here. Verify B2 has already placed them there before
     removing them from this file.

  4. Remove `## Invariants` from `execution-guidance.md` only after confirming
     the content is present in `system.md`.

  5. Move `## Definition of Done` from `system.md` to `execution-guidance.md`
     under the permitted headings for this file. Record the move in `decisions.md`.

  6. Fix the Milestone 1 guidance:
     - Remove the CLI library options list (Click, Commander.js, Cobra) —
       the decision is already recorded in `decisions.md` (TypeScript + Node.js).
       Replace with a reference to that decision.
     - Correct the performance target from 100ms to 200ms to match the
       contract in `decisions.md`.

  7. Fix Workflow Rules 3 and 4 (Execution Loop and Review Loop descriptions):
     - Replace the circular reference ("according to RAES execution loop rules")
       with the explicit loop sequence:
       Execution Loop: PLAN → SLICE → EXECUTE → TEST → EXPLAIN → FLAG → REVIEW → RECORD
       Review Loop: PLAN → SLICE → INSPECT → SYNTHESIZE → FLAG → REVIEW → RECORD

  8. Scan `execution-guidance.md` for any headings on the forbidden list in
     `raes-reference.md`. Flag any found.

  9. Delete `docs/b1-displaced-content.md` once all sections are confirmed
     consumed. Record deletion in handoff notes.

  10. Record in `decisions.md`: what was moved, what was corrected, and why,
      with date.

  11. Append handoff notes to `pipeline.md` confirming B1 staged content is
      fully consumed and the temporary file has been deleted.

  **Acceptance criteria:**
  - `execution-guidance.md` contains only permitted headings per `raes-reference.md`
  - `## Invariants` is absent from `execution-guidance.md`
  - `## Definition of Done` is present in `execution-guidance.md`
  - Workflow Rules 3 and 4 contain the explicit loop sequences
  - Milestone 1 references the decisions.md entry for toolchain rather than
    listing alternatives
  - `docs/b1-displaced-content.md` has been deleted
  - `raes-execute --check-config` passes


- [x] Slice B4: Verify boundary compliance across all artifacts

  **Loop:** Review Loop
  **Artifacts read:** `docs/raes-reference.md` (File Boundaries section),
    all six project artifacts
  **Artifacts written:** `pipeline.md` (handoff notes only)
  **Tests:** `raes-execute --check-config` and `raes-execute --execute-next-slice --dry-run`

  **Steps:**

  1. Read the File Boundaries section of `docs/raes-reference.md`.

  2. For each artifact, check every heading against its permitted and forbidden
     lists in `raes-reference.md`. This is the same check the validator runs —
     do it manually first to confirm the automated check will pass.

  3. Verify the four promotion rules in `raes-reference.md` are satisfied:
     - No Unknown in `system.md` is already answered in `decisions.md`
     - No constraint exists only in `decisions.md` without a corresponding
       `system.md` entry where one is required
     - No content exists only in this conversation or in a temporary file

  4. Run `raes-execute --check-config`. It must pass with no errors.

  5. Run `raes-execute --execute-next-slice --dry-run`. Confirm no artifact
     boundary violations are reported.

  6. If any violation is found in steps 2–5, halt. Record the violation as
     a flag. Do not mark this slice complete until all violations are cleared.

  7. Append handoff notes confirming all artifacts are boundary-compliant
     and the dry-run passed. Note that Slice C (raes-init template updates)
     is now unblocked.

  **Acceptance criteria:**
  - All six artifacts contain only permitted headings per `raes-reference.md`
  - `raes-execute --check-config` passes
  - `raes-execute --execute-next-slice --dry-run` reports no boundary violations
  - No content from the B1 displaced content staging file remains anywhere

- [x] Slice 13g: Review Slice — Define the codex app-server integration contract for raes-execute.
  -  Read the current `src/provider.ts`, `src/execution-loop.ts`, and `src/review-loop.ts`.
  -  Read the Codex app-server protocol references recorded in `decisions.md`.
  - Identify the exact mismatch between the current one-shot `submit(prompt)` provider contract and the long-lived app-server protocol.
  - Produce an implementation contract covering:
    - process lifecycle ownership
    - request/response boundaries
    - notification handling
    - final result extraction
    - failure handling
    - shutdown behavior
  - Flag any protocol ambiguity explicitly before implementation.
  - No code changes in this slice.
  - No tests required for this slice.

- [x] Slice 13h: Extend provider config schema for OpenAI app-server mode.
  - Add config support for selecting the OpenAI transport mode under `provider`, for example `provider.openai.transport: exec | app_server`, while preserving current config compatibility.
  - Keep `exec` as the default unless a durable decision is recorded to change the default.
  - Validate the new config fields and emit actionable fix strings on invalid values.
  - Update the project config fixture/docs if needed so `--check-config` still passes.
  - Tests:
    - valid config with implicit default transport
    - valid config with explicit `app_server`
    - invalid transport value returns config error with fix string
    - existing configs without the new field remain valid

- [x] Slice 13i: Introduce a session-capable provider abstraction without breaking Claude or existing Codex exec mode.
  - Refactor the provider layer so OpenAI can support a long-lived app-server session while Claude and current Codex exec mode continue to work.
  - Define the minimal new abstractions needed for:
    - session startup
    - turn submission
    - streaming normalized progress events
    - final result delivery
    - session shutdown
  - Keep the existing loop call sites as stable as possible.
  - Do not implement app-server transport in this slice; establish types and wiring only.
  - Tests:
    - existing one-shot provider paths still pass
    - new abstraction supports progress callbacks without transport-specific behavior
    - factory/types remain compatible with Claude provider

- [x] Slice 13j: Implement Codex app-server stdio transport and JSON-RPC client.
  - Spawn `codex app-server --listen stdio://` as a subprocess.
  - Implement JSON-RPC client behavior for:
    - request id generation
    - request/response correlation
    - notification routing
    - stderr capture
    - subprocess close/error handling
    - clean shutdown
  - Keep transport logic isolated from loop rendering and RAES-specific output formatting.
  - No execution/review loop integration in this slice.
  - Tests:
    - mocked stdio startup handshake
    - request/response correlation
    - notification receipt
    - malformed payload handling
    - subprocess termination before clean shutdown

- [x] Slice 13k: Implement Codex app-server event normalization into RAES provider progress events.
  - Parse app-server notifications and normalize them into a stable RAES event model.
  - Support at minimum:
    - `turn/started`
    - `turn/completed`
    - `item/started`
    - `item/completed`
    - `item/agentMessage/delta`
    - `item/reasoning/summaryTextDelta`
    - `item/commandExecution/outputDelta`
    - `turn/plan/updated`
    - `turn/diff/updated`
  - Preserve enough structured data for operator-facing rendering to distinguish command execution, agent messages, reasoning summaries, plan updates, and diff updates.
  - Do not finalize terminal formatting in this slice.
  - Tests:
    - event fixtures for each supported notification type
    - normalized outputs match expected RAES progress events
    - unsupported notifications degrade safely without failing the turn

- [x] Slice 13l: Add rich operator progress rendering for execution and review loops.
  - Update `src/execution-loop.ts` and `src/review-loop.ts` to render normalized streaming events from the provider.
  - Show more than coarse lifecycle labels by surfacing:
    - current action
    - command being run
    - selected command output snippets
    - plan updates
    - file or diff summaries where available
  - Add output coalescing or truncation rules so the terminal remains readable during long turns.
  - Preserve the existing confirmation gate after final agent output is complete.
  - Tests:
    - execution loop prints intermediate progress before final output
    - review loop prints intermediate progress before final output
    - noisy delta streams are coalesced or truncated predictably
    - final confirmation prompt still appears after the full agent result

- [x] Slice 13m: Wire OpenAI provider selection to choose app-server transport when configured.
  - Update provider factory logic so OpenAI selects `exec` or `app_server` based on config.
  - Preserve current authentication expectations and sandbox-related behavior.
  - Keep `exec` mode working as a fallback path during rollout.
  - Ensure provider errors remain actionable and distinguish:
    - transport startup failure
    - protocol failure
    - agent execution failure
    - authentication failure
  - Tests:
    - factory selects `exec` when configured or by default
    - factory selects `app_server` when configured
    - OpenAI provider error paths remain structured and actionable
    - existing Claude factory behavior is unchanged

- [x] Slice 13n: Add failure-recovery behavior for Codex app-server execution.
  - Define and implement recovery or failure behavior for:
    - startup failure
    - JSON-RPC timeout or no response
    - incomplete turn
    - malformed notification
    - subprocess termination mid-turn
  - Ensure operator output clearly distinguishes transport failure from agent failure.
  - Keep artifact write behavior unchanged: no slice is recorded on provider failure.
  - Tests:
    - each failure mode returns a structured provider error
    - loop exits with error without writing pipeline changes
    - fix guidance is present where recovery action is known

- [x] Slice 13o: Review Slice — Validate that app-server integration improves operator observability without regressing slice execution behavior.
  - Compare the original `codex exec` operator feedback against the new app-server path.
  - Verify that execution and review slices still preserve:
    - artifact boundary checks
    - provider output before confirmation
    - explicit operator confirmation before recording completion
    - no writes on provider failure
  - Identify any regressions in readability, noise level, or failure handling.
  - If durable guidance emerges for event rendering, add it to execution guidance; if the findings are only relevant to the immediate next slice, record them as handoff notes instead.
  - No implementation code in this slice.
  - No new slices required unless the review finds concrete gaps.

- [ ] Slice 13g-1: Add missing-binary handling for provider subprocesses.
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

- [ ] Slice 13h-1: Add clearer provider/preflight output.
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

- [ ] Slice 13i-1: Add empty-output guard before slice recording.
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

### Slice 13o — 2026-05-06

**Review completed.** App-server integration does improve operator observability relative to the original `codex exec --json` path because it now exposes structured progress for turn lifecycle, work-item lifecycle, command output, plan updates, and diff updates through `CodexAppServerSession` and `createProgressRenderer`, instead of relying on the thinner one-shot event stream from `codex exec`. Evidence inspected:
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/provider.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/progress-renderer.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/execution-loop.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/review-loop.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/tests/provider.test.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/tests/execution-loop.test.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/tests/review-loop.test.ts`

**Preserved behavior verified.**
- Artifact boundary checks still run before provider submission in both loops via `runSlicePreflight`; failures still halt with exit code 2 and no write path entered.
- Provider output still appears before the confirmation prompt in both loops.
- Explicit operator confirmation still gates slice recording.
- Provider failures still return exit code 2 and leave the pipeline unchanged.
- Current validation is green: `npm test` and `npm run typecheck` both passed from `projects/raes-execute/`.

**Concrete gaps from this review.**
- Runtime output still does not tell the operator which OpenAI transport is active. `execution-loop.ts` and `review-loop.ts` print the same generic `Provider: started; waiting for progress...` line for both `codex exec` and app-server, so the improved observability is real but not self-identifying at the loop entry point. This is an immediate follow-up for Slice 13h-1.
- The project config still defaults OpenAI to `exec` when `provider.openai.transport` is omitted, so app-server observability is opt-in rather than the default operator path. This is not a regression, but it means the richer feedback is only available when the config explicitly selects `app_server`.
- Review evidence is test-backed rather than live end-to-end against a real Codex session. That is acceptable for this slice, but the remaining risk is around real CLI noise level and operator readability under long-running turns.

**No execution-guidance update added.** The findings are immediate operational context for the next transport/UX slices, not a five-slices-later durable workflow rule.

**Next recommended slice:** `Slice 13g-1` remains the right next implementation slice because missing-binary handling is still an unaddressed hard failure path. After that, `Slice 13h-1` should make the active transport and failure class visible in loop preflight output.

### Slice 13n — 2026-05-06

**Execution completed.** Updated `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/provider.ts` so `CodexAppServerSession` now applies explicit recovery/failure behavior for the remaining app-server gaps from Slice 13n: request timeouts, incomplete turns, malformed `turn/completed` notifications, and mid-turn subprocess exits now resolve to structured `ProviderResult` errors labeled as protocol, agent-execution, or transport failures as appropriate. Existing execution/review loop behavior was preserved: provider failures still return exit code 2 and do not write pipeline changes.

**Files analyzed:**
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/raes.config.yaml`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/prd.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/system.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/pipeline.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/execution-guidance.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/decisions.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/validation.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/provider.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/execution-loop.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/review-loop.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/tests/provider.test.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/tests/execution-loop.test.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/tests/review-loop.test.ts`

**Tests added/updated:** `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/tests/provider.test.ts` now covers app-server startup failure, JSON-RPC timeout/no-response, incomplete turn timeout, malformed `turn/completed` notifications, and subprocess termination mid-turn. No new loop tests were needed because execution and review loops already had passing no-write-on-provider-error coverage, and those protections remained unchanged.

**Validation run:**
- `npm test`
- `npm run typecheck`

**Operational notes for next operator:** Slice 13o should review whether the new failure labels and timeout behavior improve operator observability without adding too much noise. The current defaults are a 5s request timeout and a 30s turn-completion timeout; if review finds those thresholds too aggressive or too lax, adjust them deliberately rather than implicitly in later transport work.

### Slice 13m — 2026-05-06

**Execution completed.** Updated `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/provider.ts` so OpenAI provider creation now honors `provider.openai.transport`, defaulting to `exec` and selecting a new `CodexAppServerProvider` wrapper when `app_server` is configured. The app-server path now returns structured `ProviderResult` failures for startup/authentication/protocol issues instead of rejecting through the execution/review loops, and `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/execution-loop.ts` plus `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/review-loop.ts` now pass the slice cwd into provider creation so app-server turns run against the intended project root.

**Files analyzed:**
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/raes.config.yaml`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/prd.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/system.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/pipeline.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/execution-guidance.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/decisions.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/validation.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/provider.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/execution-loop.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/review-loop.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/tests/provider.test.ts`

**Tests added/updated:** `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/tests/provider.test.ts` now covers default/explicit OpenAI transport factory selection, `app_server` provider selection, JSON-RPC request failures surfacing as structured protocol errors, and app-server authentication failures returning actionable `codex login` guidance.

**Validation run:**
- `npm test -- provider.test.ts`
- `npm test`
- `npm run typecheck`

**Operational notes for next operator:** Slice 13n should build on the new structured app-server failure surface and add explicit recovery behavior for incomplete turns, malformed notifications, timeouts, and mid-turn subprocess exits. The current app-server path classifies startup/auth/protocol failures, but it still stops on first failure rather than retrying or downgrading to `exec`.

### Slice 13l — 2026-05-06

**Execution completed.** Added shared rich progress rendering in `src/progress-renderer.ts` and wired both `src/execution-loop.ts` and `src/review-loop.ts` to consume structured provider events. Loop output now surfaces status, message, tool, plan, and diff progress with deterministic command-output coalescing so long turns remain readable while preserving the final confirmation gate after the full agent result.

**Files analyzed:**
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/raes.config.yaml`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/prd.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/system.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/pipeline.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/execution-guidance.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/decisions.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/validation.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/provider.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/execution-loop.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/review-loop.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/progress-renderer.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/tests/execution-loop.test.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/tests/review-loop.test.ts`

**Tests added/updated:** `tests/execution-loop.test.ts` and `tests/review-loop.test.ts` now assert structured progress rendering, command-output coalescing/truncation behavior, and confirmation ordering after the final agent output.

**Validation run:**
- `npm test -- tests/execution-loop.test.ts tests/review-loop.test.ts`
- `npm test`
- `npm run typecheck`

**Operational notes for next operator:** Rendering currently treats diff updates as file-level summaries and plan updates as one line per step. Slice 13m should keep this loop-facing renderer stable while switching the OpenAI factory from `exec` to config-selected `exec` or `app_server`.

### Slice 13k — 2026-05-06

**Execution completed.** Added explicit app-server notification normalization in `src/provider.ts` so `CodexAppServerSession` now emits a stable RAES progress model for `turn/started`, `item/started`, `item/completed`, `item/agentMessage/delta`, `item/reasoning/summaryTextDelta`, `item/commandExecution/outputDelta`, `turn/plan/updated`, and `turn/diff/updated`. Unsupported notifications now degrade safely to a generic status event without failing the turn.

**Files analyzed:**
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/raes.config.yaml`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/prd.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/system.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/pipeline.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/execution-guidance.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/decisions.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/validation.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/provider.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/execution-loop.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/review-loop.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/tests/provider.test.ts`

**Tests added/updated:** `tests/provider.test.ts` now covers one fixture per required notification family, asserts normalized structured progress events, verifies unsupported notifications degrade safely, and updates the existing session-streaming expectation to the richer event shape.

**Validation run:**
- `npm test`
- `npm run typecheck`

**Operational notes for next operator:** Loop rendering still only uses `kind` and `text`. Slice 13l should consume the new structured fields (`phase`, `item`, `command`, `delta`, `plan`, `files`, `eventType`) when adding richer operator-visible progress output, and should define coalescing/truncation rules there rather than in the provider layer.

### Slice 13j — 2026-05-06

**Execution completed.** Added an isolated `CodexAppServerSession` in `src/provider.ts` that spawns `codex app-server --listen stdio://`, performs the JSON-RPC startup handshake (`initialize` → `initialized` → `thread/start`), submits turns with `turn/start`, routes notifications while a turn is active, captures stderr, correlates request/response ids, and performs explicit `thread/unsubscribe` shutdown.

**Files analyzed:**
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/raes.config.yaml`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/prd.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/system.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/pipeline.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/decisions.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/execution-guidance.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/validation.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/config.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/provider.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/execution-loop.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/review-loop.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/tests/provider.test.ts`

**Tests added/updated:** `tests/provider.test.ts` now covers mocked app-server startup handshake, request/response correlation, notification receipt during a turn, malformed JSONL handling, subprocess termination before clean shutdown, and JSON-RPC error responses.

**Validation run:**
- `npm test`
- `npm run typecheck`

**Operational notes for next operator:** The new app-server transport is intentionally isolated and is not selected by `createProvider()` yet. `CodexAppServerSession` currently reuses the existing coarse `summarizeCodexEvent()` path by mapping JSON-RPC notification `method` names into the existing event summarizer; Slice 13k should replace that shim with explicit app-server notification normalization rather than extending the temporary mapping.

### Slice 13i — 2026-05-06

**Execution completed.** Introduced an explicit provider session layer in `src/provider.ts` with `startSession()`, `ProviderSession.submitTurn()`, and `ProviderSession.close()`. Claude and current Codex exec mode still run as one-shot subprocesses underneath that abstraction.

**Files analyzed:**
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/raes.config.yaml`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/prd.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/system.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/pipeline.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/decisions.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/execution-guidance.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/validation.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/config.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/provider.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/execution-loop.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/review-loop.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/cli.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/tests/cli.test.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/tests/provider.test.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/tests/execution-loop.test.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/tests/review-loop.test.ts`

**Tests added/updated:** Added provider-session coverage in `tests/provider.test.ts` and updated loop/CLI provider doubles so session lifecycle is exercised without transport-specific behavior.

**Validation run:**
- `npm test`
- `npm run typecheck`

**Operational notes for next operator:** The loop call sites now open and close a provider session per slice, but the OpenAI path is still backed by `codex exec --json`. Slice 13j can implement app-server stdio and JSON-RPC inside the new session boundary without changing the loop contract again.

### Slice 13h — 2026-05-06

**Execution completed.** Added OpenAI transport config parsing and validation in `src/config.ts` with backward-compatible defaulting to `provider.openai.transport: exec` when `provider.name` is `openai`.

**Files analyzed:**
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/raes.config.yaml`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/prd.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/system.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/pipeline.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/execution-guidance.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/decisions.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/validation.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/config.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/provider.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/cli.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/tests/config.test.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/tests/provider.test.ts`

**Tests added/updated:** `tests/config.test.ts` now covers implicit OpenAI transport defaulting, explicit `app_server`, invalid transport values with fix guidance, and legacy config compatibility without the new field.

**Validation run:**
- `npm test`
- `npm run typecheck`
- `node --experimental-strip-types src/cli.ts --check-config --config docs/raes.config.yaml`

**Operational notes for next operator:** No provider factory or runtime behavior changed in this slice; OpenAI still resolves to the existing exec-mode provider. Slice 13i should introduce the session-capable abstraction before any app-server transport implementation is attempted.

### Slice 13g — 2026-05-06

**Review completed.** This was a Review Slice only. No implementation files changed and no tests were added or run.

**Artifacts inspected:**
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/prd.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/system.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/pipeline.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/decisions.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/execution-guidance.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/validation.md`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/provider.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/execution-loop.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/review-loop.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/config.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/src/slice-preflight.ts`
- `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/tests/provider.test.ts`

**Current-state to build-intent comparison:** The current provider layer satisfies the existing one-shot execution goal: load prompt, submit one full turn, stream coarse progress, print final output, then require explicit operator confirmation before recording completion. That still aligns with the current build intent and single-slice invariants.

**Exact contract mismatch identified:** `src/provider.ts` exposes `submit(prompt, hooks?) -> Promise<ProviderResult>` and each provider owns a single subprocess per turn. The OpenAI app-server protocol is sessioned and bidirectional. It requires process startup independent of any one turn, request/response correlation across JSON-RPC messages, asynchronous notifications during a turn, explicit final-turn completion detection, and graceful shutdown after the session lifecycle ends. The current loop call sites only understand a terminal `output` string plus coarse progress callbacks, so they cannot own or reason about session startup, shutdown, transport failure, or turn-level protocol state.

**Implementation contract for follow-on slices:**
- Process lifecycle ownership: the OpenAI app-server transport must own subprocess startup, stdio wiring, JSON-RPC framing, and clean shutdown. Execution/review loops must not manage raw child-process lifecycle directly.
- Request/response boundaries: session startup and session shutdown are separate provider concerns. A slice execution/review turn must be a distinct provider operation within an already-started session, not equivalent to process spawn.
- Notification handling: app-server notifications must be consumed continuously during an active turn and normalized before they reach loop rendering. Loops should consume normalized RAES progress events, not raw protocol payloads.
- Final result extraction: completion must be driven by the authoritative turn-completed protocol event, with final operator-visible text extracted from that completed turn state rather than inferred from subprocess close alone.
- Failure handling: transport startup failure, protocol failure, agent execution failure, authentication failure, and premature subprocess termination must remain distinct error classes with actionable fixes where known. No artifact write may occur for any provider/session failure.
- Shutdown behavior: the provider must attempt orderly session termination after a completed or failed turn and must tolerate already-dead subprocesses during cleanup without masking the original failure.

**Gaps (explicit):**
- The current `Provider` interface has no place to represent session startup, session shutdown, or multiple turns over one process.
- `ProviderProgressEvent` is too coarse for the events named in the recorded app-server decision (`turn`, `item`, command output, plan update, diff update).
- `runExecutionLoop()` and `runReviewLoop()` assume provider completion is equivalent to one resolved promise and do not model session cleanup or transport-level failure states separately from agent output failure.
- `CodexProvider` currently treats subprocess close as the end of the interaction and parses `codex exec --json` JSONL only; it has no JSON-RPC transport boundary.

**Flags:**
- No blocking conflict was found between build intent, system constraints, execution guidance, and the recorded app-server decision.
- Protocol ambiguity remains open until implementation references are consulted during transport work: this review did not inspect the external app-server documents directly, so exact JSON-RPC method names, startup handshake details, and shutdown message shape must be confirmed in Slice 13j before transport code is written.

**Next operator:** Slice 13h is the next recommended slice. Extend provider config schema for OpenAI transport selection while preserving current `exec` behavior as the default/fallback, then proceed to Slice 13i to introduce the session-capable abstraction required by this contract before implementing the app-server transport.

### Slice B1 — 2026-05-06

**Pipeline scope corrected.** Removed the forbidden `## Purpose`, `## Invariants`, `## Known Contracts`, and `## Unknowns` sections from `pipeline.md` so the file now contains only backlog and handoff state, per `docs/raes-reference.md` Section 3a.

**Displaced content staged for follow-on slices.** The removed sections were copied into `docs/b1-displaced-content.md` with explicit destination metadata:
- `## Purpose` staged for `docs/prd.md`
- `## Invariants`, `## Known Contracts`, and `## Unknowns` staged for `docs/system.md`

**Validation added.** `tests/project-docs.test.ts` now asserts that the project `docs/pipeline.md` uses only the permitted top-level headings `## Slice Backlog` and `## Handoff Notes`.

**FLAG — Config/source mismatch (open):** `docs/raes.config.yaml` does not declare `docs/raes-reference.md` as an authoritative artifact, but Slice B1 depends on that shared file as the source of truth for pipeline boundaries. This slice proceeded because B1 names `docs/raes-reference.md` explicitly, but future workflow slices should either declare this shared dependency in config or continue to name it explicitly in the backlog.

**Next operator:** Slice B2 is next. Consume `docs/b1-displaced-content.md` before making any further boundary edits, and do not delete it until both B2 and B3 have fully absorbed the staged sections.

### Slice B3 — 2026-05-06

**`execution-guidance.md` reconstructed to boundary compliance.** All changes verified against `raes-reference.md` Section 3a.

**`## Invariants` removed.** The six execution-guidance.md invariants were verified present in `system.md` (`## Product Invariants`, `## Drift Guards`, `## Known Contracts`) before removal. The section is now absent from `execution-guidance.md`.

**FLAG (open) — Invariant 6 not yet explicit in `system.md`:** "No AI Creativity or Content Generation" is recorded in `decisions.md` but is not yet a `system.md` Product Invariant or Drift Guard. A human should decide whether to promote it to `system.md`. This does not block B4.

**`## Definition of Done` removed from `system.md`.** The seven-item `## Definition of Done` in `execution-guidance.md` is now the sole DoD for this project. The `system.md` DoD process rules (failing tests first, minimum implementation) are captured by the canonical RAES execution loop sequence in `raes-reference.md` Section 4. Recorded in `decisions.md`.

**Workflow Rules 3 and 4 corrected.** The circular "according to RAES execution loop rules" phrase replaced with the explicit loop sequences. Both rules now also reflect the provider-submission model (CLI submits canonical prompt to provider; operator reviews output before recording completion).

**Milestone 1 corrected.** CLI library options list removed; replaced with pointer to `decisions.md` TypeScript+Node toolchain decision. Performance baseline corrected from `<100ms` to `<200ms` to match the recorded contract.

**`docs/b1-displaced-content.md` deleted.** All staged sections confirmed consumed:
- `## Invariants`, `## Known Contracts`, `## Unknowns` — consumed by Slice B2 (system.md)
- `## Purpose` — treated as absorbed by the existing `### TL;DR` in `prd.md`; the heading `## Purpose` is not permitted in `prd.md` per Section 3a and the content is already represented. Recorded in `decisions.md`.

**FLAG (pre-existing, open) — `execution-guidance.md` and `prd.md` are truncated mid-sentence at line 224 and 204 respectively.** Both files end with "Validate inputs against" in Milestone 3. This is a pre-existing condition from project init, not introduced by B3. A human should complete Milestone 3 guidance or explicitly mark it as out-of-scope for remaining slices.

**FLAG (pre-existing, open) — `system.md` not declared in `raes.config.yaml` as a formal artifact.** Noted in B1 and B2 handoffs; still unresolved. Proceeding to B4 since the backlog names `raes-reference.md` explicitly and the config/source mismatch does not block boundary compliance verification.

**Validation:** 217 tests passing, typecheck clean, `--check-config` passes.

**Next operator:** Slice B4 is next — verify boundary compliance across all artifacts, run `--check-config` and `--execute-next-slice --dry-run`.

### Slice B2 — 2026-05-06

**`system.md` reconstructed from authoritative sources.** `/Users/aquilabdullah/devel/projects/raes/docs/raes-reference.md`, `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/b1-displaced-content.md`, and `/Users/aquilabdullah/devel/projects/raes/projects/raes-execute/docs/system.md` were compared section-by-section. The staged `Invariants`, `Known Contracts`, and `Unknowns` content was consumed into `system.md`, keeping the more accurate live-project wording where the staged copy was stale.

**System constraints strengthened, stale contracts discarded.** `system.md` now carries the stronger single-slice, boundary-discipline, atomic-write, and explicit-pipeline-source constraints from the staged content. Two staged contracts were intentionally not promoted because they no longer match the project:
- slice definitions and milestone structure living in config
- dedicated local status/history files already existing

**Unknowns narrowed.** The resolved Unknown about the config schema was removed from `system.md` and recorded in `decisions.md`. Remaining Unknowns were narrowed to unresolved runtime behavior and future state/history format questions only.

**Displaced-content handoff updated.** `docs/b1-displaced-content.md` no longer contains any `docs/system.md` destination block. The only remaining staged content is the PRD purpose section, which still needs its owning slice.

**FLAG — shared-source dependency still explicit-in-backlog only (open):** This slice again depended on `/Users/aquilabdullah/devel/projects/raes/docs/raes-reference.md`, which is not declared in `docs/raes.config.yaml`. The backlog names it explicitly, so execution could proceed, but the config/source mismatch from Slice B1 remains unresolved.

**Next operator:** Slice B3 is next. Use the live `raes-reference.md` file as authority, remove the forbidden `## Invariants` section from `execution-guidance.md` only after confirming the content remains covered in `system.md`, and then consume or delete the remaining temporary staged-content file as directed by the B3 slice.

### Slice 13r-file-rights — 2026-05-06

**Insertion completed.** `## 3a. Artifact File Boundaries` was inserted into `docs/raes-reference.md` between Section 3 ("Artifact Responsibilities") and Section 4 ("The Two Slice Types"). Content was taken verbatim from `docs/artifact-boundaries.md`; heading levels were shifted down one tier to fit the document hierarchy (`##` → `###`, `###` → `####`).

**What was inserted:**
- Decision Rights Table (all 7 artifacts)
- Permitted and Forbidden Headings (per-file, all 7 artifacts: prd.md, system.md, decisions.md, pipeline.md, execution-guidance.md, validation.md, prd-ux-review.md)
- Promotion and Cross-Reference Rules (4 rules)

**No blocking conflicts found** between `docs/artifact-boundaries.md` and `docs/raes-reference.md`. Two items require human awareness:

1. **FLAG — Ambiguity (open):** `artifact-boundaries.md` lists `## Technical Considerations` as a permitted heading in `prd.md`. `raes-reference.md` Section 3 says PRD should not contain "technical constraints." These are not a direct contradiction (product-level considerations vs implementation choices) but create surface tension. A human should decide whether Section 3's "No: technical constraints" language needs clarification or whether `## Technical Considerations` needs a scope note.

2. **Duplication concern (open):** `raes-reference.md` Section 3 contains a "promotion rule" paragraph covering the decision→constraint path. The newly inserted Section 3a also contains "Promotion and Cross-Reference Rules" which covers the same path (plus three additional rules). Both now exist in the document. The Section 3a version is more complete and should be considered authoritative; the Section 3 paragraph is now redundant. A human should remove or replace the Section 3 "The promotion rule" subsection in a future editorial pass.

3. **Out-of-scope observation:** The current `projects/raes-execute/docs/execution-guidance.md` has a `## Invariants` top-level section. Section 3a now states `## Invariants` is a **forbidden** heading in `execution-guidance.md` (belongs in `system.md`). This is a boundary violation in the existing file that was not introduced by this slice. A future slice should rename that section or promote its content to `system.md`.

**Next operator:** Slice 13g is the next unchecked execution slice. It adds missing-binary handling for provider subprocesses (`claude`/`codex` not on PATH). The resolved project root from `checkConfig()` is already in place from Slices 13f-config and 13f-compat.

### Slice 13f-config — 2026-05-05

**Explicit project targeting is now implemented.** `src/cli.ts` accepts `--config <path>` and passes it through all implemented command paths that load config: `--check-config`, `--status`, `--list-slices`, `--show-next-slice`, `--print-artifact`, and `--execute-next-slice`.

**No discovery behavior was added.** `src/config.ts` still defaults to `./raes.config.yaml` in the current working directory when `--config` is absent. It does not search upward or scan child directories. Running from a monorepo root without `--config` still fails with an actionable missing-config error.

**Explicit config changes the effective project root.** When `--config` is provided, `checkConfig()` now resolves the config file path and returns the config directory as the effective project root. All artifact reads, pipeline resolution, dry-run preflight, and execution/review loop calls now use that resolved root rather than the invocation directory.

**Operator-facing guidance was tightened.** Help text now lists `--config`, and the default missing-config fix guidance now tells the operator to either run from a RAES project root or pass `--config <path>`.

**Validation:** `npm test` and `npm run typecheck` both pass from `projects/raes-execute/`. Test count is now 206 passing.

**Next operator:** Slice 13g is next. It can build on the explicit project-root plumbing already in place and should keep using the resolved target project root rather than the invocation cwd when surfacing provider runtime failures.

### Slice 13t — 2026-05-06

**Review completed.** The first unchecked slice was a Review Slice with no implementation work, tests, or new slices required. Current state was inspected against the configured build intent, system constraints, durable decisions, execution guidance, and validation guidance before recording completion.

**Findings:** The current CLI already loads the configured provider, runs slice preflight, and routes execution/review slices through provider-backed loops. This remains aligned with the build intent for disciplined single-slice execution and the existing provider integration slices already completed.

**Gaps (explicit):**
- `src/provider.ts` does not yet distinguish missing `claude` / `codex` binaries on PATH from other subprocess failures; there is no `ENOENT`-specific handling or operator fix guidance for that case.
- The next backlog slice (`Slice 13g`) directly covers that gap and is still the correct next slice to execute.

**Artifacts produced:** `docs/pipeline.md` updated to mark this review slice complete and record handoff only. No implementation files changed.

**Next operator:** Execute Slice 13g next. Keep the change scoped to provider missing-binary detection, loop surfacing, and tests only.

### Slice 13f-compat — 2026-05-05

**Legacy explicit config targeting now resolves from the project root.** `src/config.ts` now treats an explicit `--config .../docs/raes.config.yaml` as a legacy layout and resolves the configured artifact paths relative to the parent project root instead of `docs/`. Canonical default behavior is unchanged: `raes-execute` still reads `./raes.config.yaml` from the current working directory unless `--config` is passed.

**Coverage added only for the compatibility path.** `tests/config.test.ts` now asserts that `checkConfig()` returns the parent project directory as `projectRoot` for an explicit legacy docs config. `tests/cli.test.ts` now covers `--status --config ./docs/raes.config.yaml` from outside the target project to prove pipeline and artifact lookup still work through the CLI path.

**No deprecation notice was added.** This slice keeps legacy explicit targeting silent and non-blocking; there is no operator-facing warning yet.

**Validation:** `npm test` and `npm run typecheck` both pass from `projects/raes-execute/`. Test count is now 208 passing.

**Next operator:** Slice 13g is next. Reuse the resolved target project root from `checkConfig()` when surfacing missing-binary provider failures so runtime errors still point at the correct project in monorepo and legacy-config cases.

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
