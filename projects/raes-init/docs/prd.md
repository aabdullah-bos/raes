# RAES Init — PRD (v1)

## Purpose

Create a simple tool that initializes a new project using the RAES framework.

The tool takes an archetype and an optional PRD, and generates a set of project-specific
execution documents that enable immediate development using RAES.

---

## Problem

Starting a new project with RAES currently requires:

- manually creating multiple documents
- interpreting the RAES template
- deciding how to structure system definition and pipeline
- translating a PRD into slices

This creates friction and inconsistency.

---

## Goal

Enable a user to reach a runnable RAES loop in one step, whether they are starting
from nothing or from an existing PRD.

---

## Target User

- Developers building AI-enabled applications
- Product-oriented engineers
- Users familiar with RAES or similar workflows

---

## Core Functionality

### 1. Initialization Modes

The tool supports two initialization modes:

**Bare greenfield** — no PRD exists yet:
```
raes-init <target-project-path> <archetype>
```
Generates stub docs with section structure and no content. The operator fills
in the stubs before running the first slice.

**PRD-seeded** — a PRD already exists:
```
raes-init --from-prd <prd-path> <target-project-path> <archetype>
```
Generates docs adapted from the source PRD. The PRD is copied verbatim to
`docs/prd.md`. Other docs are populated with content derived from PRD sections.

---

### 2. Input Contract (V1)

- PRD input must be a readable file path — inline text is not supported in V1
- Target output is one project-local `docs/` directory
- Archetype must be explicitly specified — auto-detection is not supported in V1
- Supported archetype in V1: `cli-doc-generator`

---

### 3. Output

Both initialization modes generate the same set of files in `<target>/docs/`:

| File | PRD-seeded content | Bare greenfield content |
|---|---|---|
| `prd.md` | Verbatim copy of source PRD | Stub (Overview, Goals, Non-Goals, Constraints, Open Questions) |
| `system.md` | Derived from PRD sections | Fallback defaults |
| `pipeline.md` | Derived from PRD sections | Fallback defaults |
| `decisions.md` | Empty decision log table | Empty decision log table |
| `prd-ux-review.md` | UX risks derived from PRD | Fallback defaults |
| `execution-guidance.md` | Stub | Stub |
| `validation.md` | Stub | Stub |
| `raes.config.yaml` | Generated; routes loop to all source files | Generated; routes loop to all source files |

All generated files must be human-readable, editable markdown. The tool must not
fabricate content not present in the PRD.

---

### 4. Write Behavior

- Creates `<target>/docs/` if it does not exist
- Fails before writing if any required output file already exists
- Overwrite and merge behavior are out of scope for V1

---

### 5. Generation Logic (V1)

PRD adaptation uses section-aware string parsing — not AI inference in V1:

- Title: first `# ` heading in the PRD
- Bullets: extracted from `## Core Functionality`, `## Constraints`, `## Open Questions` sections
- When a section is absent or empty, generated docs fall back to generic defaults

`system.md` and `prd-ux-review.md` generation adapts PRD content to RAES section shapes.
`pipeline.md` uses PRD-derived content for Known Contracts and Unknowns.
`execution-guidance.md` and `validation.md` are stubs in V1 regardless of initialization mode.

Archetype templates (in `archetypes/`) are reference documents for humans and brownfield
discovery. They are not consumed by the generation logic in V1.

---

## Non-Goals (v1)

- No AI inference calls during generation (deferred to a future slice behind a provider interface)
- No code generation
- No repo scaffolding beyond docs
- No automatic UI/backend setup
- No enforcement of tooling (React, Node, etc.)
- No persistence or database setup
- No inline PRD text input
- No archetype auto-detection

---

## Success Criteria

- Operator can immediately begin the RAES execution loop after init
- Generated pipeline is usable without major rewriting
- System definition captures real constraints without overreach
- Operator is not blocked by missing structure
- Config (`raes.config.yaml`) correctly routes the loop to all generated sources

---

## UX Principles

- Fast to start
- Minimal required input
- Transparent output (no black box)
- Editable over perfect
- Fail fast with a clear message before any file I/O

---

## Open Questions

- How opinionated should archetypes be?
- Should the tool ask follow-up questions in a future version?
- How should examples influence generation?
- What is the right provider interface for adding AI inference to `--from-prd`?

---

## Future Extensions (Not v1)

- AI-inference-backed `--from-prd` (generates real slice backlog, extracted decisions, derived execution guidance)
- Interactive init (guided questions)
- Archetype auto-detection from PRD
- Second archetype beyond `cli-doc-generator`
- Code scaffolding
- Integration with Git
- Web interface
- Template versioning
