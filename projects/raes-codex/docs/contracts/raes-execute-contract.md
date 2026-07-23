# `raes-execute` Current Behavioral Contract

## 1. Purpose and scope

This document inventories the observable behavior of the existing `projects/raes-execute` prototype. It describes current code and verified tests; it is not a commitment to preserve every behavior in Codex-native RAES.

`raes-execute` locates a configured RAES project, validates a narrow config and artifact-boundary preflight, inspects pipeline state, selects the first parsed unchecked slice, routes it to an execution or review loop, invokes one of three agent CLIs, and optionally checks that slice’s pipeline checkbox after operator confirmation. It also offers read-only status and artifact commands. Evidence: `projects/raes-execute/src/cli.ts:16-40,74-442`; README, “What it does.”

It does not deterministically enforce implementation scope, run project validation commands, inspect the final repository diff, maintain history or flags, represent separate implemented/validated/accepted states, or prove that provider work satisfied the slice. Those stronger behaviors appear in the SRS, PRD, execution guidance, canonical prompt, or future architecture, but are absent or prompt-only in the current parent process.

## 2. Inputs and invocation

### 2.1 Commands and global options

The executable accepts no positional arguments. A bare invocation, `-h`, or `--help` prints help and exits `0`; `--version` prints hard-coded `0.1.0` and exits `0`. Help/version detection occurs before general option validation, so either can mask other invalid inputs. Evidence: `projects/raes-execute/src/cli.ts:14-87`.

Implemented action flags:

- `-c`, `--check-config`
- `-s`, `--status`
- `-l`, `--list-slices`
- `-n`, `--show-next-slice`
- `-p`, `--print-artifact <name>`
- `-e`, `--execute-next-slice`

Context options:

- `--config <path>`
- `--project <name>`
- `--workspace <path>`
- `--dry-run`, only with execution
- `--verbosity quiet|progress|debug`

Recognized but unimplemented flags are `--flag` and `--history`. Evidence: `projects/raes-execute/src/cli.ts:42-58,89-203,224-442`.

Unknown options, missing option values, unexpected positionals, standalone `--dry-run`, `--workspace` without `--project`, and combined `--project`/`--config` return usage errors with exit `1`. Multiple action flags are not rejected; fixed handler order chooses the first of check-config, status, list, show-next, execute, then print-artifact. This precedence is code-verified but lacks a focused multiple-action test. Evidence: `projects/raes-execute/src/cli.ts:96-203,224-442`.

### 2.2 Project and workspace resolution

Without `--config` or `--project`, the current working directory is the project root and `./raes.config.yaml` is required; there is no upward or nested discovery. With `--config`, the config’s directory becomes the project root, except an explicit path ending in `docs/raes.config.yaml` uses its parent project directory as a legacy special case. Evidence: `projects/raes-execute/src/config.ts:79-98,350-402`; config and CLI tests for explicit config, legacy config, and no discovery.

`--project` loads `raes.workspace.yaml` from the current directory or the explicit `--workspace` path, validates every project config path and every `shared_sources` path for existence, then resolves the named project’s config. Shared sources are not merged into or consumed by project execution. Evidence: `projects/raes-execute/src/config.ts:404-599`; `projects/raes-execute/src/cli.ts:206-222`; workspace tests.

### 2.3 Configuration input

Required fields are:

```yaml
project:
  name: <non-empty>
sources:
  build_intent: <path>
  system_constraints: <path>
  next_slice:
    path: <path>
    selection_rule: <non-empty>
  durable_decisions: <path>
  execution_guidance: <path>
  validation: <path>
provider:
  name: anthropic | openai | github_copilot
```

Optional fields include `provider.model`, OpenAI `transport: exec|app_server`, GitHub Copilot `transport: exec`, and `provider.sandbox.write_access`. Evidence: `projects/raes-execute/src/config.ts:4-27,100-321`.

The parser is a small indentation/key-value parser, not a general YAML implementation: it ignores non-colon lines and comments, treats scalars as strings, does not unquote values, and does not reject unknown keys. `selection_rule` need only be non-empty; slice selection always uses first unchecked regardless of its value. Invalid sandbox shapes or values generally degrade to defaults rather than schema errors. Evidence: `projects/raes-execute/src/config.ts:35-69,172-193,263-321`; `projects/raes-execute/src/pipeline.ts:44-49`.

