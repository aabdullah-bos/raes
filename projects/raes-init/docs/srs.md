# Software Requirements Specification: raes-init

**Version:** 1.0  
**Date:** 2026-06-23  
**Status:** Describes the actual implemented state of `raes-init` as of the current codebase  
**Authoritative sources inspected:** `src/cli.ts`, `src/generate-docs.ts`, `src/provider.ts`, `tests/generate-docs.test.ts`, `tests/provider.test.ts`, `tests/docs-artifacts.test.ts`, `docs/prd.md`, `docs/pipeline.md`, `docs/decisions.md`, `docs/system.md`, `docs/execution-guidance.md`, `docs/validation.md`, `docs/raes-reference.md`, `README.md`, `archetypes/*/README.md`, `package.json`, `tsconfig.json`

---

## 1. Introduction

### 1.1 Purpose

This document describes the actual functional state of `raes-init` — a CLI tool that initializes new software projects using the RAES (Reusable AI Execution System) methodology. It is written as a Software Requirements Specification against the implemented codebase, not the PRD, and is intended to:

- provide an accurate baseline for future development work
- identify gaps between the PRD and the current implementation
- serve as a reference for onboarding contributors, auditing the tool, and planning the next milestone

### 1.2 Scope

`raes-init` is a TypeScript CLI that takes an archetype and an optional source PRD and generates a set of structured project documents that enable a project team to immediately begin executing work using the RAES methodology.

It does **not** generate code, scaffold build systems, configure CI, or interact with any source control system. Its output is entirely documentation: markdown files and a YAML configuration file.

### 1.3 Definitions

| Term | Definition |
|---|---|
| **Archetype** | A named project shape (e.g., `cli`, `cli-doc-generator`) that determines the content of generated documents |
| **Bare greenfield** | Initialization mode where no source PRD is supplied; `prd.md` is generated as an empty stub |
| **PRD-seeded** | Initialization mode where a source PRD file is supplied; its content drives document generation |
| **Provider** | An LLM backend (Anthropic, OpenAI, or local OpenAI-compatible) called during AI-backed generation |
| **Shape validation** | Post-generation check that a document contains all required headings and no forbidden ones |
| **Create-or-fail** | Write contract: if any output file already exists, the tool fails before creating any output |
| **Eight-file output set** | The fixed set of files produced by every successful init: `prd.md`, `system.md`, `pipeline.md`, `decisions.md`, `prd-ux-review.md`, `execution-guidance.md`, `validation.md`, `raes.config.yaml` |

### 1.4 Relationship to the PRD

The PRD at `docs/prd.md` is the stated intent. This SRS describes what is actually implemented. Where they differ, Section 8 (Gap Analysis) records the difference explicitly.

---

## 2. System Overview

### 2.1 Product Perspective

`raes-init` is one of three tools in the RAES toolchain:

| Tool | Status | Purpose |
|---|---|---|
| `raes-init` | Implemented | Initialize a new project with RAES docs |
| `raes-discover` | Not yet implemented | Map an existing (brownfield) repo to a `raes.config.yaml` |
| `raes-execute` | Implemented (separately) | Run slices against an initialized project |

`raes-init` produces the artifacts that `raes-execute` consumes. The output layout it generates (`raes.config.yaml` at the project root, living docs under `docs/`) is the canonical RAES project layout per `docs/raes-reference.md` Section 5.

### 2.2 Governing Design Constraints

The following constraints are enforced by the implementation and are treated as first-class invariants:

1. **Create-or-fail:** No file is written if any output file already exists.
2. **Fail before I/O:** All validation — including provider credential checks, archetype checks, and AI-output shape validation — happens before the `docs/` directory is created. If any pre-write check fails, the filesystem is left untouched.
3. **Determinism:** String-parsing generation paths are deterministic. AI-backed paths are deterministic given the same model and prompt.
4. **No fabrication:** Generated content must reflect the source PRD. The tool does not invent requirements or constraints that are absent from the PRD.
5. **No provider config in `raes.config.yaml`:** Provider and model selection are controlled via environment variables only. `raes.config.yaml` is a source routing map, not an infrastructure config file.
6. **Docs-only output:** The tool generates documentation exclusively. It does not scaffold code, install dependencies, or modify any file outside the target `docs/` directory and root `raes.config.yaml`.

