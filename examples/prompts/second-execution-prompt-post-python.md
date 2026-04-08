Read these files first and treat them as authoritative:
- projects/raes-init/docs/PRD.md
- projects/raes-init/docs/system.md
- projects/raes-init/docs/pipeline.md
- projects/raes-init/docs/decisions.md

Then inspect the repository and execute the next unchecked slice using strict TDD.

Rules:
- one slice only
- write failing tests first
- implement the minimum code required to pass
- use TypeScript running on Node.js as the only implementation runtime and test toolchain
- do not introduce Python or any other implementation language
- enforce the V1 happy-path contract exactly
- do not expand inputs, archetype support, or overwrite behavior
- append handoff notes to `projects/raes-init/docs/pipeline.md`
- append durable decisions to `projects/raes-init/docs/decisions.md` only if needed
- mark the slice complete
- stop after completing the slice

Important:
- if minimal TypeScript project setup is required to execute the slice, include only the smallest setup needed for this slice
- prefer direct, testable implementation over framework or packaging overhead
- do not perform or prompt for environment cleanup such as `__pycache__`
- assume runtime artifacts are ignored via `.gitignore`

Start with the first unchecked slice in the backlog.