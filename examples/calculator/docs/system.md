# System Definition

## Product Invariants
- The calculator remains a simple browser-based calculator for basic arithmetic only — protects V1 scope
- The UI must support click/tap interaction for all core actions — preserves usability without requiring keyboard support
- The calculator should feel immediate and predictable — preserves experience intent
- The user must always be able to clear or reset the calculator state — protects recoverability in the interface

## Drift Guards
- Implement the minimum code required to satisfy the current slice — prevents scope creep
- One slice per session — prevents blended work and hidden drift
- Tests must be written or updated before implementation — preserves execution discipline
- Do not introduce backend services or persistence — prevents architecture drift
- Do not add scientific or history features unless explicitly added to the PRD — prevents feature creep

## Contracts
- The calculator has a visible display area that reflects current input and/or result — medium confidence
- The UI exposes buttons for digits 0–9, +, -, ×, ÷, =, and clear — high confidence
- Basic arithmetic must be executable entirely from on-screen controls — high confidence

## Unknowns
- Whether decimals are included in V1
- Whether operator replacement is allowed before evaluation
- How divide-by-zero should be shown in the UI
- Whether result display replaces or coexists with prior expression

## Anti-Patterns
- Do not silently add features to “round out” the calculator
- Do not over-engineer calculator state before basic interactions work
- Do not infer undefined UX behaviors as permanent patterns
- Do not implement multiple interaction behaviors in a single slice

## Definition of Done
A slice is complete only if:
1. The slice was named explicitly
2. Failing tests were written or updated first
3. Minimum implementation was completed
4. Relevant tests passed
5. Typecheck passed if applicable
6. No unrelated features were added
7. Pipeline notes were updated
8. Work stopped after the slice completed