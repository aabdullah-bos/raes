Read these files first and treat them as authoritative:
- docs/RAES_template.md
- docs/raes-init-prd.md
- archetypes/cli-doc-generator/system.template.md
- archetypes/cli-doc-generator/pipeline.template.md

Goal:
Instantiate RAES for the `raes-init` project.

Create or update the following project-specific files under `projects/raes-init/docs/`:
- PRD.md
- system.md
- pipeline.md
- decisions.md
- prd-ux-review.md

Requirements:
- Use `docs/raes-init-prd.md` as the source of product intent
- Use the `cli-doc-generator` archetype as the default execution shape
- Adapt the archetype templates to the PRD; do not copy them blindly
- Keep the output human-readable, editable, and specific to `raes-init`
- Do not fabricate unknown details
- Explicitly surface unknowns where appropriate
- Keep the initial slice backlog small, sequential, and testable
- Explicitly define the V1 happy-path input contract in `system.md`
- Explicitly define file write behavior (create / fail / overwrite / merge) in `system.md`
- The first slice must establish the narrow happy-path end-to-end (one PRD file input → one archetype → docs generated in target path)

Rules:
- Do not implement application code
- Only generate and refine the project docs for `raes-init`
- Preserve markdown structure and keep documents well formed
- Append only durable decisions to `decisions.md`
- Stop after the docs are in place

Deliverables:
- a project-specific `system.md`
- a project-specific `pipeline.md`
- an initialized `decisions.md`
- an initialized `prd-ux-review.md`