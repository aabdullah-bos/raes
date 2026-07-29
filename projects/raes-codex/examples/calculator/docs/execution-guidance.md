# Command-Line Calculator Execution Guidance

## Workflow

- Execute exactly the first unchecked slice selected by deterministic preflight.
- Read all configured RAES artifacts and the complete selected slice before changing files.
- Capture the repository baseline before implementation or review work.
- Keep the pipeline unchanged until the user explicitly accepts a validated result.
- Stop after acceptance, rejection, failed validation, or a blocked result.

## Execution Slices

- Treat the selected acceptance criteria as the complete implementation boundary.
- Prefer a test-first sequence: add a failing focused test, implement the smallest behavior that passes it, then run the complete required validation.
- Keep code simple and readable for a teaching example.
- Preserve behavior delivered by earlier accepted slices.
- Do not implement later operations or speculative extensibility.

## Review Slices

- Inspect the implementation, automated tests, validation output, and product requirements.
- Create only the review artifact explicitly requested by the selected slice.
- Record findings with severity, evidence, and a concrete recommendation.
- Do not modify implementation behavior or tests during a review slice.

## Validation and Reporting

- Run every validation command named by the selected slice.
- Run every mandatory command in `docs/validation.md`.
- Report failed or unavailable commands without converting them to passes.
- Inspect the final diff and distinguish new work from pre-existing repository changes.
- Request acceptance only after reporting a validated result.
