---
name: raes-execute
description: Execute exactly one explicitly selected Stage 1 RAES execution or review slice in an interactive Codex session, including deterministic preflight, required validation, repository-state inspection, explicit human acceptance, and atomic pipeline recording. Use when a user asks Codex to run, review, validate, or accept the next slice in a supported single-project RAES repository.
---

# RAES Execute

Operate on one explicitly supplied RAES project and exactly one selected slice. Keep implementation, validation, and acceptance separate.

## Boundaries

- Work only in the project root explicitly opened or supplied by the user. Do not search upward, recursively, or through workspaces for another RAES project.
- Use only the flat Stage 1 declaration `- [ ] <stable-id> | <execution|review> | <label>`.
- Execute only the first unchecked top-level slice returned by deterministic preflight.
- Route only from the explicit `execution` or `review` field. Never infer type from label text.
- Perform the workflow in the current interactive Codex session. Do not invoke provider adapters, external agents, or unattended execution.
- Never change a pipeline checkbox during implementation, review, or validation.
- Never begin a second slice. Stop after acceptance, rejection, a blocked result, or an implemented-but-not-validated result.
- Keep session evidence outside the repository. Do not add history, result records, or durable intermediate-state files.

Resolve this skill directory before invoking its scripts. Use absolute paths for the project root, skill directory, and session evidence directory. Create the session directory with `mktemp -d`; use a task-specific name such as `RAES_SESSION_DIR`, not a system environment variable name.

## 1. Run deterministic preflight

Run:

```sh
python3 <skill-dir>/scripts/preflight.py --project-root <project-root>
```

Capture stdout as `preflight.json` in the session evidence directory. Read the JSON even when the command exits `2`.

- Continue only when `status` is `ready`.
- On `blocked`, report every structured error, the unsafe state, and the smallest required correction. Make no repository changes.
- Treat unsupported legacy syntax as blocked. Do not migrate or reinterpret it.

## 2. Read authority and selected scope

Read every authoritative artifact returned in `artifacts` in full:

1. `build_intent`
2. `system_constraints`
3. `next_slice`
4. `durable_decisions`
5. `execution_guidance`
6. `validation`

Read the complete selected declaration and `body_markdown`. Apply this precedence:

1. explicit user direction for this invocation, when it does not conflict with durable project authority;
2. build intent for product requirements;
3. system constraints for invariants and contracts;
4. durable decisions for accepted rationale;
5. selected slice for the bounded work;
6. execution guidance for workflow;
7. validation guidance for required checks.

Stop as `blocked` when authority is materially conflicting or insufficient, acceptance criteria are missing, the selected work violates a constraint, or a decision outside Codex authority is required. Do not invent intent or weaken a constraint.

For a `review` slice, block a mixed “review and fix” request. A review may create only review outputs explicitly requested by the selected slice and must not modify implementation behavior.

## 3. Capture the baseline

Before writing:

```sh
python3 <skill-dir>/scripts/inspect_result.py baseline --project-root <project-root>
```

Store stdout as `baseline.json` outside the repository. Continue only when `status` is `baseline`.

Version control is optional. The baseline always fingerprints the project filesystem; when the project is inside a Git working tree, inspection also records Git root, HEAD, tracked-file, and working-tree metadata.

Inspect and report pre-existing modified and untracked files. Preserve them, do not overwrite or revert unrelated user work, and distinguish them from changes made after the baseline.

## 4. Plan and perform exactly one slice

Form a bounded plan that names:

- the selected ID, type, label, and acceptance criteria;
- expected implementation or review-output paths;
- prohibited or protected paths;
- validation commands and their sources.

For an `execution` slice:

- inspect relevant code and tests;
- add or update tests as appropriate;
- make only the minimum implementation and directly authorized documentation changes;
- leave every pipeline declaration unchanged.

For a `review` slice:

- inspect evidence and run safe diagnostics;
- create only explicitly requested review artifacts;
- make no implementation-behavior changes;
- leave every pipeline declaration unchanged.

Stop after this slice. Do not preflight or plan the next one.

