# raes-init — execution-guidance.md

## Invariants

- One slice per session.
- Use `projects/raes-init/docs/prd.md` as build intent and `projects/raes-init/docs/pipeline.md` as the next-slice source of truth.
- Preserve the create-or-fail write contract for the full 8-file docs set.
- Keep generated output human-readable, editable, and specific to the target project.
- Fail fast before file I/O when required input, provider configuration, or output shape is invalid.

## Workflow Rules

### Constraint Promotion

When a decision during execution produces a durable constraint:
1. Add the constraint to `system.md` (under Invariants, Drift Guards, or Contracts).
2. Record the rationale in `decisions.md` with a reference to the `system.md` section where the constraint lives.

The agent reads `system.md` for constraints; `decisions.md` only for rationale. This keeps the constraint surface small and stable.

### Emergent Work

When work is discovered during a slice that was not in the plan, classify it immediately:

| Classification | Criteria | Action |
|----------------|----------|--------|
| **Inline Fix** | <5 lines, no interface touched | Do it now; note in handoff. No Parking Lot entry. |
| **New Slice** | More lines or touches a contract; fits current milestone | Add Parking Lot entry. Promote at REVIEW. |
| **New Milestone** | Out of scope; 3–8 slices to complete | Add Parking Lot entry. Stub a new milestone at REVIEW. |
| **Sub-Project** | 5+ slices, own constraints and unknowns | Add Parking Lot entry. Create a subdirectory with its own `pipeline.md`. |

If Blocking = Yes: stop the current slice and raise at REVIEW. The next slice does not start until the item is promoted or dismissed.

Add all non-inline items to the `## Parking Lot` table in `pipeline.md`.

### Execution Rules

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

## Milestone Guidance

### Milestone 1: Core Generation

Focus on establishing the complete 8-file output set, the create-or-fail write contract, and the archetype-specific template rendering. Validate all error paths before the happy path — generation correctness depends on early failure. The schema contract between `raes-init` output and `raes-execute` input must be stable before Milestone 2.

### Milestone 2: AI-Seeded Generation

The `--from-prd` provider path layers on top of a working Milestone 1. Keep AI and bare-mode paths clearly separated in generation logic; do not let provider-specific behavior leak into template rendering. Shape validation (`validateGeneratedDocShape`) is the safety boundary — expand it before expanding the AI prompt surface.

### Milestone 3: Archetype Expansion

Each new archetype must be proven against a real project before being promoted as supported. The archetype contract (what templates produce, what `raes-init` generates) must be documented in the archetype README before implementation begins.
