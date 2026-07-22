# Software Requirements Specification: raes-execute

**Version:** 1.0  
**Date:** 2026-06-23  
**Status:** Describes the actual implemented state of `raes-execute` as of the current codebase  
**Authoritative sources inspected:** `src/cli.ts`, `src/config.ts`, `src/provider.ts`, `src/pipeline.ts`, `src/execution-loop.ts`, `src/review-loop.ts`, `src/artifacts.ts`, `src/prompt.ts`, `src/slice-preflight.ts`, `src/io.ts`, `src/progress-renderer.ts`, `src/prompts/execution-loop.md`, `tests/` (11 suites), `docs/prd.md`, `docs/pipeline.md`, `docs/decisions.md`, `docs/system.md`, `docs/execution-guidance.md`, `docs/validation.md`, `raes.config.yaml`, `docs/raes-reference.md`

---

## 1. Introduction

### 1.1 Purpose

This document describes the actual functional state of `raes-execute` — a CLI tool that runs one slice of a RAES project at a time, enforces artifact boundaries, and gates slice completion on explicit operator confirmation. It is written against the implemented codebase, not the PRD, and is intended to:

- provide an accurate baseline for future development
- identify gaps between the PRD and the current implementation
- serve as a reference for contributors, auditors, and consumers of the tool

### 1.2 Scope

`raes-execute` is a TypeScript CLI that reads a `raes.config.yaml` source map, identifies the next unchecked slice from the configured pipeline, submits a canonical prompt to a configured AI provider (Claude Code, Codex, or GitHub Copilot), streams the agent's response to the operator, and — on explicit operator confirmation — marks the slice complete in the pipeline artifact. Every write is atomic; every slice requires a fresh invocation.

It does **not** author content, generate code independently, or bypass RAES artifact rules. It is a workflow enforcer and submission mechanism, not a content author or autonomous agent.

### 1.3 Definitions

| Term | Definition |
|---|---|
| **Slice** | One unit of work in the pipeline backlog, identified by a `- [ ]` or `- [x]` entry |
| **Execution Loop** | The 9-step RAES loop for code-producing work: `ANALYZE → PLAN → GENERATE → IMPLEMENT → TEST → EXPLAIN → FLAG → REVIEW → RECORD` |
| **Review Loop** | The 7-step RAES loop for artifact-producing work: `PLAN → SLICE → INSPECT → SYNTHESIZE → FLAG → REVIEW → RECORD` |
| **Canonical prompt** | The prompt text in `src/prompts/execution-loop.md`, loaded at runtime and submitted to the provider |
| **Provider** | A configured AI backend (Claude Code, Codex, or GitHub Copilot) invoked as a subprocess |
| **Session** | A provider process lifecycle: `startSession()` / `submitTurn()` / `close()` |
| **Artifact boundary** | The rule that each RAES artifact owns specific headings and may not contain headings belonging to other artifacts |
| **Operator confirmation gate** | The interactive `[y/N]` prompt after provider output; slice is not marked complete without explicit `y` |
| **Atomic write** | The temp-file + rename pattern that ensures the target file is never in a partial state |
| **Workspace** | A `raes.workspace.yaml` file that maps project names to config paths in a monorepo |

### 1.4 Relationship to the PRD

The PRD at `docs/prd.md` is the stated intent. This SRS describes what is actually implemented. Where they differ, Section 8 (Gap Analysis) records the difference explicitly.

### 1.5 Relationship to raes-reference.md

The RAES methodology is defined in `docs/raes-reference.md`. `raes-execute` implements that methodology mechanically. Where the CLI deviates from the canonical spec for operational reasons, those deviations are recorded in `docs/decisions.md`.

---

## 2. System Overview

### 2.1 Product Perspective

`raes-execute` is the execution engine of the RAES toolchain:

| Tool | Status | Purpose |
|---|---|---|
| `raes-init` | Implemented | Initialize a new project with RAES docs |
| `raes-execute` | Implemented | Execute one slice at a time against an initialized project |
| `raes-discover` | Not yet implemented | Map an existing brownfield repo to `raes.config.yaml` |

`raes-execute` consumes the artifacts that `raes-init` produces. It reads `raes.config.yaml` to locate all authoritative sources and reads `execution-loop.md` to load the prompt. It writes only to the configured pipeline artifact, and only when the operator confirms.

### 2.2 Governing Design Constraints

The following constraints are enforced by the implementation and are non-negotiable:

1. **One slice per invocation.** The CLI enforces a single-slice execution boundary. There is no batch or multi-slice mode.
2. **Halt before ambiguity proceeds.** Any config error, missing artifact, boundary violation, or empty provider output terminates with exit code 2 before any artifact is written.
3. **Operator confirmation required.** Slice completion is never automatic. The operator must type `y` after reviewing agent output. No artifacts are written until then.
4. **Atomic writes only.** The temp-file + rename pattern (`writeFileAtomic` in `src/io.ts`) is the only permitted artifact write operation. The target is never in a partial state.
5. **CLI does not author content.** The CLI submits the canonical prompt and records completion. It does not write handoff notes, generate decisions, or modify artifact content itself.
6. **No implicit config discovery.** The CLI reads `./raes.config.yaml` from the current working directory by default. It never searches upward or discovers configs automatically.
7. **Artifact rules cannot be bypassed.** Boundary violations halt execution before the provider is called. No subcommand or flag overrides this.
8. **No remote calls or non-RAES file writes.** All reads and writes are local to the configured project root.

### 2.3 Operating Environment

- **Runtime:** Node.js 24+ with `--experimental-strip-types`
- **Language:** TypeScript (ES2024 target, NodeNext module resolution, strict mode)
- **Entry point:** `src/cli.ts` (shebang: `#!/usr/bin/env -S node --experimental-strip-types`)
- **Dependencies:** None. Only Node.js built-in modules.
- **Test runner:** Node.js built-in test runner (`node --test`)
- **Type checking:** `tsc --noEmit`
- **External binaries required:** One of `claude`, `codex`, or `copilot` must be on PATH depending on the configured provider

---

## 3. Functional Requirements

### 3.1 CLI Commands

The tool exposes a single binary (`raes-execute`) with a flat option set. All commands are invoked as flags; there are no subcommands.

#### FR-1: `--help / -h`

Outputs help text listing all supported options with descriptions. Exits with code 0.

#### FR-2: `--version`

Outputs `raes-execute 0.1.0`. Exits with code 0.

#### FR-3: `--check-config / -c`

Validates `raes.config.yaml` and all referenced artifact paths.

**Behavior:**
- Parses `raes.config.yaml` and validates the schema (all six required source keys present; provider name is one of `anthropic`, `openai`, `github_copilot`)
- Resolves each artifact path relative to the config file location and verifies it exists and is readable
- On failure: writes one structured error block per issue to stderr (`error:` / `field:` / `fix:` lines); exits with code 2
- On success: prints a table of verified artifact paths and the configured provider name; exits with code 0

Every `ConfigError` includes a `fix` string — a single actionable statement describing what the operator must do to resolve the error.

#### FR-4: `--status / -s`

Outputs current project status.

**Behavior:**
- Loads and validates config
- Reads the pipeline artifact and parses its slice backlog
- Displays: project name, next slice (position + label), total slices complete, total slices remaining
- Milestone is **not** displayed in v1 (the pipeline format carries no per-slice milestone metadata; inference would violate the no-guessing constraint)
- Exits with code 0 on success; code 2 on config or pipeline read failure

#### FR-5: `--list-slices / -l`

Lists all slices in the pipeline backlog.

**Behavior:**
- Loads and validates config, reads pipeline
- Outputs one line per slice: position, status symbol (`✓` for complete, `○` for unchecked), and label
- `type` and `assignee` columns are **not** displayed in v1 (the `- [ ] Slice N: label` format carries no metadata for these fields; displaying them would require label inference)
- Exits with code 0

#### FR-6: `--show-next-slice / -n`

Displays the next unchecked slice.

**Behavior:**
- Loads and validates config, reads pipeline
- Displays: position, status, label
- `type`, `constraints`, `goal`, `acceptance criteria`, and `related files` are **not** displayed in v1 (pipeline format does not encode them)
- If no unchecked slice exists, outputs a message indicating the pipeline is complete; exits with code 0

#### FR-7: `--print-artifact / -p <name>`

Outputs the full content of a named RAES artifact to stdout.

**Supported names:**

| Alias(es) | Maps to |
|---|---|
| `prd`, `build_intent` | `sources.build_intent` |
| `system`, `system_constraints` | `sources.system_constraints` |
| `decisions`, `durable_decisions` | `sources.durable_decisions` |
| `pipeline`, `next_slice` | `sources.next_slice.path` |
| `execution-guidance`, `execution_guidance` | `sources.execution_guidance` |
| `validation` | `sources.validation` |

**Behavior:**
- Loads config, resolves the named artifact's path, reads and prints the file to stdout with a header showing the artifact name and path
- Exits with code 0 on success; code 2 if name unrecognized or file unreadable

#### FR-8: `--execute-next-slice / -e`

Runs the next unchecked slice. This is the core command.

See Section 3.2 for the full execution flow.

#### FR-9: `--dry-run`

