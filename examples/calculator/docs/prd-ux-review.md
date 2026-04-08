# PRD UX Review

## Feature: Number Entry
Ambiguities:
- Can users enter multiple leading zeros?
- Should decimal input be supported in V1?

Risks:
- Input rules may feel inconsistent if not defined

Proposed Intent:
- Entry should feel immediate and predictable

Open Questions:
- Should decimals be included in V1?

## Feature: Operator Input
Ambiguities:
- What happens if the user presses two operators in a row?
- Can the operator be changed before evaluation?

Risks:
- Confusing state transitions
- Unexpected display behavior

Proposed Intent:
- Operator selection should be visible and easy to correct

Open Questions:
- Should a second operator replace the first?

## Feature: Result Display
Ambiguities:
- Should the result replace the expression?
- Should the expression remain visible after pressing equals?

Risks:
- User may lose context after evaluation

Proposed Intent:
- Display should make it clear what was entered and what the result is