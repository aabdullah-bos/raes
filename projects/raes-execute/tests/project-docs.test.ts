import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('project pipeline.md only uses permitted top-level headings', () => {
  const pipeline = readFileSync(new URL('../docs/pipeline.md', import.meta.url), 'utf8');
  const headings = [...pipeline.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1]);

  assert.deepEqual(headings, ['Slice Backlog', 'Handoff Notes']);
});

test('project system.md only uses permitted top-level headings', () => {
  const system = readFileSync(new URL('../docs/system.md', import.meta.url), 'utf8');
  const headings = [...system.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1]);

  assert.deepEqual(headings, [
    'Purpose',
    'Product Invariants',
    'Drift Guards',
    'Known Contracts',
    'Unknowns',
    'Anti-Patterns',
    'Definition of Done',
  ]);
});

test('project displaced-content file has no remaining system.md destination block', () => {
  const displaced = readFileSync(new URL('../docs/b1-displaced-content.md', import.meta.url), 'utf8');

  assert.equal(displaced.includes('## Destination: docs/system.md'), false);
});
