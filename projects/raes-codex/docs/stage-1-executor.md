# Stage 1 Codex-Native RAES Execute

## Purpose

This document defines the smallest practical Stage 1 implementation of a Codex-native replacement for the core `raes-execute` workflow.

The immediate goal is to produce a working interactive executor inside Codex that can:

1. locate and validate a single RAES project;
2. select exactly one supported slice;
3. route it as either an execution or review slice;
4. perform the slice interactively through Codex;
5. run and report validation;
6. present the result for human review;
7. record acceptance only after explicit user approval.

Stage 1 intentionally does not attempt full behavioral parity with the existing `raes-execute` CLI.

## Scope

### Included

Stage 1 includes:

- one RAES project per Codex session;
- `raes.config.yaml` at the project root;
- deterministic project and artifact preflight;
- deterministic parsing of the supported pipeline grammar;
- deterministic selection of the first unchecked slice;
- explicit `execution` and `review` slice types;
- interactive Codex execution of one slice;
- project- and slice-defined validation;
- repository diff inspection;
- explicit result reporting;
- session-bound validation evidence;
- explicit human acceptance;
- atomic update of one pipeline checkbox.

### Excluded

Stage 1 does not include:

- Codex-native `raes-init`;
- provider abstraction or provider subprocesses;
- Claude, Copilot, or external model adapters;
- `codex exec` or unattended execution;
- workspace or multi-project support;
- implicit project discovery;
- history commands;
- durable flag storage;
- durable persistence of intermediate slice states;
- acceptance across separate Codex sessions;
- permanent validation or acceptance records;
- migration of legacy pipelines;
- milestone support inside the slice backlog;
- nested independently tracked slices;
- automatic rollback of Codex changes;
- complete deterministic proof of semantic scope compliance.

## Stage 1 Decisions

### Pipeline grammar

The executor accepts a flat Markdown backlog under:

```markdown
## Slice Backlog
```

Each top-level slice must use the following declaration:

```markdown
- [ ] <stable-id> | <execution|review> | <label>
```

Example:

```markdown
## Slice Backlog

- [ ] S-0012 | execution | Implement rollback functionality

  Rollback must restore repository state without removing diagnostic evidence.

  Steps:

  1. Confirm all subagents have completed or stopped.
  2. Inspect the repository and identify modified files.
  3. Restore only files modified by the failed operation.
  4. Preserve diagnostic logs.

  Acceptance criteria:

  - Partial application changes are removed.
  - User-authored changes are preserved.
  - Diagnostic logs remain available.

  Validation:

  - `npm test`
  - `npm run typecheck`

- [ ] S-0013 | review | Review rollback failure handling

  Required output:

  - Record findings in `docs/rollback-review.md`.
```

Rules:

- Only zero-indented declarations matching the slice grammar create selectable slices.
- Each slice ID must be unique.
- The type must be exactly `execution` or `review`.
- The label must be non-empty.
- The complete indented Markdown body belongs to the preceding slice.
- The top-level slice is the only state-bearing and selectable unit.
- Indented bullets or checkboxes are context, steps, or criteria; they are not slices.
- `[ ]` means not accepted.
- `[x]` means accepted.
- The first unchecked top-level slice is selected.
- Slice order is file order.
- Duplicate IDs, malformed declarations, unsupported types, nested selectable slices, or milestone headings within the backlog fail closed.
- Unsupported legacy pipeline structures must produce a clear compatibility error rather than being silently interpreted.

### Slice routing

The executor routes solely from the explicit type field.

#### Execution slices

An `execution` slice authorizes Codex to:

- inspect relevant source code and project artifacts;
- modify implementation files within the slice scope;
- add or modify tests;
- update explicitly authorized project documentation;
- run validation;
- report the final repository changes.

Execution does not authorize Codex to mark the slice accepted.

#### Review slices

A `review` slice authorizes Codex to:

- inspect code, documentation, tests, and repository state;
- run safe diagnostic or validation commands;
- identify findings, risks, discrepancies, or recommendations;
- create or modify only review outputs explicitly required by the slice.