All six configured paths are joined to the project root and checked only with `existsSync`. Directories and unreadable files can pass this check; `..` traversal is not confined to the project root. Evidence: `projects/raes-execute/src/config.ts:324-348`.

The config contains no RAES contract version, and the runtime declares no supported project-contract range.

## 3. Outputs and side effects

### 3.1 Read-only output

- `--check-config` prints six source paths, provider name, and an `OK` summary.
- `--status` prints project name, parsed complete/remaining/total counts, next label or “all slices complete,” and the literal `Flags: none`.
- `--list-slices` prints position, `✓`/`○`, and label.
- `--show-next-slice` prints only position, pending/complete status, and label.
- `--print-artifact` prints a header and the complete selected file.
- `--dry-run` prints selected slice, loop, provider, prompt path, pipeline path, write-access state, and a no-submission/no-write message after preflight.

Evidence: `projects/raes-execute/src/cli.ts:224-378,392-436`; `projects/raes-execute/src/pipeline.ts:52-77`; relevant CLI tests.

### 3.2 Provider subprocesses

Execution/review can launch:

| Config | Subprocess behavior |
|---|---|
| `anthropic` | `claude -p --output-format stream-json`; prompt on stdin; adds `--allowedTools Edit,Write,Read` unless write access is false. |
| `openai`, exec | `codex exec --json -`; prompt on stdin; adds `--sandbox workspace-write` unless write access is false. |
| `openai`, app server | `codex app-server --listen stdio://`; JSON-RPC initialize/thread/turn flow; `workspaceWrite` policy unless write access is false. |
| `github_copilot` | `copilot -p <prompt> --output-format=json --allow-all-tools`; adds deny-write and deny-shell only when write access is false; optional model in argv. |

Evidence: `projects/raes-execute/src/provider.ts:1780-2150`; provider tests for flags, authentication, parsing, progress, and routing.

Provider authentication is inherited from the invoked tool. Missing binaries and recognized authentication failures become structured errors, commonly with fix guidance. The app-server request timeout defaults to 5 seconds and turn completion timeout to 300 seconds. Evidence: `projects/raes-execute/src/provider.ts:314-365,404-434,1780-2150`; test `production default incomplete-turn timeout is 300 seconds`.

### 3.3 Repository mutation and state

The parent process itself writes only `pipeline.md`, replacing the first exact `- [ ] <selected-label>` anywhere in the current file with `- [x] <selected-label>` after a `y` confirmation. This write uses a same-directory temporary file and rename. Evidence: `projects/raes-execute/src/execution-loop.ts:37-47,117-148`; `projects/raes-execute/src/review-loop.ts:94-130`; `projects/raes-execute/src/io.ts:1-23`.

The provider runs before confirmation and normally receives write access. It can therefore modify application files and RAES artifacts before the operator answers. The parent does not inventory, constrain, validate, roll back, or atomically commit those provider writes. The decline message “No artifacts written” applies only to the parent’s completion record and is misleading if the provider already wrote files. This is source-verified; unit-test providers do not emulate uncontrolled child writes.

The only durable parent state is the checkbox. No history record, flag record, validation evidence, repository-state binding, or separate state transition is written.

### 3.4 Exit codes

| Exit | Current use |
|---|---|
| `0` | Help/version, successful inspection, no slices parsed, dry-run success, confirmed completion, or declined/empty confirmation. |
| `1` | CLI usage/unknown artifact errors and unimplemented known options. |
| `2` | Config/workspace/runtime artifact errors, boundary/preflight failure, provider failure/empty output, pipeline read/write/record failure. |

Unhandled exceptions from provider session startup or close can escape these curated paths because `startSession` is outside the loop’s `try` and close errors occur in `finally`. Evidence: `projects/raes-execute/src/execution-loop.ts:91-102`; `projects/raes-execute/src/review-loop.ts:74-85`.

## 4. Primary workflows

### 4.1 Configuration and artifact validation

`--check-config`:

1. resolves config and project root;
2. parses the restricted config format;
3. validates required schema/provider fields;
4. checks existence of all six artifact paths;
5. prints either all errors with available fixes and exits `2`, or a summary and exits `0`.

It does not read artifact contents, validate boundaries, validate project-contract version, or prove path readability/type. Evidence: `projects/raes-execute/src/config.ts:350-402`; `projects/raes-execute/src/cli.ts:224-253`.

Execution/review preflight additionally reads all six artifacts, checks a list of foreign heading patterns, and loads the bundled prompt. Evidence: `projects/raes-execute/src/artifacts.ts:26-156`; `projects/raes-execute/src/slice-preflight.ts:17-54`.