### 2.3 Operating Environment

- **Runtime:** Node.js 24+ with experimental TypeScript strip-types enabled
- **Language:** TypeScript (ES2024 target, NodeNext module resolution)
- **Dependencies:** None. Only Node.js built-in modules are used (`node:fs`, `node:path`, `node:test`, `node:assert`)
- **Test runner:** Node.js built-in test runner (`node --test`)
- **Type checking:** `tsc --noEmit` (TypeScript strict mode)
- **Platform:** Any platform supported by Node.js 24

---

## 3. Functional Requirements

### 3.1 Initialization Modes

The tool supports exactly two initialization modes. The mode is determined by the presence or absence of `--from-prd`.

#### FR-1: Bare Greenfield Mode

**Invocation:**
```
raes-init <target-project-path> <archetype>
```

**Behavior:**
- Does not require a source PRD file
- Generates `prd.md` as a structured stub with the following section headers and no content: `## Overview`, `## Goals`, `## Non-Goals`, `## Constraints`, `## Open Questions`
- All other documents are generated from archetype-specific string-parsing templates
- Does not call the provider even if `RAES_PROVIDER` is set

#### FR-2: PRD-Seeded Mode

**Invocation:**
```
raes-init --from-prd <prd-path> <target-project-path> <archetype>
```

**Behavior:**
- Requires a readable source PRD markdown file at `<prd-path>`
- Copies the source PRD verbatim as `docs/prd.md`
- Parses the PRD for three sections: `## Core Functionality`, `## Constraints`, `## Open Questions`; falls back to generic defaults when sections are absent or empty
- Extracts the project title from the first `# ` heading; falls back to the target directory name
- When a provider is configured (via `RAES_PROVIDER`), uses AI-backed generation for `system.md`, `pipeline.md`, `decisions.md`, `prd-ux-review.md`, `execution-guidance.md`, and `validation.md`
- When no provider is configured, uses archetype-specific string-parsing fallbacks for all documents

**Special case — re-init against existing PRD:**
- If `<prd-path>` points to the same file as `<target>/docs/prd.md`, the tool skips the `prd.md` write and treats it as already in place
- All other output files must still be absent; the create-or-fail contract applies to them unchanged

---

### 3.2 Archetype Support

Archetypes determine the content of all non-verbatim generated documents. The tool accepts exactly one archetype per invocation.

**FR-3:** Three archetypes are supported:

| Archetype | Description | Pipeline shape |
|---|---|---|
| `cli-doc-generator` | CLIs that parse a PRD and generate documentation | 2-milestone, 5-slice backlog |
| `frontend-backend-ai-app` | Web applications with a frontend, backend, and AI integration | 3-milestone backlog |
| `cli` | General-purpose operational CLIs that read config, manage state, and call external systems | 5-milestone, 14-slice backlog |

**FR-4:** Any archetype value not in this list causes the tool to fail before any file I/O with an explicit error message naming the unsupported value and listing the supported ones.

Archetype templates in `archetypes/` are human-readable reference documents only. They are not loaded by the generation logic.

---

### 3.3 Document Generation Engine

#### 3.3.1 Eight-File Output Set

**FR-5:** Every successful initialization produces exactly eight output files regardless of mode:

| File | Location | Purpose |
|---|---|---|
| `prd.md` | `<target>/docs/prd.md` | Product intent. Verbatim source PRD (PRD-seeded) or structured stub (bare greenfield) |
| `system.md` | `<target>/docs/system.md` | Execution constraints and invariants for the project |
| `pipeline.md` | `<target>/docs/pipeline.md` | Execution backlog with sequenced slices |
| `decisions.md` | `<target>/docs/decisions.md` | Durable decision log with rationale table |
| `prd-ux-review.md` | `<target>/docs/prd-ux-review.md` | UX risks and open questions (bootstrap artifact only; not referenced by `raes.config.yaml`) |
| `execution-guidance.md` | `<target>/docs/execution-guidance.md` | Workflow rules, anti-patterns, definition of done |
| `validation.md` | `<target>/docs/validation.md` | Testing approach and validation commands |
| `raes.config.yaml` | `<target>/raes.config.yaml` | Source routing map for `raes-execute` |

Note: `raes.config.yaml` is written to the **project root** (`<target>/raes.config.yaml`), not to `<target>/docs/`. All seven markdown documents are written to `<target>/docs/`.

