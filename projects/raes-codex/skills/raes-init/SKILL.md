---
name: raes-init
description: Initialize exactly one greenfield or existing non-RAES project from one explicit PRD, optional SRS and architecture, and categorized handoffs and contracts into the Stage 1 RAES contract.
---

# RAES Init

Compile approved project intent into one complete Stage 1 RAES project. This is an interactive, create-or-fail workflow; do not scaffold application code, discover sources, migrate, overwrite, register a workspace, or execute the first slice.

## 1. Resolve and preflight

Use exactly one explicit or currently opened project root and exactly one explicit PRD. Accept at most one explicit SRS and architecture document and any explicitly categorized handoffs and behavioral contracts. Do not search for inputs.

Run `scripts/preflight.py` with absolute paths. Stop on `blocked`; report every error and confirm that no target mutation occurred.

## 2. Read and reconcile

Read every supplied source completely once. Apply authority by question:

1. Stage 1 methodology;
2. PRD for purpose, product behavior, scope, outcomes, and non-goals;
3. SRS for compatible software-requirement elaboration;
4. architecture for technical boundaries, dependencies, and sequencing;
5. handoffs for immediate scope;
6. contracts for existing and compatibility behavior.

Surface contradictions and user-visible SRS expansions. Ask the user to resolve every blocking conflict before generation. A durable ambiguity may become an early review slice only if every permitted answer leaves later slice inventory and order valid. That review must update `docs/decisions.md` and affected constraints in `docs/system.md`; dependent slices consult those artifacts. If any answer could add, remove, split, combine, or reorder work, block initialization.

## 3. Compile one candidate

Create an OS temporary staging directory and a manifest containing the exact preflight result, `staging_root`, manifest version, invocation ID, and destinations. Preserve PRD, SRS, and architecture bytes. Generate the six derived Markdown artifacts and exact config as one coherent set.

Use the exact headings and slice labels in `docs/stage-1-init.md`. Use only flat declarations:

`- [ ] S-0001 | execution | Label`

or

`- [ ] S-0001 | review | Label`

IDs are unique and sequential. Every slice has `Description:` and bulleted `Acceptance criteria:`. Execution slices use `Validation:` when established commands or required checks apply. Review slices have singular `Required output:` with bullets. Labels appear once, alone at slice-body indentation. Do not add milestone headings or nested selectable declarations.

Ground all prose in sources and repository evidence. Do not invent requirements, rationale, dependencies, conventions, tools, or commands. When validation commands are unknown, state outcomes and add early work to establish and record real commands.

## 4. Validate and review

Run `scripts/validate_artifacts.py --manifest ...`. Correct the staged candidate and repeat until structurally valid. Deterministic success proves structure and safety, not semantic fidelity.

Before commit, review the complete staged candidate against every approved source using the semantic-validation boundary in `docs/stage-1-init.md`:

- **Grounding:** Every substantive derived claim, constraint, behavior, validation expectation, and slice is supported by an approved source or explicit repository evidence.
- **Consistency:** Generated artifacts do not contradict the approved sources, resolved authority, or one another.
- **Coverage:** Every approved actionable requirement is represented by a durable constraint, pipeline slice, validation expectation, explicit unknown, authoritative exclusion, or blocker.

Confirm specifically that `system.md` faithfully captures durable source constraints, the pipeline covers the complete high-confidence known scope, and no requirement or work was invented. Block before commit on unsupported additions, material contradictions, unaccounted-for requirements, or ambiguity that could invalidate backlog inventory or order.

Record the semantic review result separately from deterministic validation. Do not describe it as a mechanical proof. Target files remain untouched until both validation layers succeed.

## 5. Commit and stop

Run `scripts/commit_project.py --manifest ...`. It rechecks relevant state and installs exclusively with rollback. Never force, merge, resume, or overwrite. On failure, report stale state, created paths, rollback status, and temporary cleanup status.

On success report the absolute project root, paths created or preserved, supporting sources consulted, execution/review counts, unresolved non-blocking ambiguities, deterministic validation status, separate grounding/consistency/coverage findings and evidence basis, and the full first slice. Stop without executing it.
