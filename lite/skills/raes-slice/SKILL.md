---
name: raes-slice
description: Execute exactly one RAES slice (execution or review) from docs/pipeline.md, following the rules in AGENTS.md, with deterministic preflight, inspection and acceptance scripts. Use when asked to run, work, or continue the next slice. Supports --dry-run to preview the slice without making changes.
---

# Run one RAES slice

Follow the RAES working rules in `AGENTS.md` (Always, Scope, Flag, Stuck). This skill adds the procedure and the deterministic checks.

## Setup
- `<skill-dir>` is the folder that contains this `SKILL.md`. The scripts need `python3` and `git` and nothing else.
- `<root>` is the project root. If a `raes.workspace.yaml` exists, use the project named in the request (ask if none is named and there are several). Otherwise use the repository root.
- Keep session evidence outside the repository: `S=$(mktemp -d)`.

## 1. Preflight (deterministic)
```sh
python3 <skill-dir>/scripts/preflight.py --project-root <root> > "$S/preflight.json"
```
- Read the JSON even when the exit code is 2. Continue only when `status` is `ready`.
- On `blocked`, report every error with its fix, make no changes, and stop.
- From the result, take: `layout` (`config` or `lite`), the `artifacts` to read, and the selected `slice`: `id`, `type` (from the declaration only, never inferred from the label) and `fields` (`scope`, `out_of_scope`, `question`, `experiment`, `allowed_paths`).
- Read every artifact listed in `artifacts` in full.

## Dry run (`--dry-run` in the request)
Run step 1 only, then stop. Make no edits to any file.
- Report: the selected slice, its type and fields, the checks that would define done, and whether each validation command exists and can run here.
- List any Flag or Stuck conditions that are already true. End with "Dry run only: no changes made."

## 2. Baseline (deterministic)
```sh
python3 <skill-dir>/scripts/inspect_result.py baseline --project-root <root> > "$S/baseline.json"
```
Before editing anything, reply with: the slice, its type, the scope you'll stay inside, and the checks that define done. If any Flag condition is already true, flag now instead.

## 3a. Execution slice
ANALYZE, then PLAN, then GENERATE (failing tests or checks first), then IMPLEMENT (minimum change), then TEST (the done checks), then EXPLAIN.
For infrastructure: you may iterate on plan, and must never apply. Summarize the plan as counts of add, change and destroy, list every destroy or replace explicitly, and flag any change to IAM, networking, state or shared resources.

## 3b. Review slice
INSPECT, then SYNTHESIZE. No implementation.
- You may run commands, read-only queries and disposable local environments.
- You may change only the decision log and the paths in `allowed_paths`. Everything else, including untracked files left in the repo, blocks the slice at inspection.
- With a `question:` line, the slice is done when the question is answered with evidence, or shown to be unanswerable with what's available.
- For evidence only the human can supply, prepare a checklist and record only what the human actually gives you.

## Both types: what you may write during the slice
- **Never edit the pipeline file during the slice.** Inspection blocks any change to it, and acceptance ticks the checkbox. Handoff notes are written in step 6.
- You may append proposed decisions (status `proposed`) to the decision log.

## 4. Validation evidence and inspection (deterministic)
Write `"$S/validation.json"`: a list with one entry per check you ran, each with `command`, `source` (the file that defines the check), `exit_code`, `result` (`passed` or `failed`) and a short `output`. A review slice records the commands and queries it ran as checks.
A review slice records **checks of its own work** in `validation.json` (for example `git status --porcelain` from the repository root showing no unexpected changes, and that each planned query ran). The project's test results, including missing or failing suites, are **findings**: report them in the handoff note, not in `validation.json`, because a missing or failed entry blocks acceptance.
```sh
python3 <skill-dir>/scripts/inspect_result.py inspect --project-root <root> \
  --baseline-json "$S/baseline.json" --preflight-json "$S/preflight.json" \
  --validation-json "$S/validation.json" --scope-decision unreviewed > "$S/inspection.json"
```
The slice's `allowed_paths` are applied automatically, and `--allowed-path` adds more. Review the reported changes and warnings against the slice's scope, then rerun with `--scope-decision in_scope` or `out_of_scope`. Statuses: `validated`, `ready_for_review`, `implemented_but_not_validated`, `blocked`.

## 5. Review gate and acceptance
Show a short summary with the riskiest change or open question first, plus the inspection status. Ask the human to confirm completion (yes or no). Only after an explicit yes, and only when the status is `validated`:
```sh
python3 <skill-dir>/scripts/accept_slice.py --project-root <root> --evidence-json "$S/inspection.json" --slice-id <id>
```
Never tick the checkbox by hand.

## 6. Handoff note, then stop
After acceptance, or after a blocked or unvalidated result, append a handoff note under `## Handoff Notes`, headed with the slice ID. Cover what was done, the validation results, flags raised, proposed decisions, the next recommended slice, and (if the slice has an `experiment:` line) whether the prediction held, with the evidence. A note for an unfinished slice starts with `BLOCKED:`. Then stop. Do not start the next slice.