Note: `prd-ux-review.md` is intentionally absent from `raes.config.yaml`. It is a bootstrap artifact — produced once at init time, reviewed by the operator, and not consumed by the execution loop.

#### 3.3.2 String-Parsing Generation (No Provider)

Used in bare greenfield mode (always) and in PRD-seeded mode when no provider is configured.

**FR-6:** String-parsing generation extracts three section types from the PRD:

| Section | Extraction target |
|---|---|
| `## Core Functionality` | Bullet items used to populate `system.md` known contracts and `pipeline.md` unknowns |
| `## Constraints` | Bullet items used to populate `system.md` product invariants |
| `## Open Questions` | Bullet items used to populate `system.md` unknowns and `prd-ux-review.md` open questions |

When a PRD section is absent or empty, archetype-specific fallback content is used.

**FR-7:** UX risk derivation for `prd-ux-review.md` uses heuristic detection of CLI-specific failure moments from PRD content — path errors, validation blocks, conflict detection, archetype expectations — and falls back to generic review bullets when none are detected.

#### 3.3.3 AI-Backed Generation (With Provider)

Used only in PRD-seeded mode when `RAES_PROVIDER` is set and the required credentials are present.

**FR-8:** When AI-backed generation is active, the following documents are generated via `provider.complete(prompt)`:

| Document | Required headings enforced |
|---|---|
| `system.md` | `## Purpose`, `## Product Invariants`, `## Drift Guards`, `## Known Contracts`, `## Unknowns`, `## Anti-Patterns`, `## Definition of Done` |
| `pipeline.md` | `## Slice Backlog`, `## Handoff Notes` |
| `decisions.md` | `## Durable Decisions` |
| `prd-ux-review.md` | `## UX Gaps`, `## Open Questions`, `## Findings` |
| `execution-guidance.md` | `## Workflow Rules`, `## Anti-Patterns`, `## Definition of Done`, `## Milestone Guidance` |
| `validation.md` | `## Testing Approach`, `## Validation Commands`, `## Known Constraints` |

**FR-9:** `prd.md` is always a verbatim copy of the source PRD file in PRD-seeded mode. It is never AI-generated.

**FR-10:** Bare greenfield mode never calls the provider, even if `RAES_PROVIDER` is set and valid.

#### 3.3.4 Shape Validation

**FR-11:** Every AI-generated document is validated against its required heading list before any output is written to disk.

**FR-12:** If a generated document is missing any required heading, or contains any heading that is forbidden for that document type (per `docs/raes-reference.md` Section 3a), the tool throws a `GenerationError` and terminates. The `docs/` directory is not created and no files are written.

**FR-13:** Shape validation is not applied to string-parsing–generated documents; their structure is controlled directly by the render functions.

---

### 3.4 Write Contract

**FR-14:** Before creating any output, the tool checks whether each of the eight output files already exists at the target path.

**FR-15:** If any output file already exists, the tool fails immediately with an explicit error message naming the conflicting file(s). No directories are created and no files are written.

**FR-16:** The `<target>/docs/` directory is created only immediately before the first file write, after all validation passes (input validation, archetype validation, AI-output shape validation). If the directory already exists but contains none of the eight output files, init proceeds normally.

**FR-17:** All seven markdown documents are written to `<target>/docs/`. `raes.config.yaml` is written to `<target>/raes.config.yaml`. No other files are written.

---

### 3.5 Workspace Registration

**FR-18:** The optional `--workspace <workspace-root-path>` flag, when provided, registers the initialized project in a `raes.workspace.yaml` file at `<workspace-root-path>/raes.workspace.yaml`.

**FR-19:** The workspace file format maps project names to the absolute path of their `raes.config.yaml`.

**FR-20:** If `raes.workspace.yaml` does not exist at the workspace root, it is created. If it already exists, the new project entry is appended.

**FR-21:** If a project with the same name is already registered in `raes.workspace.yaml`, the tool throws a `WorkspaceRegistrationError` and terminates without modifying the workspace file.

**FR-22:** Workspace registration happens after all docs and config are written. A workspace registration failure does not roll back the already-written output files.

---

### 3.6 Progress Reporting

**FR-23:** The tool emits progress messages to stdout as generation proceeds. These messages are produced via a `log` callback in the generation API and wired to `process.stdout.write` in the CLI.

