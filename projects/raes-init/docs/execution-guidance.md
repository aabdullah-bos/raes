# raes-init — execution-guidance.md

## Invariants

- One slice per session.
- Use `projects/raes-init/docs/prd.md` as build intent and `projects/raes-init/docs/pipeline.md` as the next-slice source of truth.
- Preserve the create-or-fail write contract for the full 8-file docs set.
- Keep generated output human-readable, editable, and specific to the target project.
- Fail fast before file I/O when required input, provider configuration, or output shape is invalid.

## Workflow Rules

- Start by reading `raes.config.yaml`, then inspect the configured PRD, pipeline, decisions, and validation guidance before making changes.
- Identify the first unchecked slice in `pipeline.md` and apply only the rules for that slice type.
- For Execution Slices, write the smallest failing test first unless the slice explicitly states that no code path changes are required; in that case, add only the minimum validation needed to lock the artifact in place.
- Implement the minimum change required to satisfy the slice and avoid widening the current milestone.
- Run the relevant project validation commands from `projects/raes-init/package.json` after the change.
- Append handoff notes to `pipeline.md` after completing the slice.

### Operator Experience Rules

- Every operator-facing error must say what was wrong and what input or configuration needs to change next.
- Help text must describe both supported invocation modes: bare greenfield and `--from-prd`.
- Do not leave partially written docs behind on failure.

## Anti-Patterns

- Do not treat archetype templates as generation sources for `raes-init`; they are human reference docs only.
- Do not store provider settings or secrets in `raes.config.yaml`.
- Do not fabricate PRD requirements, durable decisions, or execution constraints that are not supported by the authoritative artifacts.
- Do not add overwrite, merge, or interactive prompt behavior unless a later slice explicitly introduces it.
- Do not redesign the milestone backlog while executing a bounded slice.

## Definition of Done

1. The current slice outcome is complete and bounded.
2. Relevant tests and `npm run typecheck` pass using the project-local toolchain.
3. The create-or-fail contract, output set, and config-routed source map remain intact.
4. `pipeline.md` is updated with the slice marked complete and a handoff note for the next session.
5. `decisions.md` is updated only if the slice uncovered a new durable rule.
