# Command-Line Calculator System Constraints

## Runtime and Dependencies

- Target Python 3.
- Use only the Python standard library.
- Do not add a package manager, dependency lockfile, network service, or external runtime.

## Project Structure

Use this minimal implementation layout:

```text
calculator/
├── calculator.py
├── raes.config.yaml
├── docs/
│   └── ...
└── tests/
    └── test_calculator.py
```

`calculator.py` owns both the arithmetic functions and the command-line entry point. Tests may import its arithmetic functions without launching a subprocess, and command-line tests must exercise the public command through a subprocess.

## Behavioral Invariants

- `add(left, right)` returns `left + right`.
- `subtract(left, right)` returns `left - right`.
- Successful CLI execution writes exactly one result line to standard output and does not write an error.
- Invalid CLI input never prints a numeric result.
- Invalid CLI input returns a non-zero exit status and writes a useful message to standard error.
- Adding a new supported operation must not change the behavior of an existing operation.

## Interface Contract

The only supported public command is:

```text
python3 calculator.py <operation> <left> <right>
```

The accepted operation tokens are exactly `add` and `subtract`. Operands use Python's base-10 integer syntax as accepted by `int`.

## Change Constraints

- Keep implementation changes within `calculator.py` and `tests/` unless the selected slice explicitly authorizes another output.
- Do not change RAES authority documents while implementing a product slice.
- A review slice may create its explicitly requested review report but must not modify `calculator.py` or tests.