Boundary validation recognizes only exact level-one-to-three headings from fixed lists. It does not parse semantic content, aliases, lower-level headings, or every boundary in `docs/raes-reference.md`. Notably, `next_slice` is not checked for execution-guidance headings, and `system_constraints` is allowed to contain them. Evidence: `projects/raes-execute/src/artifacts.ts:79-129`.

### 4.2 Status and inspection

Status, list, and show-next read the pipeline after config validation and call the same parser. Missing or unreadable pipeline content exits `2`; a syntactically absent or empty backlog is instead treated as zero slices and “all slices complete”/empty output. Print-artifact maps aliases for the six roles, rejects an unknown artifact name with exit `1`, and reports unreadable content with exit `2`. Evidence: `projects/raes-execute/src/cli.ts:255-335,392-436`; `projects/raes-execute/tests/pipeline.test.ts`.

### 4.3 Next-slice selection and loop routing

The parser:

1. enters a level-one-to-three heading exactly named `Slice Backlog`;
2. stops at the next level-one-to-three heading;
3. accepts only exact `- [x] ...` and `- [ ] ...` items;
4. assigns positions in parsed order;
5. selects the first unchecked item.

Evidence: `projects/raes-execute/src/pipeline.ts:14-49`; pipeline tests.

It does not recognize uppercase `[X]`, slice metadata, prerequisites, blocked state, milestone membership, explicit type, or configured selection semantics. Any level-three milestone heading immediately after the backlog heading terminates parsing. Missing/malformed/empty backlog is not an error.

Loop type is inferred from the whole word `review` in the selected label, case-insensitively; all other labels route to execution. Evidence: `projects/raes-execute/src/pipeline.ts:62-68`; determine-loop-type tests.

### 4.4 Execution slice

1. CLI resolves config and selects/routes the slice.
2. The loop preflight reads artifacts, checks heading boundaries, and loads the same generic prompt used by review.
3. A provider session starts and receives the bundled prompt.
4. Progress is rendered at quiet/progress/debug verbosity.
5. Provider errors or empty final output halt with exit `2`.
6. Non-empty output is printed.
7. Operator is asked whether to record the slice complete.
8. Only an answer equal to `y` after trimming/case-folding records completion; every other answer exits `0` without the parent write.
9. The current pipeline is reread, the exact label is replaced, and the file is atomically renamed.

Evidence: `projects/raes-execute/src/execution-loop.ts:64-148`; execution-loop and CLI tests.

The parent neither passes the selected slice as structured prompt input nor verifies the provider acted on it. The bundled prompt tells the agent to reread config and choose the first unchecked slice, which can diverge if state changes between selection and provider work. Evidence: `projects/raes-execute/src/prompts/execution-loop.md:3-13`; `projects/raes-execute/src/execution-loop.ts:85-96`.

### 4.5 Review slice

The review loop has the same parent mechanics and preflight, with different completion text. The same combined prompt contains review-specific instructions such as no implementation code and role-appropriate recording. The parent does not deterministically enforce those instructions or inspect provider writes. Evidence: `projects/raes-execute/src/review-loop.ts:47-130`; `projects/raes-execute/src/prompts/execution-loop.md:66-92`.

### 4.6 Dry run

`--execute-next-slice --dry-run` selects and routes the slice, runs artifact/prompt preflight, and prints resolved execution information without creating a provider or writing through the parent loop. It does not validate slice acceptance criteria, configured test commands, repository cleanliness, ambiguity, or whether the provider binary/auth is available. Evidence: `projects/raes-execute/src/cli.ts:337-378`; dry-run CLI tests.

### 4.7 Completion recording

Any non-empty provider output becomes eligible for confirmation. A `y` records the checkbox even if the output reports failed tests, unresolved flags, no implementation, multiple-slice work, or out-of-scope changes. There is no post-provider validation gate. Consequently the existing checkbox means operator-confirmed recording, but the implementation and documentation often call it completion/acceptance without the distinct Implemented, Validated, and Accepted states required by future architecture.

## 5. Deterministic, model-dependent, human, and documented behavior