Preflight check for `--execute-next-slice` without calling the provider or writing any artifacts.

**Behavior:**
- Runs all pre-execution validation: config load, artifact existence, boundary check, slice identification, loop-type determination
- Displays: next slice label, inferred loop type, provider name, prompt path, pipeline path, write access setting
- Makes no provider calls and writes no files
- Exits with code 0 if preflight passes; code 2 if any check fails

#### FR-10: `--flag <issue>`

**Status: Stub — not implemented.**  
Exits with "not yet implemented" message and code 2.

#### FR-11: `--history [N]`

**Status: Stub — not implemented.**  
Exits with "not yet implemented" message and code 2.

---

### 3.2 Slice Execution Flow (`--execute-next-slice`)

#### 3.2.1 Pre-Execution Validation

Before calling the provider, the tool runs `runSlicePreflight()`:

1. Load and validate `raes.config.yaml`
2. Read and validate all six artifact files (existence + readability)
3. Validate artifact boundaries: scan each artifact for headings that belong to a different artifact role; any violation halts with a structured error naming the specific forbidden heading and the file it was found in
4. Read the pipeline and identify the first unchecked slice
5. If no unchecked slice exists, exit 0 with a "pipeline complete" message

If any pre-execution check fails, the tool exits with code 2. No provider process is started.

#### 3.2.2 Loop Type Determination

The loop type is inferred from the slice label using a regex: `/\breview\b/i`

- Label contains "review" as a whole word (case-insensitive) → **Review Loop**
- All other labels → **Execution Loop**

This is an acknowledged imprecision: the current pipeline format (`- [ ] Slice N: label`) carries no explicit type metadata. When the pipeline format gains an explicit type field, this inference rule will be retired.

#### 3.2.3 Execution Loop (9 Steps)

Used for slices whose label does not match the review pattern.

```
ANALYZE → PLAN → GENERATE → IMPLEMENT → TEST → EXPLAIN → FLAG → REVIEW → RECORD
```

The CLI submits the canonical prompt from `src/prompts/execution-loop.md` to the configured provider. The prompt instructs the agent to:
- Read `raes.config.yaml` and locate all authoritative artifacts
- Identify the first unchecked slice and apply Execution Loop rules
- Produce failing tests before implementation code
- Self-check implementation against `system-constraints` and `durable-decisions` before appending handoff notes
- Append handoff notes to the pipeline artifact
- Not mark the slice complete (that is reserved for the parent loop after operator confirmation)

**Expected agent output fields:** Current slice | Sources used | Analysis findings | Plan | Generated artifacts (tests/stubs) | Implementation changes | Commands run | Result | Flags | Next recommended slice

#### 3.2.4 Review Loop (7 Steps)

Used for slices whose label matches `/\breview\b/i`.

```
PLAN → SLICE → INSPECT → SYNTHESIZE → FLAG → REVIEW → RECORD
```

The CLI submits the same canonical prompt. The Review Loop section instructs the agent to:
- Inspect authoritative artifacts before writing anything
- Compare current state to build intent
- Identify concrete gaps explicitly
- Append findings to the appropriate artifact
- Not mark the slice complete

**Expected agent output fields:** Current slice | Artifacts inspected | Findings | Gaps (explicit) | Output artifact(s) produced | Flags | Next recommended slice

**Note:** In the current implementation, the Execution Loop and Review Loop use identical CLI mechanics (same prompt, same confirmation gate, same write). The routing distinction is recorded and the canonical prompt carries both loop instructions; the behavioral difference is enforced by the agent following the correct loop branch, not by separate CLI code paths.

#### 3.2.5 Provider Submission and Streaming

1. The tool starts a provider session via `provider.startSession()`
2. Submits the canonical prompt text via `provider.submitTurn(prompt)`
3. Streams normalized progress events to the terminal via `createProgressRenderer` (see Section 3.5)
4. Accumulates the final output text from the provider's turn-completion event

#### 3.2.6 Operator Confirmation Gate

After the provider completes and its output is printed:

1. The tool prompts: `Agent output shown above. Record this slice as complete? [y/N]`
2. **On `y`:** calls `markSliceComplete()` to replace `- [ ] <label>` with `- [x] <label>` in the pipeline text, then writes the updated pipeline via `writeFileAtomic()`; exits with code 0 and prints `Slice complete: <label>`
3. **On `n`, empty input, or any other value:** exits with code 0 and prints `Slice not recorded. No artifacts written.`
4. **On provider error (non-zero exit, auth failure, empty output, protocol failure):** exits with code 2; no artifacts written

The pipeline is the **only** artifact written by the parent loop. The agent (via its write-access grants) may append notes to other artifacts during execution, but those writes are the agent's responsibility, not the CLI's. The CLI writes only the slice completion marker.