**FR-24:** In PRD-seeded mode with a provider, the tool emits a `Generating <filename>...` message before each AI call and a `<filename> done` message after each call completes.

**FR-25:** In all modes, the tool emits a `Writing docs to <path>...` message before the write loop begins, followed by `  <filename>` for each file written.

**FR-26:** No progress messages are emitted before validation is complete. Operator sees output only when meaningful work is about to happen.

---

## 4. CLI Interface

### 4.1 Command Syntax

```
raes-init [--from-prd <prd-path>] <target-project-path> <archetype> [--workspace <workspace-root-path>]
raes-init --help
```

### 4.2 Arguments and Flags

| Argument / Flag | Required | Type | Description |
|---|---|---|---|
| `<target-project-path>` | Yes | Directory path | The project directory to initialize. `docs/` is created inside it. |
| `<archetype>` | Yes | String | One of: `cli-doc-generator`, `frontend-backend-ai-app`, `cli` |
| `--from-prd <prd-path>` | No | File path | Path to a readable PRD markdown file. Activates PRD-seeded mode. |
| `--workspace <root-path>` | No | Directory path | If provided, registers the project in `raes.workspace.yaml` at this root. |
| `--help` | No | Flag | Prints usage information and exits with code 0. |

### 4.3 Argument Ordering

In the current implementation, `--from-prd` must appear before the positional arguments. The workspace flag may appear after the positional arguments.

### 4.4 Exit Codes

| Code | Meaning |
|---|---|
| `0` | Successful initialization |
| `1` | Any error: invalid arguments, unreadable PRD, unsupported archetype, pre-existing output files, provider misconfiguration, missing credentials, AI shape validation failure, workspace registration conflict |

### 4.5 Error Output

All error messages are written to `stderr`. Error messages are actionable: they name the specific input that failed, why it failed, and what the operator should supply or correct. The tool never exits with code 1 without printing a descriptive error.

---

## 5. External Interface Requirements

### 5.1 File System Interface

**EI-1:** `<prd-path>` must be a readable file path. Directories and unreadable files are rejected before any other processing.

**EI-2:** `<target-project-path>` may or may not already exist. The tool creates `<target>/docs/` as needed.

**EI-3:** Generated files are UTF-8 encoded markdown. `raes.config.yaml` is UTF-8 encoded YAML.

**EI-4:** The tool does not write any file outside the `<target>/docs/` directory and `<target>/raes.config.yaml`, with the exception of `raes.workspace.yaml` when `--workspace` is provided.

### 5.2 Generated `raes.config.yaml` Schema

The generated config file follows this structure:

```yaml
project:
  name: <derived from target directory name>

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

All paths are relative to the project root. The config does not contain provider, model, or credential information.

### 5.3 LLM Provider Interface

The provider interface is a single-method contract:

```typescript
type Provider = {
  complete(prompt: string): Promise<string>;
}
```

All three providers implement this interface via direct HTTP calls using Node's built-in `fetch`. No external HTTP library is required.

### 5.4 Environment Variable Interface

Provider selection and credentials are controlled entirely by environment variables. These variables are read at startup and never written or modified.

| Variable | Required for | Description |
|---|---|---|
| `RAES_PROVIDER` | PRD-seeded mode with AI generation | Selects the provider: `anthropic`, `openai`, or `local` |
| `ANTHROPIC_API_KEY` | `RAES_PROVIDER=anthropic` | Anthropic API key |
| `OPENAI_API_KEY` | `RAES_PROVIDER=openai` | OpenAI API key |
| `RAES_LOCAL_ENDPOINT` | `RAES_PROVIDER=local` | Base URL for an OpenAI-compatible local endpoint (e.g., `http://localhost:11434/v1`) |
| `RAES_MODEL` | Optional; any provider | Overrides the provider's default model |

**Provider default models:**

| Provider | Default model |
|---|---|
| `anthropic` | `claude-haiku-4-5-20251001` |
| `openai` | `gpt-4o-mini` |
| `local` | `llama3` |

**Fail-fast behavior:** If `--from-prd` is active and `RAES_PROVIDER` is set but the required credential or endpoint variable is missing, the tool fails immediately before any file I/O with a `ProviderError`. If `RAES_PROVIDER` is absent in PRD-seeded mode, generation continues using string-parsing fallbacks (provider is optional; absent is not an error).