| Classification | Current behavior |
|---|---|
| Deterministic code | Config/root resolution; restricted parsing/schema checks; path existence; heading-pattern preflight; first parsed unchecked selection; label-based routing; provider command construction; empty/error handling; exact `y` gate; atomic checkbox write. |
| Agent/model dependent | Repository inspection, analysis, planning, tests, implementation, review, handoff notes, decisions, ambiguity detection, one-slice compliance, validation-command execution, and respecting write scope. |
| Prompt-only | Execution/review sequences, “one slice only,” no review-slice implementation, artifact update roles, conflict flagging, test/typecheck, and stopping after the slice. |
| Human dependent | Choosing to invoke execution, reviewing free-form output, answering completion confirmation, interpreting failures/flags, and repairing provider-created changes. |
| Documented but not implemented | History, flags, milestone/type/assignee details, explicit proceed confirmation before provider work, acceptance-criteria enforcement, artifact write enforcement, constraint promotion, machine-readable output, post-work validation, and separate acceptance. |

Evidence: bundled prompt at `projects/raes-execute/src/prompts/execution-loop.md`; parent loops; PRD and SRS command descriptions; `docs/execution-guidance.md`.

## 6. Preconditions, invariants, and failure behavior

### Preconditions

- A resolvable config with all required non-empty fields and a recognized provider.
- Six existing artifact paths.
- A parseable unchecked slice for execution; otherwise the tool exits `0` as if all work is complete.
- A loadable bundled prompt and no detected foreign-heading violations.
- The configured provider CLI installed and authenticated for a real execution.

### Deterministically enforced invariants

- At most one parent checkbox replacement per invocation.
- Only exact parsed first-unchecked selection is routed.
- Provider errors and empty final output prevent the parent checkbox write.
- Explicit `y` is required for the parent checkbox write.
- The parent pipeline replacement is atomic at the single-file level.
- Dry run does not submit to a provider or enter the parent write path.

### Not enforced or fails open

- Empty/malformed/milestone-bearing backlogs can be interpreted as complete.
- The configured selection rule is ignored.
- Paths may escape the project root or identify directories.
- Semantic ambiguity, placeholders, missing acceptance criteria, contradictory authoritative sources, and unavailable validation commands do not fail preflight.
- Provider writes may occur before confirmation and outside intended boundaries.
- No repository diff or post-provider artifact/config validation is performed.
- Non-empty prose is enough to permit checkbox recording.
- A checkbox is used as a single completion/acceptance state.
- The exact label replacement is not scoped to the parsed backlog and can replace the first matching unchecked line elsewhere.
- Session startup/close exceptions may escape structured error handling.
- Concurrency/stale-state detection and locking do not exist.

Recovery is manual except that provider/auth errors include guidance and an unconfirmed slice leaves the parent checkbox unchanged. Provider-created changes are not automatically reverted.

## 7. Observable command and interface behavior

| Command | Status | Observable behavior |
|---|---|---|
| help / bare invocation | Complete | Help, exit `0`, no config required. |
| version | Complete | `raes-execute 0.1.0`, exit `0`; package itself has no version field. |
| check-config | Partial validator | Schema/provider/path existence only; `0` or `2`. |
| status | Partial | Counts/next label; flags always `none`; no milestone. |
| list-slices | Partial | Position/status/label only; no type or assignee despite docs. |
| show-next-slice | Partial | Position/status/label only, not “full details.” |
| print-artifact | Complete for mapped roles | Reads/prints one whole artifact; unknown name `1`, runtime failure `2`. |
| execute-next-slice | Functional prototype | Preflight, agent subprocess, human checkbox recording. |
| execute-next-slice --dry-run | Complete narrow preflight | No provider submission/parent writes; limited checks. |
| verbosity | Complete observer control | `quiet`, `progress`, `debug`; does not alter execution semantics. |
| project/workspace/config | Functional prototype | Explicit context selection; no auto-discovery. |
| flag | Stub | Bare flag reaches “not implemented,” exit `1`; values become unexpected positionals. |
| history | Stub | Bare flag reaches “not implemented,” exit `1`; a count becomes an unexpected positional. |
| machine-readable output/color controls | Deferred/documented only | No interface. |

Help text itself overstates status, list, show-next, flag, and history behavior. Evidence: `projects/raes-execute/src/cli.ts:16-40,439-442`.

## 8. Evidence and traceability

Primary executable evidence:

- CLI and action precedence: `projects/raes-execute/src/cli.ts`.
- Config/workspace parser and validation: `projects/raes-execute/src/config.ts`.
- Artifact loading/boundary rules: `projects/raes-execute/src/artifacts.ts`.
- Pipeline grammar and loop inference: `projects/raes-execute/src/pipeline.ts`.
- Preflight: `projects/raes-execute/src/slice-preflight.ts`.
- Execution/review and human gate: `projects/raes-execute/src/execution-loop.ts` and `review-loop.ts`.
- Atomic parent write: `projects/raes-execute/src/io.ts`.
- Provider transports: `projects/raes-execute/src/provider.ts`.
- Model instructions: `projects/raes-execute/src/prompts/execution-loop.md`.
- Automated evidence: all eleven files in `projects/raes-execute/tests/`.

Supporting intent evidence:

- `projects/raes-execute/docs/srs.md` in full, especially command, preflight, loop, provider, failure, and known-gap sections.
- `projects/raes-execute/docs/prd.md`, `system.md`, `decisions.md`, `pipeline.md`, `execution-guidance.md`, and `validation.md`.
- `projects/raes-execute/README.md`.
- `docs/raes-reference.md`, especially artifact boundaries, slice loops, configuration, and known gaps.

Validation on 2026-07-23:

- `npm run typecheck` in `projects/raes-execute`: passed.
- `npm test`: 329 tests ran; 328 passed and 1 failed.
- The failure is `project execution-guidance.md Workflow Rule 3 contains explicit execution loop sequence`. The test expects `PLAN → SLICE → EXECUTE → TEST → EXPLAIN → FLAG → REVIEW → RECORD` at `tests/project-docs.test.ts:41-46`, while the current document contains `ANALYZE → PLAN → GENERATE → IMPLEMENT → TEST → EXPLAIN → FLAG → REVIEW → RECORD` at `docs/execution-guidance.md:15-21`.
- A temporary cross-tool probe generated a `cli` project with `raes-init` and passed the resulting pipeline to `parseSlices`; the observed slice count was `0`, confirming the milestone-heading incompatibility without changing the repository.
- All provider tests use mocked subprocesses; live binary/auth/provider behavior remains source-verified rather than end-to-end verified.

## 9. Discrepancies and gaps

| Conflict | Implemented behavior | Classification |
|---|---|---|
| Init output vs execute schema | Init config has no required provider section. | Blocking interoperability defect. |
| Init deterministic pipelines vs execute grammar | A milestone heading ends parsing before any slice; execute reports complete. | Blocking interoperability defect with no regression test. |
| README/help says status shows milestone/flags | No milestone; flags are always literal `none`. | Interface documentation overstatement/deferred capability. |
| README/help says list shows type and show-next shows full details | List has position/status/label; show-next has three fields. | Interface documentation overstatement. |
| SRS says flag/history stubs exit `2` | Current known-option fallback exits `1`; values are rejected as positionals. | SRS/code defect. |
| SRS/decisions say app-server completion timeout is 30 seconds | Code and test use 300 seconds. | Documentation drift or unresolved intentional change. |
| SRS/execution guidance require validation and write-boundary enforcement | Parent only preflights headings; provider is instructed to run tests and can write broadly. | Major implementation gap/model-only enforcement. |
| Documentation says parent records results/handoff/history | Parent writes only the checkbox; provider may write notes by instruction. | Documentation overstatement. |
| “No artifacts written” on decline | Provider may already have modified the repository. | Misleading interface text and safety defect. |
| SRS halt-on-ambiguity | Parent detects only missing files, narrow heading conflicts, prompt failure, provider error/empty output. | Major implementation gap/model-only enforcement. |
| `selection_rule` config semantics | Any non-empty value passes; code always chooses first unchecked. | Schema/behavior defect. |
| Missing/empty backlog behavior | Reported as all complete rather than malformed/ambiguous. | Fail-open defect. |
| Execution guidance’s loop test vs document | One current test fails because its expected older sequence differs from the document and prompt. | Pre-existing test/document drift. |
| Execution vs review classification | Whole-word label heuristic, not explicit slice metadata. | Known prototype limitation. |
| Current checkbox vs architecture state model | Confirmation immediately checks `[x]`; no Pending/Blocked/Implemented/Validated/Accepted distinction. | Breaking semantic gap requiring architectural decision/migration. |
| Current config vs architecture versioning | No contract version or supported range. | Prototype gap requiring a legacy policy. |
| SRS says no remote calls/non-RAES writes in some constraint language | Real provider subprocesses may use network and edit project code. | Internal SRS contradiction. |
| `validation.md` content | Contains init-oriented create-or-fail wording unrelated to execute. | Supporting-document copy/paste defect. |

## 10. Codex-native relevance

