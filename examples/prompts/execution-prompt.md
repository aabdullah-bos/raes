Read:
- projects/raes-init/docs/PRD.md
- projects/raes-init/docs/system.md
- projects/raes-init/docs/pipeline.md
- projects/raes-init/docs/decisions.md

Then inspect the repository and execute the next unchecked slice using strict TDD.

Rules:
- one slice only
- write failing tests first
- implement minimum code to pass
- enforce the V1 happy-path contract exactly
- do not expand inputs or overwrite behavior
- append handoff notes to pipeline.md
- append durable decisions to decisions.md
- mark the slice complete
- stop after completing the slice