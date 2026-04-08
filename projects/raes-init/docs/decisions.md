# Decisions Log

Append only.
Record durable decisions, not session chatter.

## Accepted Decisions
- 2026-04-08: `cli-doc-generator` is the default execution shape for `raes-init` because the product is a CLI that turns a PRD into project-specific markdown docs.
- 2026-04-08: V1 scope for `raes-init` is limited to generating RAES documentation files only; code scaffolding and broader repo setup remain out of scope.
- 2026-04-08: V1 happy-path input is intentionally narrow: one project name, one PRD file path input, and one explicit archetype selection. Inline PRD text input and optional notes are out of scope for the first happy path unless a later decision expands them.
- 2026-04-08: V1 overwrite behavior is fail-fast. If any target output doc already exists, `raes-init` must stop with an explicit error rather than overwrite or merge existing docs, to reduce accidental destruction of user work.
