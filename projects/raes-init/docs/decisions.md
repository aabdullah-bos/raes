# raes-init — decisions.md

## Durable Decisions

### 2026-04-08 — V1 uses a narrow file-based happy path

- The initial supported input mode is one readable PRD markdown file path.
- The initial supported output target is one project-local `docs/` directory.
- Inline PRD text is not part of the first implementation slice.

### 2026-04-08 — `cli-doc-generator` is the default V1 execution shape

- The initial generation flow is based on the `cli-doc-generator` archetype.
- The archetype is adapted to the project PRD rather than copied verbatim.

### 2026-04-08 — V1 file writes are create-or-fail

- The generator may create the target `docs/` directory if it does not exist.
- The generator must fail before writing if any required target output file already exists.
- Overwrite and merge behavior are out of scope for V1.