A review slice must not modify implementation behavior.

A mixed-purpose slice such as “review and fix” is invalid for Stage 1 and must be split into separate review and execution slices.

### Validation

Codex may report a slice as `validated` only after:

- completing the authorized work;
- running every required validation command;
- confirming that required commands succeeded;
- inspecting the final repository diff;
- checking changed, added, deleted, and untracked files;
- confirming that the pipeline checkbox remains unchanged;
- determining that the changes remain within the slice’s authorized scope;
- finding no unresolved blocking failure or material ambiguity.

Passing tests alone is insufficient.

Validation requirements are gathered in this order:

1. commands explicitly stated in the selected slice;
2. mandatory requirements in the configured validation artifact;
3. clearly applicable repository-standard checks.

Codex must identify the source of each validation command in its result report.

Supported result states are:

- `validated`
- `implemented but not validated`
- `blocked`

Warnings must be separated into:

- blocking failures;
- non-blocking warnings;
- pre-existing conditions.

A pre-existing failure does not automatically block validation when Codex can show that the slice did not introduce or worsen it and it does not undermine the slice’s acceptance criteria.

### Acceptance

Acceptance is a separate human-authorized transition.

Codex may request acceptance only after presenting a validated result.

The acceptance request must clearly identify the slice, for example:

```text
Accept slice S-0012 and mark it complete in the pipeline?
```

General approval language must not be treated as authorization to change the pipeline.

For Stage 1, validation evidence may remain session-bound. Acceptance across separate Codex sessions is not supported.

Before recording acceptance, the deterministic acceptance mechanism must verify that:

- the slice ID still exists;
- the slice is still unchecked;
- it remains the first unchecked slice;
- its type, label, and body have not changed;
- no earlier unchecked slice has appeared;
- the pipeline has not changed since validation;
- the repository state still matches the state that was validated;
- the user explicitly accepted that specific slice.

Acceptance atomically changes only:

```markdown
- [ ] S-0012 | execution | Implement rollback functionality
```

to:

```markdown
- [x] S-0012 | execution | Implement rollback functionality
```

The slice body and all other slices remain unchanged.

If the user rejects the result:

- the pipeline remains unchanged;
- implementation changes are not automatically reverted;
- the same slice remains next;
- Codex may revise the work if instructed.

## Supported Project Contract

Stage 1 supports a single project with:

```text
<project-root>/
├── raes.config.yaml
└── docs/
    ├── prd.md
    ├── system.md
    ├── pipeline.md
    ├── decisions.md
    ├── execution-guidance.md
    └── validation.md
```

The config must identify the authoritative paths for:

- build intent;
- system constraints;
- next-slice pipeline;
- durable decisions;
- execution guidance;
- validation guidance.

Stage 1 does not require a provider block because Codex is the native runtime.

The executor must not perform implicit upward, recursive, or repository-wide project discovery. It operates on the project root explicitly opened or supplied to Codex.

## Proposed Directory Structure

```text
projects/raes-codex/
├── docs/
│   ├── architecture.md
│   ├── decisions.md
│   ├── stage-1-executor.md
│   └── contracts/
│       ├── raes-init-contract.md
│       └── raes-execute-contract.md
└── skills/
    └── raes-execute/
        ├── SKILL.md
        ├── scripts/
        │   ├── preflight.py
        │   ├── inspect_result.py
        │   └── accept_slice.py
        └── tests/
            ├── test_preflight.py
            ├── test_inspect_result.py
            ├── test_accept_slice.py
            └── fixtures/
                ├── valid-project/
                ├── malformed-pipeline/
                ├── duplicate-slice-id/
                ├── milestone-pipeline/
                └── stale-acceptance/
```

The exact packaging may change later. Stage 1 should favor small, directly testable scripts over a larger framework.

## Deterministic Scripts

### `preflight.py`

#### Responsibilities

