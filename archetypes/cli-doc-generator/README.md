# cli-doc-generator archetype

## What this archetype is for

This archetype provides reference templates for CLI tools that take structured input (such as a PRD) and generate markdown documentation.

---

## Templates in this directory

- `system.template.md` — default system rules, invariants, and anti-patterns for a CLI doc generator
- `pipeline.template.md` — execution structure and suggested milestones for a CLI doc generator

---

## How these templates are used

These templates are **reference documents for humans**, not generation sources for `raes-init`.

`raes-init` does not load or render these templates. It generates project-specific output based on the PRD content provided at init time. The generation logic lives in `projects/raes-init/src/generate-docs.ts` and is hardcoded, not template-driven.

These templates serve two purposes:

1. **Human reference** — reading them gives an operator a starting point for understanding what a well-structured CLI doc generator project looks like before customizing the generated output.

2. **Brownfield discovery hints** — when `raes-discover` (not yet implemented) inspects a brownfield project built around this shape, these templates will serve as reference shapes for identifying candidate artifacts.

---

## What raes-init actually generates

`raes-init` with the `cli-doc-generator` archetype produces eight files in the target project's `/docs` directory:

| File | Config key | Purpose |
|---|---|---|
| `prd.md` | `build_intent` | Verbatim copy of the source PRD |
| `system.md` | — | Project constraints, invariants, drift guards, known contracts |
| `pipeline.md` | `next_slice` | Execution plan with slice backlog |
| `decisions.md` | `durable_decisions` | Durable decision log |
| `prd-ux-review.md` | — | UX risk review derived from PRD |
| `execution-guidance.md` | `execution_guidance` | Workflow rules, anti-patterns, definition of done |
| `validation.md` | `validation` | Testing approach and validation commands |
| `raes.config.yaml` | — | Source routing config pointing to all of the above |

`system.md` is not referenced in `raes.config.yaml` because it is consumed during Review Slices by the operator, not by the automated execution loop.

`prd-ux-review.md` is not referenced in `raes.config.yaml` because it is a **bootstrap artifact**, not a living loop document. It surfaces UX ambiguity from the PRD at init time. Once the operator transfers its findings into `execution-guidance.md` (as UX constraints) and `decisions.md` (as decided UX patterns), it has served its purpose. See "UX concerns for CLI archetypes" below.

---

## UX concerns for CLI archetypes

For CLI/tooling archetypes, UX concerns are narrow and well-defined: help text clarity, error message quality, option naming, and failure behavior. These do not warrant a standalone document in the execution loop.

The right home for CLI UX constraints is a `## Operator Experience Rules` subsection inside `execution-guidance.md`. Example rules for a CLI doc generator:

- Every error message must tell the operator what to do next, not just what went wrong.
- Help text must describe all supported invocation modes.
- Failure must happen before any file I/O — never leave partial output on disk.
- The CLI must not silently ignore unrecognized arguments.

**How `prd-ux-review.md` feeds this:**

After init, review `prd-ux-review.md` and transfer any UX findings that should constrain execution into `execution-guidance.md` under `## Operator Experience Rules`. Record any UX decisions that must persist across slices in `decisions.md`. Once that transfer is complete, `prd-ux-review.md` is done — it is not a document the loop re-reads.

**For product archetypes:** a dedicated `ux-constraints.md` config key is warranted when the archetype has real end-user UX (user flows, transitions, affordances, timing). That decision is deferred to when the first product archetype is designed.

---

## Archetype contract (V1 scope)

A complete archetype for `raes-init` V1 must provide:

- `system.template.md` — rules, invariants, anti-patterns, and definition of done applicable to this project shape
- `pipeline.template.md` — suggested milestones and execution structure for this project shape

The contract is now established across three archetypes (`cli-doc-generator`, `frontend-backend-ai-app`, `cli`). Each archetype directory contains exactly `README.md`, `system.template.md`, and `pipeline.template.md`. Generation logic for each archetype is hardcoded in `projects/raes-init/src/generate-docs.ts`.
