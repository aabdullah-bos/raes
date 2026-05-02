# cli archetype

## What this archetype is for

This archetype provides reference templates for general-purpose CLI tools that:
- accept commands, subcommands, and flags
- read from one or more configuration files
- interact with external systems (AI providers, file system, APIs)
- have explicit exit code contracts
- separate command parsing, business logic, and I/O into distinct layers

It is distinct from `cli-doc-generator`, which is narrowly scoped to CLIs that take a PRD as input and produce markdown documentation. Use `cli` when the tool's primary purpose is operational — orchestrating work, executing plans, managing state, or driving external integrations.

---

## Templates in this directory

- `system.template.md` — default system rules, invariants, and anti-patterns for a general-purpose CLI tool
- `pipeline.template.md` — execution structure and suggested milestones for a general-purpose CLI tool

---

## How these templates are used

These templates are **reference documents for humans**, not generation sources for `raes-init`.

`raes-init` does not load or render these templates. It generates project-specific output based on the PRD content provided at init time. The generation logic lives in `projects/raes-init/src/generate-docs.ts` and is hardcoded, not template-driven.

These templates serve two purposes:

1. **Human reference** — reading them gives an operator a starting point for understanding what a well-structured general-purpose CLI project looks like before customizing the generated output.

2. **Brownfield discovery hints** — when `raes-discover` (not yet implemented) inspects a brownfield project built around this shape, these templates will serve as reference shapes for identifying candidate artifacts.

---

## What raes-init actually generates

`raes-init` with the `cli` archetype produces eight files in the target project's `/docs` directory:

| File | Config key | Purpose |
|---|---|---|
| `prd.md` | `build_intent` | Verbatim copy of the source PRD |
| `system.md` | — | Project constraints, invariants, drift guards, known contracts |
| `pipeline.md` | `next_slice` | Execution plan with slice backlog |
| `decisions.md` | `durable_decisions` | Durable decision log |
| `prd-ux-review.md` | — | Operator experience risk review derived from PRD |
| `execution-guidance.md` | `execution_guidance` | Workflow rules, anti-patterns, definition of done |
| `validation.md` | `validation` | Testing approach and validation commands |
| `raes.config.yaml` | — | Source routing config pointing to all of the above |

`system.md` is not referenced in `raes.config.yaml` because it is consumed during Review Slices by the operator, not by the automated execution loop.

`prd-ux-review.md` is not referenced in `raes.config.yaml` because it is a **bootstrap artifact**, not a living loop document. It surfaces operator experience ambiguity from the PRD at init time. Once the operator transfers its findings into `execution-guidance.md` (as operator experience constraints) and `decisions.md` (as decided behaviors), it has served its purpose.

---

## UX concerns for CLI archetypes

For CLI/tooling archetypes, UX concerns are operator-facing: command surface clarity, error message quality, exit code contracts, flag naming, and failure behavior. These do not warrant a standalone document in the execution loop.

The right home for CLI operator experience constraints is a `## Operator Experience Rules` subsection inside `execution-guidance.md`. Example rules for a general-purpose CLI tool:

- Every error message must tell the operator what to do next, not just what went wrong.
- Help text must describe all supported commands, subcommands, and flags.
- The CLI must exit with a non-zero code on any error — never silently succeed after a failure.
- The CLI must validate configuration before performing any side-effecting work.
- The CLI must not silently ignore unrecognized arguments or unknown config keys.
- Partial state mutations must be detectable and recoverable, or must not be allowed to occur.

**How `prd-ux-review.md` feeds this:**

After init, review `prd-ux-review.md` and transfer any operator experience findings that should constrain execution into `execution-guidance.md` under `## Operator Experience Rules`. Record any decisions that must persist across slices in `decisions.md`. Once that transfer is complete, `prd-ux-review.md` is done.

---

## Archetype contract (V1 scope)

A complete archetype for `raes-init` V1 must provide:

- `system.template.md` — rules, invariants, anti-patterns, and definition of done applicable to this project shape
- `pipeline.template.md` — suggested milestones and execution structure for this project shape
