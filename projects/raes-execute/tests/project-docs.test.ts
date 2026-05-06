import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

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
  ]);
});

test('project execution-guidance.md has no forbidden ## Invariants heading', () => {
  const eg = readFileSync(new URL('../docs/execution-guidance.md', import.meta.url), 'utf8');
  const headings = [...eg.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1]);
  assert.equal(headings.includes('Invariants'), false);
});

test('project execution-guidance.md has only permitted top-level headings', () => {
  const eg = readFileSync(new URL('../docs/execution-guidance.md', import.meta.url), 'utf8');
  const headings = [...eg.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1]);
  const permitted = new Set(['Workflow Rules', 'Anti-Patterns', 'Definition of Done', 'Milestone Guidance']);
  for (const h of headings) {
    assert.ok(permitted.has(h), `unexpected heading: ## ${h}`);
  }
});

test('project execution-guidance.md Workflow Rule 3 contains explicit execution loop sequence', () => {
  const eg = readFileSync(new URL('../docs/execution-guidance.md', import.meta.url), 'utf8');
  assert.ok(
    eg.includes('PLAN → SLICE → EXECUTE → TEST → EXPLAIN → FLAG → REVIEW → RECORD'),
    'Execution loop sequence not found in execution-guidance.md',
  );
});

test('project execution-guidance.md Workflow Rule 4 contains explicit review loop sequence', () => {
  const eg = readFileSync(new URL('../docs/execution-guidance.md', import.meta.url), 'utf8');
  assert.ok(
    eg.includes('PLAN → SLICE → INSPECT → SYNTHESIZE → FLAG → REVIEW → RECORD'),
    'Review loop sequence not found in execution-guidance.md',
  );
});

test('project execution-guidance.md Milestone 1 does not list CLI library alternatives', () => {
  const eg = readFileSync(new URL('../docs/execution-guidance.md', import.meta.url), 'utf8');
  assert.equal(eg.includes('Commander.js'), false);
  assert.equal(eg.includes('Click for Python'), false);
  assert.equal(eg.includes('Cobra for Go'), false);
});

test('project execution-guidance.md Milestone 1 performance target is 200ms', () => {
  const eg = readFileSync(new URL('../docs/execution-guidance.md', import.meta.url), 'utf8');
  assert.equal(eg.includes('<100ms'), false);
  assert.ok(eg.includes('200ms'), '200ms performance target not found in execution-guidance.md');
});

test('project b1-displaced-content.md staging file has been deleted', () => {
  const url = new URL('../docs/b1-displaced-content.md', import.meta.url);
  assert.equal(existsSync(url), false, 'b1-displaced-content.md should have been deleted by Slice B3');
});