---

### 3.3 Config and Artifact System

#### 3.3.1 `raes.config.yaml` Schema

```yaml
project:
  name: string           # required

sources:
  build_intent: string           # path to prd.md (required)
  system_constraints: string     # path to system.md (required)
  next_slice:
    path: string                 # path to pipeline.md (required)
    selection_rule: string       # required (e.g., "first_unchecked_slice")
  durable_decisions: string      # path to decisions.md (required)
  execution_guidance: string     # path to execution-guidance.md (required)
  validation: string             # path to validation.md (required)

provider:
  name: "anthropic" | "openai" | "github_copilot"    # required
  model?: string                 # optional model override
  openai?:
    transport: "exec" | "app_server"                 # optional; defaults to "exec"
  github_copilot?:
    transport: "exec"                                # optional; only valid value
  sandbox?:
    write_access?: boolean       # optional; defaults to true
```

`provider` configuration lives in `raes.config.yaml`. Provider credentials do **not** — they are inherited from the operator's environment (pre-existing CLI sessions or environment variables).

#### 3.3.2 Artifact Boundary Validation

Enforced by `validateBoundaries()` in `src/artifacts.ts`. Each artifact role has a set of permitted heading patterns; headings belonging to another role's set are forbidden.

| Artifact role | Forbidden heading examples |
|---|---|
| `build_intent` (prd.md) | `## Product Invariants`, `## Drift Guards`, `## Durable Decisions`, `## Slice Backlog` |
| `system_constraints` (system.md) | `## Goals`, `## User Stories`, `## Durable Decisions`, `## Slice Backlog`, `## Workflow Rules` |
| `durable_decisions` (decisions.md) | `## Invariants`, `## Goals`, `## Slice Backlog`, `## Workflow Rules` |
| `execution_guidance` | `## Product Invariants`, `## Durable Decisions`, `## Slice Backlog`, `## Goals` |
| `validation` | `## Product Invariants`, `## Workflow Rules`, `## Durable Decisions`, `## Slice Backlog` |
| `next_slice` (pipeline.md) | `## Purpose`, `## Invariants`, `## Drift Guards`, `## Durable Decisions`, `## Workflow Rules` |

Violations halt execution before the provider is called. The error output names the exact heading line and the file where it was found.

Boundary validation is regex-based pattern matching on heading text. It does not detect semantic violations (e.g., a constraint disguised under a permitted heading name).

#### 3.3.3 Slice Parsing

Slices are parsed from the pipeline artifact by scanning for `- [ ]` (unchecked) and `- [x]` (checked) entries within the `## Slice Backlog` section. Each entry yields a `Slice` object with:
- `position` — sequential index (1-based)
- `label` — the text after the checkbox marker
- `checked` — boolean completion state

The pipeline text above and below the slice markers is preserved unchanged when writing completions.

#### 3.3.4 Atomic Pipeline Write

`markSliceComplete(content, slice)` replaces the first occurrence of `- [ ] <label>` with `- [x] <label>` in the full pipeline text. `writeFileAtomic(path, content)` then:
1. Generates a random temp filename: `.raes-tmp-<8-hex-bytes>` in the same directory as the target
2. Writes the full content to the temp file via `writeFileSync`
3. Renames the temp file to the target via `renameSync` (atomic at the OS level)
4. On any failure: removes the temp file and returns an error; the target is never modified

---

### 3.4 Provider Integration

Three providers are fully integrated. All are invoked as subprocesses; the CLI never calls a network API directly and never handles provider credentials.

#### 3.4.1 Provider Interface

All three providers implement a common session interface:

```typescript
interface ProviderSession {
  submitTurn(prompt: string): AsyncIterable<ProviderProgressEvent>;
  close(): Promise<void>;
}

interface ProviderResult {
  output: string;
  error?: string;
  fix?: string;
}
```

`ProviderProgressEvent` is a normalized event type with `kind`, `text`, and optional structured fields (`phase`, `item`, `command`, `delta`, `plan`, `files`).

#### 3.4.2 Anthropic (Claude Code)

- **Subprocess:** `claude -p --output-format stream-json [--allowedTools Edit,Write,Read]`
- **Write access flag:** `--allowedTools Edit,Write,Read` (enabled by default; disabled via `provider.sandbox.write_access: false`)
- **Auth:** Inherits the operator's `claude login` session or `ANTHROPIC_API_KEY` environment variable; the CLI does not inject credentials
- **Output parsing:** Accumulates text deltas from `content_block_delta` events; falls back to concatenating `message.content[].text` from the final message event
- **Failure detection:** Non-zero exit code + stderr pattern match against `/not logged in|unauthorized|authentication|login required|auth failed/i`