- locate and parse `raes.config.yaml`;
- resolve required artifact paths;
- verify that required files exist;
- verify that each path is a regular readable file;
- reject required paths that escape the project root unless explicitly permitted by a later contract;
- parse the supported `## Slice Backlog` grammar;
- identify every valid top-level slice;
- reject malformed slice declarations;
- reject duplicate slice IDs;
- reject unsupported slice types;
- reject milestone headings within the backlog;
- identify the first unchecked slice;
- return its complete declaration and indented body;
- classify the slice as `execution` or `review` from the explicit type field;
- emit structured JSON;
- make no repository changes.

#### Suggested JSON output

Success:

```json
{
  "status": "ready",
  "project_root": "/absolute/path/to/project",
  "config_path": "/absolute/path/to/project/raes.config.yaml",
  "artifacts": {
    "build_intent": "docs/prd.md",
    "system_constraints": "docs/system.md",
    "next_slice": "docs/pipeline.md",
    "durable_decisions": "docs/decisions.md",
    "execution_guidance": "docs/execution-guidance.md",
    "validation": "docs/validation.md"
  },
  "slice": {
    "id": "S-0012",
    "type": "execution",
    "label": "Implement rollback functionality",
    "checked": false,
    "body_markdown": "..."
  }
}
```

Blocked:

```json
{
  "status": "blocked",
  "errors": [
    {
      "code": "UNSUPPORTED_MILESTONE_HEADING",
      "message": "Milestone headings inside ## Slice Backlog are not supported in Stage 1.",
      "path": "docs/pipeline.md",
      "line": 18
    }
  ]
}
```

#### Non-responsibilities

`preflight.py` does not:

- judge whether product requirements are semantically sufficient;
- implement the slice;
- run project validation;
- update pipeline state;
- migrate unsupported projects.

### `inspect_result.py`

#### Responsibilities

- capture repository state after Codex performs the slice;
- identify modified, added, deleted, renamed, and untracked files;
- compare the result with the baseline captured before implementation;
- report whether required validation commands ran;
- record command, source, exit code, and summarized output;
- verify that the selected pipeline checkbox has not changed;
- verify that the selected slice declaration and body are unchanged;
- identify changes to RAES artifacts;
- flag unexplained or potentially out-of-scope changes;
- emit a structured result suitable for Codex and human acceptance review.

#### Suggested JSON output

```json
{
  "status": "validated",
  "slice_id": "S-0012",
  "slice_type": "execution",
  "changes": {
    "modified": ["src/rollback.py"],
    "added": ["tests/test_rollback.py"],
    "deleted": [],
    "untracked": []
  },
  "validation": [
    {
      "command": "pytest",
      "source": "docs/validation.md",
      "exit_code": 0,
      "result": "passed"
    }
  ],
  "pipeline_unchanged": true,
  "scope_review": {
    "requires_human_judgment": true,
    "warnings": []
  },
  "blocking_errors": []
}
```

#### Limits

This script cannot fully determine semantic scope compliance.

It can identify file-level and state-level facts, but Codex and the user must still judge whether the changes actually satisfy the slice and remain within its intended meaning.

The script must not mark a slice accepted.

### `accept_slice.py`

#### Responsibilities

- receive the selected slice identity and session-bound validation evidence;
- reread the current pipeline;
- parse it using the same grammar as preflight;
- verify that the target slice still exists;
- verify that the target remains the first unchecked slice;
- verify that its type, label, and body remain unchanged;
- verify that the pipeline fingerprint matches the validated state;
- verify that repository state matches the state inspected during validation;
- replace only the target slice’s `[ ]` with `[x]`;
- write through a same-directory temporary file;
- atomically rename the temporary file over the pipeline;
- emit structured success or failure output.

#### Suggested JSON output

Success:

```json
{
  "status": "accepted",
  "slice_id": "S-0012",
  "pipeline_path": "docs/pipeline.md"
}
```

Stale state:

```json
{
  "status": "blocked",
  "errors": [
    {
      "code": "VALIDATION_STATE_STALE",
      "message": "Repository or pipeline state changed after validation. Revalidation is required."
    }
  ]
}
```

#### Stage 1 evidence binding

Session-bound evidence may include:

