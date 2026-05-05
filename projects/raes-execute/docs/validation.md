# raes-execute — validation.md

## Testing Approach

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