#### 3.4.3 OpenAI (Codex)

Two transport modes are supported:

**exec transport (default):**
- **Subprocess:** `codex exec --json -` with prompt delivered via stdin
- **Write access flag:** `--sandbox workspace-write` (enabled by default)
- **Output parsing:** JSONL stream; extracts final text from the `turn/completed` event
- **Failure detection:** Absence of `turn/completed` event, non-zero exit, or empty extracted text

**app-server transport:**
- **Subprocess:** `codex app-server --listen stdio://` (long-lived session)
- **Protocol:** JSON-RPC 2.0 request/response over stdin/stdout; 8+ event types normalized
- **Timeouts:** 5 seconds for request/response handshake; 30 seconds for `turn/completed`
- **Failure modes:** Session-directory permission denied, JSON-RPC timeout, malformed `turn/completed` payload, subprocess termination mid-turn
- **Output parsing:** Accumulates streamed deltas; extracts final text from `turn/completed` payload

**Auth:** Inherits `codex login` session or `OPENAI_API_KEY` environment variable.

#### 3.4.4 GitHub Copilot

- **Subprocess:** `copilot -p <prompt> --output-format=json --allow-all-tools`
- **Write access:** When `provider.sandbox.write_access: false`, appends `--deny-tool=write --deny-tool=shell`
- **Auth:** Requires `copilot auth login` or inherited environment; the CLI does not inject credentials
- **Output parsing:** JSONL events; accumulates assistant message text; falls back to command output as secondary source
- **Note:** GitHub Copilot does not support `app_server` transport. Non-interactive tool approvals are configured automatically by the CLI.

#### 3.4.5 Write Access Semantics

Write access controls whether the provider subprocess can edit files during execution. Default is enabled for all providers.

| Provider | Write-enabled flag | Write-disabled equivalent |
|---|---|---|
| Claude Code | `--allowedTools Edit,Write,Read` | Omit `Edit,Write` from allowed tools |
| Codex | `--sandbox workspace-write` | Omit sandbox flag |
| Copilot | (no flag; all tools allowed) | `--deny-tool=write --deny-tool=shell` |

Write access is required for the agent to append handoff notes and findings to artifacts during the RECORD step. Disabling it silently prevents the RECORD step from succeeding.

---

### 3.5 Progress Rendering

Provider events are normalized and rendered to the terminal via `createProgressRenderer`. Three verbosity levels are supported, controlled by `--verbosity <quiet|progress|debug>` (default: `progress`).

**quiet** — Suppresses all progress output. Used in tests.

**progress** (default):
- Coalesces command delta events into a single entry with exit code
- Applies semantic labels to common commands (e.g., `pwd` or `rg --files` → "Inspecting workspace layout")
- Suppresses low-signal events (`user.message`, `item/started`, `item/agentMessage/delta` with generic text)
- Truncates plan/diff file lists to 2 items + "N more"
- Accumulates reasoning deltas before flushing as a `[reasoning]` line

**debug**:
- Emits all raw events including JSON-RPC notifications
- No coalescing or semantic classification
- Full structured fields preserved

Verbosity level is an observer-only setting; it does not affect loop behavior, provider submission, or slice completion.

---

### 3.6 Monorepo Support

`raes-execute` supports multi-project repositories via a workspace file.

#### 3.6.1 Workspace File Format (`raes.workspace.yaml`)

```yaml
projects:
  <project_name>:
    config: <path/to/raes.config.yaml>

shared_sources?:                      # optional; declared but not loaded at artifact time
  <artifact_name>: <path/to/file>
```

#### 3.6.2 Config Resolution Order

1. `--config <path>` — explicit path override (mutually exclusive with `--project`)
2. `--project <name>` — resolved via workspace map (`--workspace <path>` overrides the workspace file location; defaults to `./raes.workspace.yaml`)
3. `./raes.config.yaml` in the current working directory

`--workspace` without `--project` is a usage error (exit code 1). `--project` and `--config` together is a usage error.

`shared_sources` entries in `raes.workspace.yaml` are validated for existence at workspace-check time. They are not loaded into artifact resolution at execution time (deferred).

---

### 3.7 Error Handling and Exit Codes

#### Exit Code Contract

| Code | Meaning |
|---|---|
| `0` | Success: command completed, slice confirmed complete, slice not recorded (user declined), help/version displayed |
| `1` | Usage error: unknown option, missing required argument, extra positional argument, mutually exclusive flags |
| `2` | Config/runtime error: missing config, invalid schema, missing artifact, boundary violation, empty provider output, provider auth failure, protocol failure, workspace conflict |