| Capability | Relevance classification |
|---|---|
| Resolve project/config and authoritative artifact roles | Required for Stage 1; current parser/path rules need adaptation and version checks. |
| Deterministically select exactly one unambiguous slice | Required for Stage 1; current grammar is insufficient. |
| Read all authoritative sources and detect material ambiguity | Required for Stage 1; current heading check is useful reference but not sufficient. |
| Route execution versus review | Required for Stage 1; explicit semantics are preferable to preserving the label heuristic, subject to contract decision. |
| Codex-driven analysis, implementation, review, explanation, and flagging | Required for Stage 1 and should move from child-provider prompts into native Codex workflow. |
| Run configured validation and inspect final repository changes | Required for Stage 1; currently absent from deterministic parent enforcement. |
| Separate implementation/validation from explicit human acceptance | Required for Stage 1; current checkbox behavior must be adapted, not copied. |
| Atomic single-slice acceptance record | Required for Stage 1; current atomic file write is useful reference but lacks stale-state/evidence checks. |
| Status and artifact inspection | Useful Stage 1 support and broader practical-replacement behavior. |
| Workspace map | Relevant to a later stage unless chosen as the Stage 1 project-selection mechanism. |
| Multiple provider adapters/subprocess parsers | Useful reference behavior that need not be preserved by Codex-native RAES. |
| Progress renderer | Useful reference behavior, not a RAES semantic requirement. |
| History, durable flags, machine-readable output | Relevant to later practical replacement, with some durable ambiguity record potentially required by Stage 1. |
| Current fail-open parsing, unchecked provider writes, and completion conflation | Should not be carried forward. |

Classification follows `projects/raes-codex/docs/architecture.md`, especially “Stage 1,” “Deterministic RAES kernel,” “Slice State and Acceptance Model,” “Testing Strategy,” and “Versioning and Evolution.”

## 11. Open questions

1. **What is the canonical pipeline grammar and legacy policy?** Init, execute, templates, reference, and tests do not agree on milestone headings and valid state syntax. A grammar/version decision is required and blocks safe Stage 1 selection.
2. **How will legacy `[ ]`/`[x]` state map to Pending, Blocked, Implemented, Validated, and Accepted?** Architecture proposes distinct states while current executable semantics have one unchecked/checked transition. A migration/compatibility decision is required and blocks Stage 1 acceptance semantics.
3. **What exact evidence must be bound to validation and acceptance?** Architecture requires repository-state binding and explicit acceptance, but current artifacts/config have no record schema. This blocks a reliable deterministic Stage 1 acceptance operation.
4. **Which ambiguities can be detected structurally and which require Codex/human judgment?** Current preflight is too narrow, while architecture requires halt on material ambiguity. Architecture intentionally leaves semantic judgment partly model/human dependent. The minimum deterministic gate and report schema require a decision; this is a Stage 1 design blocker.
5. **Must Stage 1 preserve workspace selection?** Current workspace support is functional but shared sources are validation-only. This does not block a single-project Stage 1.
6. **Which current provider/runtime behaviors remain relevant once Codex is native?** The adapters expose useful failure cases and progress taxonomy, but architecture says the RAES contract remains provider-independent. This does not block core Stage 1 behavior.
7. **Is the 300-second app-server timeout intentional?** Code/test conflict with SRS/decisions. It is not a Codex-native semantic blocker but is unresolved current-contract documentation drift.
8. **What does a checked legacy slice mean?** Current implementation records it after free-form operator confirmation without validation evidence. Architecture treats `[x]` as Accepted. Treating all historical checks as validated acceptance may be unsafe; the legacy policy must decide.

## 12. Contract summary

The current `raes-execute` demonstrates explicit config roles, narrow project/workspace resolution, first-unchecked selection, label-based execution/review routing, provider subprocess adapters, prompt-driven one-slice workflows, human confirmation, and an atomic parent checkbox write. These are observable prototype behaviors, not complete RAES enforcement.

The critical risks are fail-open backlog parsing, init/execute incompatibility, shallow artifact preflight, ignored selection semantics, unrestricted provider mutations before confirmation, no post-work validation or diff inspection, no durable history/flags, and conflation of provider output, completion, validation, and acceptance. Stage 1 requires compatible versioned project semantics, deterministic one-slice selection and gates, Codex-native reasoning, actual validation, explicit ambiguity handling, repository-state inspection, and a separate human acceptance transition. This contract records those needs without designing or implementing the replacement.
