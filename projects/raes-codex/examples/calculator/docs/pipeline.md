# Command-Line Calculator Pipeline

## Slice Backlog

- [ ] CALC-001 | execution | Implement addition and the initial CLI

  Create `calculator.py` and `tests/test_calculator.py`.

  Implement:

  - an importable `add(left, right)` function;
  - the command `python3 calculator.py add <left> <right>`;
  - standard-library argument parsing;
  - useful failures for missing, extra, unsupported, and non-integer arguments.

  Acceptance criteria:

  - `add(7, 5)` returns `12`.
  - `add(-7, 5)` returns `-2`.
  - `python3 calculator.py add 7 5` writes exactly `12` followed by a newline and exits `0`.
  - Invalid input exits non-zero, writes an explanation to standard error, and does not print a numeric result.
  - Automated tests cover the arithmetic function, CLI success, and representative invalid input.
  - Subtraction is not implemented in this slice.

  Slice-specific validation:

  - `python3 calculator.py add 7 5`
  - `python3 calculator.py add -7 5`

- [ ] CALC-002 | execution | Add subtraction

  Extend the accepted calculator without changing addition behavior.

  Implement:

  - an importable `subtract(left, right)` function;
  - the command `python3 calculator.py subtract <left> <right>`;
  - automated unit and CLI coverage for subtraction.

  Acceptance criteria:

  - `subtract(7, 5)` returns `2`.
  - `subtract(5, 7)` returns `-2`.
  - `python3 calculator.py subtract 7 5` writes exactly `2` followed by a newline and exits `0`.
  - Existing addition and invalid-input tests continue to pass.
  - No operation beyond `add` and `subtract` is introduced.

  Slice-specific validation:

  - `python3 calculator.py add 7 5`
  - `python3 calculator.py subtract 7 5`

- [ ] CALC-003 | review | Review calculator requirements and test coverage

  Review the completed calculator against `docs/prd.md`, `docs/system.md`, and the accepted execution slices.

  Required output:

  - Create `docs/calculator-review.md`.
  - Summarize the evidence inspected.
  - List findings by severity with file and behavior references.
  - State whether addition, subtraction, invalid-input handling, and required tests satisfy the documented requirements.
  - Explicitly state when no blocking findings remain.

  Constraints:

  - Do not modify `calculator.py`.
  - Do not modify files under `tests/`.
  - Do not fix findings during this review slice.

  Review validation:

  - Run the mandatory automated validation from `docs/validation.md`.
  - Confirm `docs/calculator-review.md` exists and is readable.
  - Confirm repository inspection shows no implementation or test changes.

## Handoff Notes

Begin with `CALC-001`. Execute, validate, and request explicit acceptance for only one slice per invocation.