- slice ID;
- slice type;
- slice declaration and body hash;
- pipeline file hash;
- Git base commit;
- result diff hash or normalized changed-file fingerprint;
- validation commands and exit codes.

No permanent acceptance record is required in Stage 1.

## Codex Skill Responsibilities

`SKILL.md` should instruct Codex to perform the following interactive workflow.

### 1. Preflight

- Run `preflight.py`.
- Stop on any deterministic preflight failure.
- Read all authoritative artifacts returned by preflight.
- Read the entire selected slice body.
- Identify semantic ambiguity or conflicting requirements.
- Stop and ask the user when material ambiguity prevents safe execution.

### 2. Baseline

Before implementation:

- inspect `git status`;
- capture the current commit;
- identify pre-existing changed and untracked files;
- avoid overwriting or reverting unrelated user work;
- retain the baseline for result inspection.

### 3. Execute one slice

For an execution slice:

- analyze the relevant code and artifacts;
- formulate a bounded plan;
- modify only files needed for the slice;
- add or update appropriate tests;
- avoid advancing any later slice;
- do not change the selected pipeline checkbox.

For a review slice:

- inspect the required evidence;
- run relevant diagnostics;
- create only explicitly requested review outputs;
- do not modify implementation behavior;
- do not change the selected pipeline checkbox.

### 4. Validate

- gather required validation commands;
- run all mandatory checks;
- use `inspect_result.py` to capture repository and validation evidence;
- perform a semantic review of scope and acceptance criteria;
- classify the result as `validated`, `implemented but not validated`, or `blocked`.

### 5. Report

Codex must present:

```markdown
## Slice result

**Slice:** S-0012
**Type:** execution
**Status:** validated

### Work completed

- ...

### Files changed

- ...

### Validation

- `pytest` — passed
- `mypy .` — passed

### Acceptance criteria

- Criterion one — satisfied
- Criterion two — satisfied

### Warnings and pre-existing conditions

- None

### Repository state

- Pipeline unchanged
- No unexplained files changed
```

### 6. Request acceptance

Only when status is `validated`, ask:

```text
Accept slice S-0012 and mark it complete in the pipeline?
```

Do not infer acceptance from vague approval.

### 7. Record acceptance

After explicit acceptance:

- invoke `accept_slice.py`;
- report success;
- stop.

Do not automatically begin the next slice.

## Error and Blocking Behavior

Stage 1 must fail closed when:

- `raes.config.yaml` is missing or malformed;
- a required artifact path is missing;
- a required path is not a regular readable file;
- a path escapes the supported project boundary;
- `## Slice Backlog` is missing;
- a slice declaration is malformed;
- slice IDs are duplicated;
- a type is unsupported;
- milestone headings appear inside the backlog;
- no unambiguous first unchecked slice exists;
- a review slice requests implementation changes;
- mandatory validation cannot be completed;
- repository state changes after validation;
- acceptance does not clearly identify the selected slice.

A blocking result must explain:

- what is blocking;
- why it is unsafe to continue;
- which file or state is involved;
- the smallest action required to proceed.

## Testing Strategy

### Deterministic unit tests

Use TDD for all three scripts.

#### `preflight.py`

Test at least:

- valid execution slice;
- valid review slice;
- slice with a multiline body;
- nested bullets and nested checkboxes treated as body content;
- duplicate slice IDs;
- missing label;
- unsupported type;
- missing backlog;
- malformed top-level declaration;
- milestone heading inside backlog;
- missing artifact;
- artifact path is a directory;
- artifact path escapes project root;
- all slices accepted;
- uppercase `[X]` behavior, explicitly chosen and tested.

#### `inspect_result.py`

Test at least:

- modified and added files;
- deleted and untracked files;
- pre-existing working-tree changes;
- passed required validation;
- failed required validation;
- validation command unavailable;
- pipeline checkbox changed prematurely;
- selected slice body changed;
- unexplained RAES artifact change;
- no repository changes for a review slice.

#### `accept_slice.py`

Test at least:

