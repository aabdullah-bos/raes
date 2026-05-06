import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('project pipeline.md only uses permitted top-level headings', () => {
  const pipeline = readFileSync(new URL('../docs/pipeline.md', import.meta.url), 'utf8');
  const headings = [...pipeline.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1]);

  assert.deepEqual(headings, ['Slice Backlog', 'Handoff Notes']);
});