#### Error Output Format

All errors are written to stderr:

```
error: <message>
  field: <config.field.path>
  fix: <one-sentence actionable resolution>
```

Every error that causes exit code 2 includes a `fix` string. An error without a `fix` string is a defect.

---

## 4. External Interface Requirements

### 4.1 File System Interface

**EI-1:** `raes.config.yaml` must exist and be readable at the resolved config path before any command proceeds.

**EI-2:** All artifact paths in `raes.config.yaml` are resolved relative to the config file's directory.

**EI-3:** The CLI writes only to the file referenced by `sources.next_slice.path` (the pipeline artifact), and only on explicit operator confirmation. No other project file is written by the CLI itself.

**EI-4:** The agent subprocess may write to other project files during execution if write access is enabled. Those writes are the agent's responsibility and are not validated or reversed by the CLI.

**EI-5:** Atomic writes use a `.raes-tmp-<hex>` temp file in the same directory as the target. If the write fails, the temp file is removed and the target is unchanged.

### 4.2 Provider Subprocess Interface

**EI-6:** The configured provider binary (`claude`, `codex`, or `copilot`) must be on the operator's PATH.

**EI-7:** The CLI spawns the provider as a child process. It communicates via stdin/stdout (JSONL or JSON-RPC) and stderr. It does not call provider APIs directly.

**EI-8:** Provider credentials are not managed by the CLI. The operator must authenticate (`claude login`, `codex login`, `copilot auth login`) before invoking `raes-execute`. Auth failure is detected from the subprocess's exit code and stderr content.

### 4.3 Canonical Prompt

**EI-9:** The canonical prompt is loaded at runtime from `src/prompts/execution-loop.md` via `loadPrompt()` in `src/prompt.ts`. It is not embedded in source code.

**EI-10:** `src/prompts/execution-loop.md` is the tool-optimized derivative of the canonical prompt in `docs/raes-reference.md` Section 7. Intentional divergences are recorded in `docs/decisions.md`. Accidental divergence is drift and must be corrected.

---

## 5. Non-Functional Requirements

### 5.1 Performance

Core commands (`--check-config`, `--status`, `--list-slices`, `--show-next-slice`, `--print-artifact`, `--dry-run`) must execute in under 200ms on commodity hardware. This excludes `--execute-next-slice` (provider-bound) and `--history` (not yet implemented).

### 5.2 No External Dependencies

The tool has no runtime npm dependencies. Only Node.js built-in modules are used.

### 5.3 Testability

The `main(argv, io)` entry point accepts injectable `io.out` and `io.err` sinks. Tests assert on output without spawning processes. Provider sessions are tested via an injectable `SpawnFn` interface and mock `ProviderSession` doubles. No live API or subprocess calls are made during testing.

### 5.4 Failure Transparency

Every error that causes a non-zero exit is accompanied by a message on stderr naming the specific failure, the config field or artifact involved, and what the operator must do to resolve it.

### 5.5 No Auto-Correction

Config and artifact errors are never silently fixed. The operator must resolve errors and re-run. The tool does not mutate config or artifacts to make itself work.

### 5.6 Test Coverage

Eleven test suites cover:

| Test file | Coverage |
|---|---|
| `cli.test.ts` | Argument parsing, command routing, config loading, error codes |
| `config.test.ts` | YAML parsing, schema validation, path resolution, workspace support |
| `provider.test.ts` | All 3 providers, event normalization, error cases, app-server JSON-RPC |
| `pipeline.test.ts` | Slice parsing, loop-type detection, status calculations |
| `execution-loop.test.ts` | Full execution flow, mock provider, confirmation gate, artifact write |
| `review-loop.test.ts` | Full review flow (mirrors execution-loop pattern) |
| `prompt.test.ts` | Canonical prompt loading, file existence |
| `artifacts.test.ts` | Artifact loading, boundary validation, forbidden header detection |
| `progress-renderer.test.ts` | Event normalization, rendering output, coalescing |
| `io.test.ts` | Atomic file write, temp cleanup on failure |
| `project-docs.test.ts` | Validates the project's own `pipeline.md` structure |

---

## 6. Constraints and Deferred Work

### 6.1 Out of Scope (V1)

- Multi-slice or batch execution
- Merging, overwriting, or reinterpreting artifact files outside RAES rules
- Code generation, content authoring, or agent behavior
- Remote API calls
- Writing to non-RAES files

### 6.2 Known Deferred Work

The following items are tracked in `docs/pipeline.md` or `docs/decisions.md` as deferred:

| Item | Status | Notes |
|---|---|---|
| `--flag <issue>` | Stub | Exits with "not yet implemented". No flag storage mechanism exists. |
| `--history [N]` | Stub | Exits with "not yet implemented". No history log or state file exists. |
| Color-coded output and icons | Deferred | Plain text only. PRD requires color/icons; deferred to a future slice. |
| Machine-readable export (JSON/YAML) | Deferred | All outputs are plain text. |
| Milestone display in `--status` | Deferred | Pipeline format has no per-slice milestone metadata. Display deferred until explicit grouping is added. |
| `type`, `assignee`, `constraints`, `goal`, `acceptance criteria`, `related files` in slice views | Deferred | Pipeline format (`- [ ] Slice N: label`) carries none of these fields. |
| Constraint promotion enforcement | Deferred | PRD requires warning when a constraint is added to `decisions.md` but not promoted to `system.md`. No enforcement or warning system exists yet. |
| `shared_sources` loading at artifact time | Deferred | Declared and validated for existence in workspace config; not loaded into artifact resolution during execution. |
| History storage format | Deferred | No `.raes/history.log` or equivalent state file. The format (YAML/JSON, pipeline append, or separate file) is undecided. |
| Explicit slice type metadata in pipeline format | Deferred | Loop type is currently inferred from the label via `/\breview\b/i`. When explicit type encoding is added, `determineLoopType` in `src/pipeline.ts` must be updated. |
| Milestone grouping in config or pipeline | Deferred | Config supports milestone metadata; pipeline parser ignores it; `--status` does not display it. |
| Codex app-server as primary OpenAI path | Deferred | Decisions record preference for app-server; exec remains the default transport. |

---

## 7. Source File Reference

| File | Lines | Role |
|---|---|---|
| `src/cli.ts` | ~451 | Entry point. Parses arguments, routes commands, loads config, wires I/O. Exports `main(argv, io)` for testing. |
| `src/config.ts` | ~583 | YAML parser, schema validator, path resolver, workspace support. Exports `checkConfig`, `checkWorkspace`, `resolveConfig`. |
| `src/provider.ts` | ~2151 | Three provider implementations (Claude Code, Codex exec, Codex app-server, GitHub Copilot) plus event normalization. Exports `createProvider`. |
| `src/pipeline.ts` | ~79 | Slice parser, status calculator, loop-type detector. Exports `parsePipeline`, `determineLoopType`, `markSliceComplete`. |
| `src/execution-loop.ts` | ~150 | Execution slice flow: preflight → provider submit → confirmation gate → atomic write. |
| `src/review-loop.ts` | ~132 | Review slice flow: mirrors execution-loop mechanics. |
| `src/artifacts.ts` | ~157 | Artifact loader and boundary validator. Exports `loadArtifacts`, `validateBoundaries`. |
| `src/prompt.ts` | ~25 | Canonical prompt loader. Exports `loadPrompt`. |
| `src/slice-preflight.ts` | ~56 | Pre-execution validation: artifact load + boundary check. Exports `runSlicePreflight`. |
| `src/io.ts` | ~24 | Atomic file write. Exports `writeFileAtomic`. |
| `src/progress-renderer.ts` | ~382 | Event normalization and terminal rendering at three verbosity levels. Exports `createProgressRenderer`. |
| `src/prompts/execution-loop.md` | ~93 | Canonical prompt text. Loaded at runtime by `loadPrompt()`. |

---

## 8. Gap Analysis: PRD vs. Actual Implementation

### 8.1 PRD Requirements That Are Met

| PRD Requirement | Status |
|---|---|
| `--execute-next-slice (-e)`: runs the next unchecked slice | Implemented |
| `--list-slices (-l)`: lists all pipeline slices with position and status | Implemented (partial — type and assignee columns absent; see 8.3) |
| `--show-next-slice (-n)`: prints next unchecked slice details | Implemented (partial — only position, status, label; see 8.3) |
| `--print-artifact (-p)`: prints named artifact to stdout | Implemented |
| `--check-config (-c)`: validates config and all artifact paths | Implemented |
| `--status (-s)`: project status summary | Implemented (partial — milestone not displayed; see 8.3) |
| `--help (-h)`: usage and option listing | Implemented |
| Halt on artifact boundary violation | Implemented |
| Halt on missing artifact or config error | Implemented |
| Actionable error messages with fix guidance | Implemented |
| Slice execution routes to Execution Loop or Review Loop by slice type | Implemented (type inferred from label; see 8.3) |
| Operator confirmation before marking slice complete | Implemented |
| Atomic artifact writes | Implemented |
| One slice per invocation | Implemented; enforced |
| Config validation as mandatory pre-flight | Implemented |
| Core commands in under 200ms | Design target; enforced by no-dependency, no-network-call architecture |
| Machine-readable flag/history output design | Decisions recorded; implementation deferred |
| `raes.config.yaml` as required entry point | Implemented |
| Core RAES execution flow cannot be bypassed | Implemented |
| Local-only reads and writes | Implemented |
| No overwrite/reinterpret of artifacts outside RAES rules | Implemented |
| Exit codes defined and stable | Implemented (0/1/2 contract recorded in `decisions.md`) |