---

## 6. Non-Functional Requirements

### 6.1 Determinism

String-parsing generation paths are fully deterministic: the same inputs always produce the same outputs. AI-backed paths are deterministic for a fixed model and prompt but vary by model response.

### 6.2 No Partial Output

The tool either produces the complete eight-file output set or produces nothing. It does not leave partial output on disk. Any failure after validation but during writes is a defect, not an accepted failure mode.

### 6.3 No External Dependencies

The tool has no runtime npm dependencies. It uses only Node.js built-in modules. This guarantees that it works anywhere Node.js 24 is available without a separate install step.

### 6.4 Failure Transparency

Every error that causes exit code 1 is accompanied by a message that names the specific failure, the input that caused it, and what the operator must change to proceed. Generic or opaque error messages are considered defects.

### 6.5 Test Coverage

The tool has 49 tests across three test files using Node.js's built-in test runner. Tests use a mock `Provider` interface for AI-backed generation paths — live API calls are not made during testing. Tests verify:

- Happy-path output for all three archetypes in both modes
- All eight files written correctly with expected headings
- Rejection of invalid inputs before any file I/O
- Create-or-fail contract enforcement
- Provider fail-fast behavior for all three providers
- Shape validation rejection of AI output missing required headings
- Workspace registration including conflict detection
- Progress message emission
- Re-init against an existing `prd.md` in the target

---

## 7. Constraints and Deferred Work

### 7.1 Out of Scope (V1)

The following are explicitly excluded from V1 and will cause the tool to fail or produce no output if attempted:

- Inline PRD text as input (file path is required)
- Automatic archetype detection
- Overwriting or merging with existing output files
- Code scaffolding or build system setup
- Repo initialization (git, npm init, etc.)
- Interactive prompts or guided setup
- More than one archetype per invocation
- `raes.config.yaml` as a provider config store

### 7.2 Known Deferred Work

The following items are tracked in `docs/pipeline.md` as unchecked slices in Milestone 10:

| Item | Status | Notes |
|---|---|---|
| Milestone 10: Verify canonical `raes.config.yaml` location | Unchecked in pipeline | The code already writes `raes.config.yaml` to `<target>/` (project root). The pipeline item may be tracking a documentation and test alignment pass. |
| Legacy `docs/raes.config.yaml` compatibility assessment | Unchecked in pipeline | Review slice to decide whether `raes-init` needs to emit a migration notice for pre-existing repos using the old `docs/` layout |

The following methodology decisions remain open and affect future init behavior:

- **Parking Lot semantics:** Deferred by `decisions.md` (2026-05-12). `raes-init` does not generate `## Parking Lot` sections.
- **UX config key for product archetypes:** A dedicated `ux-constraints.md` config key for archetypes with real end-user UX is deferred to when the first product archetype is designed.
- **`frontend-backend-ai-app` AI-backed generation:** AI-derived prompts for this archetype are not yet specialized. It uses the same prompt structure as `cli-doc-generator` when a provider is active.
- **`raes-discover`:** Not yet implemented. Brownfield projects cannot be initialized via `raes-init` without a source PRD.

---

## 8. Gap Analysis: PRD vs. Actual Implementation

### 8.1 PRD Requirements That Are Met

| PRD Requirement | Status |
|---|---|
| Bare greenfield mode (`raes-init <target> <archetype>`) | Implemented |
| PRD-seeded mode (`raes-init --from-prd <prd> <target> <archetype>`) | Implemented |
| PRD input must be a readable file path; inline text not supported | Implemented |
| Supported archetypes: `cli-doc-generator`, `frontend-backend-ai-app`, `cli` | Implemented (all three) |
| Eight-file output set | Implemented |
| `prd.md` is verbatim copy in PRD-seeded mode | Implemented |
| Create-or-fail write contract | Implemented |
| `RAES_PROVIDER` env var selects provider | Implemented |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `RAES_LOCAL_ENDPOINT` for credentials | Implemented |
| `RAES_MODEL` override applies when set | Implemented |
| Each provider has a documented default model | Implemented |
| `--from-prd` fails fast before file I/O when `RAES_PROVIDER` is invalid | Implemented |
| Each provider fails fast if required credential or endpoint is missing | Implemented |
| `complete(prompt): Promise<string>` is the minimum provider interface | Implemented |
| Bare greenfield output is unaffected by provider interface | Implemented |
| `raes.config.yaml` routes the execution loop to all source files | Implemented |
| PRD adaptation uses section-aware string parsing | Implemented |
| Archetype templates are reference docs only, not consumed by generation logic | Confirmed in code |
| Fail fast with clear message before any file I/O | Implemented |
| Generated docs must be human-readable, editable markdown | Implemented |
| Tool must not fabricate content not present in the PRD | Implemented (enforced by prompt design and shape guard) |

