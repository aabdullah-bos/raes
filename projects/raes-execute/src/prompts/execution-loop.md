Read `docs/raes.config.yaml` first and use it to locate the authoritative
project artifacts for:
- build intent
- system constraints
- next slice
- execution guidance
- durable decisions
- validation guidance

Read the first unchecked slice in the configured backlog. Identify its type:
Execution Slice or Review Slice. Apply the rules for that type only.

---

EXECUTION SLICE — loop: PLAN → SLICE → EXECUTE → TEST → EXPLAIN → FLAG → REVIEW → RECORD

Rules:
- execute one slice only
- use the configured next-slice source as the source of truth for what to do next
- use the configured system-constraints source as the source of truth for
  invariants, drift guards, and contracts that must hold across all slices
- use the configured execution-guidance source as the source of truth for
  constraints, anti-patterns, workflow rules, and definition of done
- if system-constraints and execution-guidance disagree on a constraint, flag
  the conflict explicitly before proceeding — do not silently resolve it
- use the configured durable-decisions source as the source of truth for
  decisions that must persist across slices
- do not redesign the milestone or restate the overall plan unless required
  for execution
- write failing tests first
- implement the minimum code required to make those tests pass
- run relevant tests and typecheck using the project's existing tooling and
  the configured validation guidance
- append handoff notes to the configured pipeline file; handoff notes capture
  operational state from this slice only: what was left incomplete, what was
  discovered mid-slice, and what the next operator needs to pick up — do not
  restate guidance or constraints already present in execution-guidance
- you may append operational notes to artifacts in their correct RAES roles,
  but do not mark the slice complete in the backlog; slice completion is
  recorded only by the parent loop after explicit operator confirmation
- update the configured execution-guidance source only if this slice uncovered
  a durable rule that applies to all remaining slices; the threshold is whether
  the guidance would still be relevant five slices from now
- append durable implementation decisions to the configured decisions file
  only when needed

Expected output: Current slice | Sources used | Repo inspection | Plan |
Tests added/updated | Implementation changes | Commands run | Result |
Flags | Next recommended slice

---

REVIEW SLICE — loop: PLAN → SLICE → INSPECT → SYNTHESIZE → FLAG → REVIEW → RECORD

Rules:
- inspect authoritative artifacts before writing anything
- compare current state to build intent
- identify concrete gaps explicitly — do not paper over them
- do not duplicate what already exists — reference it
- no implementation code
- append findings, handoff context, and next-slice recommendation to the
  appropriate artifact when needed, but do not mark the slice complete in the
  backlog; slice completion is recorded only by the parent loop after explicit
  operator confirmation
- if the review produces durable guidance for future slices, add it to
  execution-guidance; if it is operational context for the immediate next
  slice only, add it to pipeline handoff notes

Expected output: Current slice | Artifacts inspected | Findings | Gaps (explicit) |
Output artifact(s) produced | Flags | Next recommended slice

---

In either case:
- if required guidance is missing, conflicting, or ambiguous, flag it explicitly
  before proceeding
- document what happened in the correct artifact when needed, even if the slice
  fails or times out, but leave backlog completion state to the parent loop
- stop immediately after completing the slice
