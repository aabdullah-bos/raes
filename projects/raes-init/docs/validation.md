# raes-init — validation.md

## Testing Approach

- Prefer deterministic unit tests against `generateDocs()`, CLI argument handling, and provider loading.
- For docs-only correction slices, add the minimum repository-level validation needed to prove the authoritative artifacts exist and match the required section shape.
- Avoid brittle full-document equality checks unless the slice is explicitly about exact template output.
- Keep live network calls out of default test runs; provider behavior should be covered with mocks or stubs.

## Validation Commands

```sh
npm test
npm run typecheck
```

Run both commands from `projects/raes-init/`.

## Known Constraints

- The project uses Node's built-in test runner for `.ts` tests and a local `tsc --noEmit` typecheck.
- Validation must stay compatible with the TypeScript-on-Node runtime defined in `decisions.md`.
- Generated markdown should be validated by required headings and narrow behavioral assertions, not by broad snapshot files.
- Slices must preserve the create-or-fail write contract: if any required target file already exists, generation fails before writes.