### 8.2 Implemented Beyond PRD Scope

The following capabilities exist in the implementation but are not mentioned in the PRD:

| Capability | Notes |
|---|---|
| `--workspace <root-path>` flag | Registers the initialized project in a `raes.workspace.yaml` at the specified root. Supports multi-project monorepo layouts. Not in PRD. |
| `--help` flag | Prints usage and exits cleanly. Not described in PRD. |
| Progress logging | `Generating <file>...` / `<file> done` / `Writing docs to <path>...` messages during generation. Not in PRD. |
| Shape validation of AI output | AI-generated documents are validated for required headings before any write. Shape failures leave the filesystem untouched. Not explicitly in PRD (implied by fail-fast principle). |
| Re-init against existing `prd.md` | If `--from-prd` points to the target's existing `prd.md`, the tool skips the prd.md write and generates all other files. Not in PRD. |
| `WorkspaceRegistrationError` type | Distinct error type for workspace duplicate-name conflicts. |
| `GenerationError` type | Distinct error type for shape validation failures. |
| Forbidden heading validation | Shape guard also rejects documents that contain headings that belong in other artifacts (per `raes-reference.md` Section 3a). Not explicitly in PRD. |

### 8.3 PRD Requirements Not Yet Met

| PRD Requirement | Gap |
|---|---|
| AI-backed generation for `system.md` and `prd-ux-review.md` | **Partial.** The PRD implies AI generation for `system.md` (listed as "derived from PRD sections" with provider). The code falls back to string-parsing for `system.md` and `prd-ux-review.md` even when a provider is active. Only `pipeline.md`, `decisions.md`, `execution-guidance.md`, and `validation.md` use AI-backed generation today. |
| AI-backed specialization per archetype | **Not implemented for all archetypes.** The `frontend-backend-ai-app` archetype uses the same AI prompts as `cli-doc-generator`. Archetype-specific AI prompt variants are not yet written. |

---

## 9. Source File Reference

| File | Role |
|---|---|
| `src/cli.ts` | CLI entry point. Parses arguments, validates flags, loads provider, calls `generateDocs()`. Entry point for `raes-init` binary. |
| `src/generate-docs.ts` | Core generation engine. Exports `generateDocs()`, `validateGeneratedDocShape()`, `registerProjectInWorkspace()`, all render functions, all prompt builder functions, `SUPPORTED_ARCHETYPES`, `REQUIRED_DOC_NAMES`, and related constants. |
| `src/provider.ts` | LLM provider interface. Exports `Provider` type, `ProviderError`, and `loadProvider()`. Implements Anthropic, OpenAI, and local providers via raw `fetch`. |
| `tests/generate-docs.test.ts` | 39 tests covering generation happy paths, error cases, shape validation, AI-backed generation (via mock provider), workspace registration, and progress messages. |
| `tests/provider.test.ts` | 8 tests covering provider loading, credential validation, and mock API calls. |
| `tests/docs-artifacts.test.ts` | 2 tests asserting that the project's own `execution-guidance.md` and `validation.md` contain required headings. |

---

## 10. Open Questions

The following questions are not answered by the current implementation and should be addressed in future planning:

1. Should `system.md` and `prd-ux-review.md` be upgraded to AI-backed generation? The PRD implies they should be; the current implementation uses string-parsing for both.
2. Should the `frontend-backend-ai-app` archetype have distinct AI prompts from `cli-doc-generator`?
3. What is the migration story for projects initialized before the canonical `raes.config.yaml` root layout? (Tracked as Milestone 10 review slice.)
4. Should a future version support updating an existing project (overwrite-mode or merge-mode init)?
5. Should `raes-init` validate the source PRD against a schema before accepting it, or continue accepting any readable file?
