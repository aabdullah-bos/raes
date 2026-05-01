# RAES Init — PRD

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

### 2. Input Contract

- PRD input must be a readable file path — inline text is not supported
- Target output is one project-local `docs/` directory
- Archetype must be explicitly specified — auto-detection is not supported
- Supported archetypes: `cli-doc-generator`, `frontend-backend-ai-app`, `cli`

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

### 5. Generation Logic (string-parsing)

PRD adaptation uses section-aware string parsing:

- Title: first `# ` heading in the PRD
- Bullets: extracted from `## Core Functionality`, `## Constraints`, `## Open Questions` sections
- When a section is absent or empty, generated docs fall back to generic defaults

`system.md` and `prd-ux-review.md` generation adapts PRD content to RAES section shapes.
`pipeline.md` uses PRD-derived content for Known Contracts and Unknowns.
`execution-guidance.md` and `validation.md` are stubs regardless of initialization mode.

Archetype templates (in `archetypes/`) are reference documents for humans and brownfield
discovery. They are not consumed by the generation logic.

---

### 6. Inference Provider Interface

`raes-init --from-prd` and future commands call inference via a provider abstraction.
The provider is selected at runtime via environment variables — never via `raes.config.yaml`,
which must remain portable and committable.

**Environment contract:**

```bash
# Required
RAES_PROVIDER=anthropic | openai | local

# Required per provider
ANTHROPIC_API_KEY=...           # if RAES_PROVIDER=anthropic
OPENAI_API_KEY=...              # if RAES_PROVIDER=openai
RAES_LOCAL_ENDPOINT=http://...  # if RAES_PROVIDER=local (Ollama default: http://localhost:11434/v1)

# Optional — overrides provider default model
RAES_MODEL=...
```

**Minimum required operation:**

```typescript
complete(prompt: string): Promise<string>
```

`complete_with_tools` and `embed` are out of scope for this version.

If `RAES_PROVIDER` is absent or invalid, `raes-init --from-prd` must fail fast with a
clear error before any file I/O. The `local` provider covers Ollama and LM Studio —
both expose OpenAI-compatible APIs.

---

## Non-Goals

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
- `raes-init --from-prd` fails fast with a clear error before any file I/O if `RAES_PROVIDER` is unset or unsupported
- Each provider fails fast with a clear error if its required credential or endpoint is missing
- `complete(prompt)` is implemented and tested for all three providers (`anthropic`, `openai`, `local`)
- `RAES_MODEL` override applies when set; each provider has a documented default when it is not
- Bare greenfield mode and existing `--from-prd` string-parsing output are unaffected by provider interface addition

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

---

## Future Extensions

- AI-inference-backed `--from-prd` generation (real slice backlog, extracted decisions, derived execution guidance using the provider interface)
- Interactive init (guided questions)
- Archetype auto-detection from PRD
- Second archetype beyond `cli-doc-generator`
- Code scaffolding
- Integration with Git
- Web interface
- Template versioning
