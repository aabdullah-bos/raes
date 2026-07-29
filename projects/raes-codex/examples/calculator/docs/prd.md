# Command-Line Calculator Product Requirements

## Product Goal

Build a small command-line calculator that performs integer addition and subtraction. The project is intentionally compact so it can demonstrate one-slice-at-a-time RAES execution, validation, review, and explicit acceptance.

## Users

The user is a developer or terminal user who wants a deterministic arithmetic result from a local command.

## Functional Requirements

The calculator must:

- run with Python 3 from the project root;
- accept an operation, a left operand, and a right operand;
- support the operations `add` and `subtract`;
- accept positive, negative, and zero integer operands;
- print only the resulting integer followed by a newline on successful execution;
- return exit status `0` on success;
- reject an unsupported operation, a missing operand, an extra argument, or a non-integer operand;
- explain invalid input on standard error and return a non-zero exit status.

The supported command shape is:

```text
python3 calculator.py <add|subtract> <left> <right>
```

Examples:

```text
python3 calculator.py add 7 5
12

python3 calculator.py subtract 7 5
2
```

## Quality Requirements

- Arithmetic behavior must be covered by automated tests.
- Command-line success and failure behavior must be covered by automated tests.
- The implementation must use only the Python standard library.
- Behavior must be deterministic and must not depend on network access, environment-specific services, or persistent state.

## Out of Scope

- Multiplication, division, exponentiation, or expression parsing
- Floating-point or decimal operands
- Interactive prompts or a REPL
- A graphical or web interface
- Calculation history or persistence
- Packaging or publication to an external registry

## Product Acceptance

The product is complete when addition and subtraction meet the functional requirements, all required validation passes, and the final review records no unresolved blocking finding.