### 8.2 Implemented Beyond PRD Scope

The following capabilities exist in the implementation but are not mentioned in the PRD:

| Capability | Notes |
|---|---|
| `--dry-run` flag | Preflight without provider submission or writes. Not in PRD. |
| `--verbosity <quiet|progress|debug>` | Three-level output control. Not in PRD. |
| `--config <path>` | Explicit config file override. PRD implies CWD-default only. |
| `--project <name>` and `--workspace <path>` | Monorepo project selection via workspace map. Not in PRD. |
| GitHub Copilot provider | PRD implies Anthropic and OpenAI; Copilot is a third provider. |
| Codex app-server transport | Two transport modes for OpenAI/Codex. Not in PRD. |
| Progress event normalization and semantic rendering | Rich operator-facing streaming output. Not described in PRD beyond "color-coded outputs". |
| `SpawnFn` and `ProviderSession` injectable interfaces | Test infrastructure that makes providers fully mockable without subprocesses. |
| `shared_sources` in `raes.workspace.yaml` | Named shared artifact paths for cross-project use. Not in PRD. |
| Semantic command labeling in progress output | E.g., `pwd`/`rg --files` → "Inspecting workspace layout". Not in PRD. |

### 8.3 PRD Requirements Not Yet Met

| PRD Requirement | Gap |
|---|---|
| `--history`: list recent N executed slices | **Stub.** Exits with "not yet implemented". No history log or state file exists. |
| `--flag <issue>`: register ambiguity or blocking issue | **Stub.** Exits with "not yet implemented". No flag storage or enforcement mechanism exists. |
| `--list-slices`: includes type, assignee, label | **Partial.** Type and assignee are absent. Pipeline format does not encode them; displaying them would require label inference, which violates the no-guessing constraint. |
| `--show-next-slice`: includes type, constraints, goal, acceptance criteria, related files | **Partial.** Only position, status, and label are shown. Same root cause as above. |
| `--status`: includes active flags and ambiguity | **Partial.** Flag state is not tracked anywhere, so it cannot be displayed. |
| `--status`: includes current milestone | **Deferred.** Pipeline format carries no milestone metadata. |
| Color-coded output with icons/symbols for errors, warnings, completions | **Not implemented.** All output is plain text. |
| Optional JSON/YAML export modes for status/list/history | **Not implemented.** All outputs are plain text. |
| Warn when constraint promoted in `decisions.md` but not reflected in `system.md` | **Not implemented.** No cross-artifact promotion tracking exists. |
| Slice `type` as explicit metadata (Execution Slice vs. Review Slice) | **Not implemented.** Type is inferred from the slice label via `/\breview\b/i`. |

---

## 9. Open Questions

The following questions are not answered by the current implementation:

1. **History storage format.** The PRD requires machine-readable history output. Should history be appended to `pipeline.md`, stored in a separate `.raes/history.log`, or structured as a YAML/JSON file? The format must be decided before `--history` can be implemented.

2. **Flag storage.** Where do flags live? In `pipeline.md` (as a special marker), in a separate `flags.md`, or in a sidecar file? The storage model determines how `--flag` marks a slice blocked and how `--status` reports active flags.

3. **Constraint promotion enforcement.** The PRD requires the tool to warn when a constraint is added to `decisions.md` but not promoted to `system.md`. What triggers this check — content analysis of `decisions.md`, or an explicit operator action? How is "promoted" defined mechanically?

4. **Pipeline format evolution.** Several deferred features (`type`, `assignee`, `milestone`, `acceptance criteria`, `related files`) require structured metadata per slice. Should the pipeline format evolve to YAML frontmatter per slice, structured inline comments, or a separate manifest? This decision gates several deferred items simultaneously.

5. **Agent write validation.** The agent subprocess can write to project artifacts during execution (when write access is enabled). The CLI does not validate those writes. Should the CLI re-run boundary validation after the provider completes and before the confirmation gate?

6. **Codex app-server as primary transport.** `decisions.md` records a preference for Codex app-server over exec for richer progress observability. When does the transition happen, and what is the migration path for operators currently using exec transport?

7. **`shared_sources` enforcement.** Workspace `shared_sources` are validated for existence but not loaded into artifact resolution. When a shared artifact is used in a slice, how should it be injected into the prompt or passed to the agent?
