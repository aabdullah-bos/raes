# Command-Line Calculator Validation

## Mandatory Automated Validation

Run from the calculator project root:

```sh
python3 -m unittest discover -s tests -v
```

This command is required for every execution slice after tests exist and for the final review slice.

## Slice-Specific Validation

Run the smoke commands named in the selected pipeline slice. Compare standard output with the exact expected result and confirm the command exits successfully.

For invalid-input acceptance criteria, use automated subprocess tests. Those tests must verify both a non-zero exit status and an explanatory standard-error message without depending on the interpreter's exact full wording.

## Review Validation

For a review slice:

- run the mandatory automated validation;
- confirm the requested review report exists and is readable;
- verify through repository inspection that the review did not change implementation behavior or tests.

## Validation Evidence

Record, for every required command:

- the exact command;
- this document or the selected slice as its source;
- its exit code;
- whether it passed, failed, or was unavailable;
- a concise output summary.
