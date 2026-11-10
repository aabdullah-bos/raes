---
name: raes-slice
description: Execute exactly one RAES slice (execution, review, or learning) from docs/pipeline.md, following the rules in AGENTS.md. Use when asked to run, work, or continue the next slice. Supports --dry-run to preview the slice without making changes.
---

# Run one RAES slice

Follow the RAES working rules in `AGENTS.md` (Always, Scope, Flag, Stuck). This skill adds the procedure.

## 1. Locate and select
1. If a `raes.workspace.yaml` exists, use the project named in the request; if none is named and there are several, ask. If the project has a `raes.config.yaml`, load every source it lists. Otherwise use the lite layout: `AGENTS.md`, `docs/pipeline.md`, `docs/decisions.md`.
2. Select the first unchecked slice (`- [ ]`) and read its `type:`, `scope:`, `out_of_scope:` and `experiment:` lines.
3. Before editing anything, reply with: the slice, its type, the scope you will stay inside, and the checks that define done. If any Flag condition is already true, flag now instead.

## Dry run (`--dry-run` in the request)
Do step 1 only, then stop. Make no edits to any file.
- If a deterministic checker such as `raes-execute` is installed, run its dry run and report the output.
- Report: the selected slice and its type; its scope and out-of-scope; the checks that define done; and whether each validation command exists and can run here.
- List any Flag or Stuck conditions that are already true. End with "Dry run only: no changes made."

## 2. Execution slice
ANALYZE, then PLAN, then GENERATE (failing tests or checks first), then IMPLEMENT (minimum change), then TEST (the done checks), then EXPLAIN, FLAG, REVIEW and RECORD.
For infrastructure: you may iterate on plan, and must never apply. Summarize the plan as counts of add, change and destroy, list every destroy or replace explicitly, and flag any change to IAM, networking, state or shared resources.

## 3. Review slice
INSPECT, then SYNTHESIZE, then FLAG, REVIEW and RECORD. No implementation.
For evidence that only the human can supply (access, manual checks): prepare a checklist, ask for each item, and record only what the human actually gives you.

## 4. Learning slice
Read-only investigation, plus throwaway experiments if the slice allows them. The output is knowledge, not code you keep: resolved or newly found Unknowns, discovered contracts and their consumers, proposed decisions (with the condition that would confirm or overturn each one), and the next 2–3 slices proposed with type and scope.

## 5. Record
- Add a handoff note to `docs/pipeline.md`: what was done, the validation results, flags raised, proposed decisions, and the next recommended slice.
- If the slice has an `experiment:` line, add one line saying whether the prediction held, with the evidence.
- Add proposed decisions to `docs/decisions.md` with status `proposed`.

## 6. Review gate and stop
Show a short summary with the riskiest change or open question first. Ask the human to confirm completion (yes or no). Mark the slice `- [x]` only after an explicit yes. Then stop; do not start the next slice.
