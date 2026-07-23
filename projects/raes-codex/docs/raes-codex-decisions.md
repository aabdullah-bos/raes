# Codex-Native RAES Execute

## Stage 1 Durable Decisions

| Decision | Rationale | Status | Date |
|---|---|---|---|
| Stage 1 accepts a flat Markdown backlog under `## Slice Backlog`. Each top-level slice must use the form `- [ ] <stable-id> \| <execution\|review> \| <label>` and may include indented Markdown content containing context, requirements, steps, acceptance criteria, validation instructions, or examples. The top-level slice is the only selectable and state-bearing unit. The first unchecked top-level slice is selected. Duplicate IDs, unsupported types, malformed declarations, nested selectable slices, and milestone headings within the backlog fail closed. `[ ]` means not accepted and `[x]` means accepted. | A stable ID and explicit type make selection, routing, validation reporting, and acceptance deterministic. Allowing indented Markdown preserves enough expressive space for complex slices without introducing independently tracked subtasks or nested state. A deliberately narrow grammar is safer than silently misinterpreting incompatible legacy pipelines. | Accepted for Stage 1 | 2026-07-23 |
| Every Stage 1 slice declares exactly one explicit type: `execution` or `review`. The executor routes only from this field and must not infer type from the label or body. Execution slices may modify implementation and test files within the authorized slice scope. Review slices may inspect the repository, run diagnostics and validation, and create explicitly requested review artifacts, but must not modify implementation behavior. Mixed review-and-fix slices must be split before execution. | Explicit routing removes the current label-based heuristic and gives each slice one operational mode. Keeping review and implementation separate strengthens one-slice execution, makes scope inspection clearer, and prevents review work from silently expanding into implementation. | Accepted for Stage 1 | 2026-07-23 |
| Codex may report a Stage 1 slice as `validated` only after completing the authorized work, running every required validation command, inspecting the final repository state, confirming that changes remain within scope, and finding no unresolved blocking failures or material ambiguities. Validation must be supported by an explicit result report and must leave the pipeline checkbox unchanged. When evidence is incomplete, Codex must report the slice as `implemented but not validated` or `blocked`. | Validation must be evidence-backed rather than inferred from successful-looking output. Passing tests alone does not prove that the correct files changed, that the slice stayed within scope, or that the repository is safe to accept. Separating implementation, validation, and acceptance prevents the current checkbox from representing several different states at once. | Accepted for Stage 1 | 2026-07-23 |
| Stage 1 acceptance is a separate, explicit, human-authorized transition. Codex may request acceptance only after presenting a validated result. Acceptance must clearly refer to the selected slice and must not be inferred from general approval language. Before recording acceptance, a deterministic mechanism must verify that the pipeline and repository still match the validated result. Acceptance atomically changes only that slice from `[ ]` to `[x]`; it does not alter the slice body or any other slice. Evidence binding may remain session-bound in the first version. | The user must accept the exact repository state that Codex validated. A separate deterministic transition prevents stale or ambiguous approval from changing pipeline state. Session-bound evidence is sufficient to produce a working interactive prototype without introducing a durable result-record or history subsystem prematurely. | Provisional for Stage 1 | 2026-07-23 |

## Deferred Decisions

The following questions are intentionally deferred until after a working interactive Stage 1 executor exists:

- the long-term format and lifecycle for durable decision records;
- durable persistence of `implemented`, `validated`, or `blocked` intermediate states;
- acceptance across separate Codex sessions;
- permanent validation and acceptance evidence records;
- compatibility and migration policy for legacy pipeline formats;
- milestone representation in the canonical backlog grammar;
- workspace and multi-project execution;
- non-interactive execution, history, and durable flagging.

These deferrals do not change the Stage 1 requirement to fail closed when the supported project or pipeline contract is not satisfied.