## 5. Run required validation

Gather commands in this order:

1. commands explicitly required by the selected slice;
2. mandatory commands in the configured validation artifact;
3. clearly applicable repository-standard checks.

Run every required command. Record a session JSON array in `validation.json`; each entry must contain:

```json
{
  "command": "python -m unittest",
  "source": "docs/validation.md",
  "exit_code": 0,
  "result": "passed",
  "output": "concise output summary"
}
```

Use `exit_code: null` and `result: "unavailable"` when a command cannot run. Never convert a failed or unavailable mandatory check into a pass. A pre-existing failure may be non-blocking only when repository evidence shows this slice did not introduce or worsen it and it does not undermine the acceptance criteria; disclose that reasoning explicitly.

## 6. Inspect deterministic result evidence

First run inspection without a scope decision:

```sh
python3 <skill-dir>/scripts/inspect_result.py inspect \
  --project-root <project-root> \
  --baseline-json <session-dir>/baseline.json \
  --preflight-json <session-dir>/preflight.json \
  --validation-json <session-dir>/validation.json \
  --allowed-path '<expected-path-or-glob>'
```

Provide one `--allowed-path` for each path or glob justified by the bounded plan. Read the JSON and inspect:

- modified, added, deleted, renamed, and untracked files;
- pre-existing conditions;
- validation results;
- `pipeline_unchanged` and `slice_unchanged`;
- RAES artifact changes;
- unexplained-change warnings.

The script proves file/state facts only. It does not prove semantic scope compliance. Independently compare the diff and repository state with the selected slice, acceptance criteria, system constraints, and durable decisions.

If semantic scope is satisfied, rerun inspection with the same inputs and `--scope-decision in_scope`; save stdout as `validated-result.json`. If scope is not satisfied, use `--scope-decision out_of_scope`. Do not use `in_scope` merely to clear warnings.

Classify the final result as exactly one of:

- `validated`: all required validation passed, pipeline and selected slice are unchanged, repository state was inspected, scope and acceptance criteria are satisfied, and no material blocker remains;
- `implemented but not validated`: authorized output exists but validation failed, was unavailable, or remains incomplete;
- `blocked`: execution was unsafe, authority or scope remained ambiguous, protected state changed, or work could not safely continue.

Only `validated-result.json` with `status: validated` is acceptance evidence.

## 7. Report the slice result

Present:

```markdown
## Slice result

**Slice:** <stable-id> — <label>
**Type:** execution|review
**Status:** validated|implemented but not validated|blocked

### Work completed

- ...

### Files changed

- ...

### Validation

- `<command>` — passed|failed|unavailable — source: <source>

### Acceptance criteria

- <criterion> — satisfied|not satisfied|unverified

### Blocking failures

- None | ...

### Non-blocking warnings

- None | ...

### Pre-existing conditions

- None | ...

### Repository state

- Pipeline unchanged: yes|no
- Selected slice unchanged: yes|no
- Unexplained changes: none|...
```

Do not request acceptance for `implemented but not validated` or `blocked`.

## 8. Request explicit acceptance

Only after reporting `validated`, ask exactly:

```text
Accept slice <stable-id> and mark it complete in the pipeline?
```

Wait for a response that clearly accepts that exact slice in answer to this question. Do not infer acceptance from silence, “continue,” “looks good,” general praise, a request to finish the task, or approval given before the validated report.

If the user rejects or does not clearly accept:

- do not invoke acceptance;
- leave the pipeline unchanged;
- do not revert implementation automatically;
- report that the same slice remains next;
- stop.

## 9. Record acceptance atomically

After clear acceptance of the exact slice, run:

```sh
python3 <skill-dir>/scripts/accept_slice.py \
  --project-root <project-root> \
  --evidence-json <session-dir>/validated-result.json \
  --slice-id <stable-id>
```

Read the JSON. On `blocked`, report that state changed and revalidation is required; do not retry with weakened evidence. On `accepted`, report the exact accepted slice and pipeline path.

Stop immediately. Do not inspect, select, discuss, or begin the next slice.
