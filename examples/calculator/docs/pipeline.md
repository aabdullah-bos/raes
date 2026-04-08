# Simple Calculator — Slice Pipeline

This document defines how implementation work is executed for the Simple Calculator project.

It is the authoritative execution guide for all agent sessions.

---

## Purpose
- Maintain consistency across independent sessions
- Prevent drift in UI behavior and project scope
- Keep implementation incremental and testable
- Ensure all work follows strict minimal-slice principles

---

## Invariants

### Product Invariants
- The calculator remains a basic arithmetic calculator for V1
- All core functionality must be available through on-screen controls
- The UI should feel immediate and predictable
- The user must always be able to clear the current state

### Drift Guards
- One slice per session
- Tests before implementation
- Implement minimum code required to pass
- No backend or persistence
- No scientific or history features
- Do not silently resolve unknown UX behaviors as durable rules

---

## Known Contracts
- Visible calculator display exists
- Buttons exist for digits and core operators
- User can complete a full calculation through the UI

---

## Unknowns
- Decimal support
- Operator replacement behavior
- Divide-by-zero display behavior
- Post-evaluation display rules

---

## Slice Backlog

### Milestone 1 — Basic UI Shell
- [ ] Render calculator container and display
- [ ] Render digit buttons 0–9
- [ ] Render operator buttons +, -, ×, ÷, =, C

### Milestone 2 — Basic Input Behavior
- [ ] Clicking a digit updates the display
- [ ] Clicking clear resets the display and state
- [ ] Support entry of multi-digit numbers

### Milestone 3 — Calculation Flow
- [ ] Selecting an operator stores the pending operation
- [ ] Entering second operand updates the display correctly
- [ ] Pressing equals computes the result for addition
- [ ] Extend equals to subtraction, multiplication, and division

### Milestone 4 — Edge Cases / UX Clarification
- [ ] Decide and implement operator replacement behavior
- [ ] Decide and implement divide-by-zero handling
- [ ] Decide and implement result display behavior after evaluation

---

## Session Workflow
1. Read `docs/PRD.md`, `docs/system.md`, `docs/pipeline.md`, and `docs/decisions.md`
2. Identify the first unchecked slice
3. Name the slice explicitly
4. Write failing tests
5. Implement minimal code to pass
6. Run tests and typecheck
7. Add handoff notes
8. Mark slice complete
9. Append durable decisions to `docs/decisions.md`
10. Stop

---

## Definition of Done Per Slice
A slice is complete only when:
1. The exact slice was named
2. Tests were written first
3. Minimum implementation was completed
4. Relevant tests passed
5. Relevant typecheck passed
6. No unrelated behavior was added
7. Handoff notes were updated
8. Work stopped after slice completion

---

## Handoff Notes (Append Only)