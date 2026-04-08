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

### 2026-04-08 — Slice 1 ships as a minimal Python module with a thin CLI wrapper

- The first implementation slice uses a single Python module and standard-library argument parsing.
- Core generation behavior is exposed as a direct function so the contract can be tested without packaging work.
- Additional abstractions or packaging layers are deferred until validation needs justify them.

### 2026-04-08 — Slice 1 PRD adaptation is intentionally shallow

- `PRD.md` is copied verbatim from the source PRD in the happy path.
- The generated docs derive project identity from the target path and PRD title from the first markdown heading.
- Only a small number of PRD bullet points are lifted into generated docs in V1; deeper parsing is deferred.

### 2026-04-08 — Slice 1 initial Python implementation was exploratory and is superseded

- A minimal Python implementation was used to prove the slice-1 contract.
- This is not the intended long-term runtime or test toolchain for `raes-init`.
- Future implementation work should use TypeScript running on Node.js.

### 2026-04-08 — V1 implementation language is TypeScript

- `raes-init` V1 implementation language is TypeScript running on Node.js.
- Python is not part of the intended runtime or test toolchain for this project.

### 2026-04-08 — Slice 1 uses Node's built-in TypeScript-capable runtime path

- Slice 1 uses project-local TypeScript files executed directly by Node.js 24 rather than adding a transpilation step.
- Tests use Node's built-in test runner from `projects/raes-init/package.json`.
- Additional compiler or framework setup is deferred until a later slice requires it.