- successful acceptance;
- target slice is no longer first unchecked;
- target slice already accepted;
- duplicate target ID;
- changed slice body;
- changed pipeline hash;
- changed repository fingerprint;
- only one checkbox changes;
- temporary-file cleanup after write failure;
- atomic same-directory replacement.

### BDD scenarios

#### Execution succeeds

```gherkin
Given a valid RAES project
And the first unchecked slice is an execution slice
When Codex completes the slice
And all required validation passes
And the final diff remains within scope
Then Codex reports the slice as validated
And the pipeline remains unchanged
When the user explicitly accepts the slice
Then only that slice is marked accepted
And Codex stops
```

#### Review succeeds

```gherkin
Given a valid RAES project
And the first unchecked slice is a review slice
When Codex completes the requested review
And creates only authorized review outputs
Then Codex reports the review as validated
And no implementation behavior is modified
When the user explicitly accepts the review
Then only that review slice is marked accepted
```

#### Validation fails

```gherkin
Given Codex has implemented an execution slice
When a required validation command fails
Then Codex reports implemented but not validated
And does not request acceptance
And does not change the pipeline
```

#### Pipeline is unsupported

```gherkin
Given the pipeline contains milestone headings inside Slice Backlog
When preflight runs
Then execution is blocked
And the error identifies the unsupported heading and location
And no repository files are changed
```

#### State becomes stale

```gherkin
Given a slice was validated
And the repository changes before acceptance
When acceptance is attempted
Then acceptance is blocked
And the pipeline remains unchanged
And Codex requires revalidation
```

## Implementation Slices

The implementation should proceed in this order.

### S1 — Establish the skill skeleton and fixtures

Create:

- `skills/raes-execute/SKILL.md`
- script and test directories;
- representative valid and invalid project fixtures.

No execution logic beyond test scaffolding.

### S2 — Implement config and artifact preflight

Implement:

- config loading;
- required artifact resolution;
- regular-file and readability checks;
- project-boundary checks;
- structured errors.

### S3 — Implement pipeline parsing and slice selection

Implement:

- Stage 1 grammar;
- multiline slice bodies;
- duplicate and malformed detection;
- milestone rejection;
- first-unchecked selection;
- explicit routing.

### S4 — Implement repository baseline and result inspection

Implement:

- Git baseline capture;
- changed-file classification;
- pipeline and slice mutation detection;
- validation result ingestion;
- structured result output.

### S5 — Implement atomic acceptance

Implement:

- stale-state checks;
- slice identity verification;
- repository fingerprint verification;
- targeted checkbox replacement;
- atomic write;
- structured output.

### S6 — Implement the interactive Codex workflow

Complete `SKILL.md` so Codex:

- runs preflight;
- reads authoritative context;
- executes exactly one slice;
- runs validation;
- inspects results;
- presents the required report;
- requests explicit acceptance;
- records acceptance;
- stops.

### S7 — Dogfood on a controlled RAES project

Use a small project matching the Stage 1 contract.

Verify:

- one execution slice;
- one review slice;
- failed validation;
- rejected acceptance;
- stale acceptance;
- unsupported pipeline handling.

Do not use legacy-project compatibility as the first dogfood target.

## Definition of Done

Stage 1 is complete when:

- the skill can be invoked interactively in Codex;
- a supported RAES project passes deterministic preflight;
- exactly one slice is selected;
- execution and review routing use explicit type metadata;
- Codex performs exactly one slice;
- required validation is run and reported;
- the final repository state is inspected;
- the pipeline is unchanged before acceptance;
- explicit user acceptance is required;
- stale validation evidence blocks acceptance;
- acceptance changes exactly one checkbox atomically;
- Codex stops after acceptance;
- deterministic tests pass;
- the core BDD scenarios have been dogfooded successfully.

## Deferred Work

After Stage 1 is working, revisit:

- Codex-native initialization;
- canonical versioned project contracts;
- legacy pipeline migration;
- milestone support;
- durable intermediate-state records;
- resumable acceptance across sessions;
- history and durable flags;
- workspace and multi-project support;
- non-interactive execution;
- richer validation configuration;
- permanent evidence and audit records;
- long-term decision-record format.
