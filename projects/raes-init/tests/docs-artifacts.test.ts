import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const REQUIRED_HEADINGS: Record<string, string[]> = {
  'execution-guidance.md': [
    '# raes-init',
    '## Invariants',
    '## Workflow Rules',
    '## Anti-Patterns',
    '## Definition of Done',
    '## Milestone Guidance'
  ],
  'validation.md': [
    '# raes-init',
    '## Testing Approach',
    '## Validation Commands',
    '## Known Constraints'
  ]
};

for (const [fileName, headings] of Object.entries(REQUIRED_HEADINGS)) {
  test(`${fileName} exists with required headings`, async () => {
    const text = await readFile(new URL(`../docs/${fileName}`, import.meta.url), 'utf8');

    for (const heading of headings) {
      assert.match(text, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });
}
