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

`system.md` and `prd-ux-review.md` are not referenced in `raes.config.yaml` because they are consumed during Review Slices by the operator, not by the automated execution loop.

---

## Archetype contract (V1 scope)

A complete archetype for `raes-init` V1 must provide:

- `system.template.md` — rules, invariants, anti-patterns, and definition of done applicable to this project shape
- `pipeline.template.md` — suggested milestones and execution structure for this project shape

The contract between archetypes and `raes-init`'s generation logic will be formalized before a second archetype is implemented. At that point, the archetype directory structure and required files will be specified here.
