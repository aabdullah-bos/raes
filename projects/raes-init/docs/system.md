# RAES Init — System Definition

This document defines the execution rules for `raes-init`.

It adapts the `cli-doc-generator` archetype to the current PRD and should be treated as the guardrail document for implementation sessions.

---

## Product Invariants
- `raes-init` generates project-specific RAES documentation from a PRD plus a selected archetype
- The generated output is a set of human-editable markdown files, not opaque machine-only artifacts
- Generated documents must reflect product intent from the input PRD and archetype, without silently replacing that intent
- The tool must surface uncertainty explicitly rather than inventing missing contracts or UX details
- V1 scope stops at docs generation; it does not scaffold app code, infrastructure, or product runtime architecture
- V1 happy path accepts one project name, one PRD file path, and one explicit archetype selection
- Optional notes and inline PRD text input are out of scope for the first happy path unless a later documented decision expands them

## Drift Guards
- Treat the PRD loaded from the provided file path as the primary source of product intent for generation
- Treat the selected archetype as a default execution shape, not as project truth
- Do not fabricate missing product constraints, CLI semantics, or file-merge behavior
- Prefer deterministic generation over heuristic guessing
- Keep generated markdown readable and straightforward to edit manually
- Implement the minimum logic required for the current slice
- One slice per session
- Stop after completing a slice
- Do not introduce plugin systems, template registries, or extensibility layers before core generation works
- Do not add support for inline PRD text input or optional notes in the V1 happy path
- Fail fast if any target output doc already exists rather than overwriting or merging user-authored docs

## Contracts
- V1 inputs are one project name, one PRD file path input, and one explicit archetype selection
- Outputs include `PRD.md`, `system.md`, `pipeline.md`, `decisions.md`, and `prd-ux-review.md` in the target project's docs directory
- `system.md` must include product invariants, drift guards, contracts, unknowns, anti-patterns, and definition of done
- `pipeline.md` must include purpose, invariants, known contracts, unknowns, and a small sequential slice backlog
- `prd-ux-review.md` must extract ambiguities, UX risks, and open questions from the PRD
- If any target output doc already exists, V1 must stop with an explicit error instead of overwriting or merging files

## Unknowns
- The exact CLI flag names and invocation syntax for V1
- How archetype selection is presented to the user in the command interface
- How much normalization should be applied when copying the input PRD into the generated `PRD.md`
- Whether the tool should halt on ambiguous PRDs or continue with explicit placeholders

## Anti-Patterns
- Do not treat archetype defaults as durable project decisions without PRD support
- Do not silently expand V1 beyond the single happy-path input contract
- Do not overwrite or merge into existing target docs in V1
- Do not generate polished-sounding filler to hide missing product decisions
- Do not blend docs generation with code scaffolding or repository setup
- Do not create large milestone plans before the first generation path is proven

## Definition of Done
A slice is complete only if:
1. The slice is explicitly named
2. Tests were written or updated first where applicable
3. Minimum implementation for that slice is complete
4. Generated output remains readable, editable markdown
5. Unknowns are surfaced instead of invented
6. No unrelated templates or project files were changed
7. Durable decisions were appended to `projects/raes-init/docs/decisions.md` if needed
8. Work stopped after the slice completed
