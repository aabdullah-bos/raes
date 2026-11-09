# Command-Line Calculator Durable Decisions

## Accepted Decisions

### CALC-D001 — Use Python and the standard library

The calculator uses Python 3 with no third-party dependencies. This keeps setup and validation deterministic for the Stage 1 executor example.

### CALC-D002 — Keep the product in one executable module

Arithmetic functions and CLI argument handling live in `calculator.py`. This is appropriate for the deliberately small scope and allows tests to import the functions directly.

### CALC-D003 — Support integers only

Operands are base-10 integers. Floating-point arithmetic and expression parsing are outside the product boundary.

### CALC-D004 — Use explicit operation tokens

The CLI uses `add` and `subtract` rather than mathematical symbols. Exact tokens make routing and error behavior straightforward to test.

### CALC-D005 — Use unittest for automated validation

Tests use the standard-library `unittest` framework and live under `tests/`.

## Decision Rules

- Do not reverse an accepted decision during slice execution without explicit user direction and an update to durable authority.
- If a selected slice appears to require a conflicting decision, stop and report the conflict instead of broadening the product.
