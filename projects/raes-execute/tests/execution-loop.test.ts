import test from 'node:test';
import assert from 'node:assert/strict';
import { markSliceComplete } from '../src/execution-loop.ts';

const PIPELINE_TWO_SLICES = `
## Slice Backlog

- [x] Slice 1: First completed slice
- [ ] Slice 2: Implement the next feature

## Handoff Notes
`;

test('markSliceComplete: marks first unchecked slice as complete', () => {
  const slice = { position: 2, label: 'Slice 2: Implement the next feature', complete: false };
  const result = markSliceComplete(PIPELINE_TWO_SLICES, slice);
  assert.ok(result !== null, 'expected non-null result');
  assert.ok(result!.includes('- [x] Slice 2: Implement the next feature'), 'expected slice marked as complete');
});

test('markSliceComplete: leaves already-complete slices unchanged', () => {
  const slice = { position: 2, label: 'Slice 2: Implement the next feature', complete: false };
  const result = markSliceComplete(PIPELINE_TWO_SLICES, slice);
  assert.ok(result !== null);
  assert.ok(result!.includes('- [x] Slice 1: First completed slice'), 'should preserve already-complete slice');
});

test('markSliceComplete: leaves content outside backlog unchanged', () => {
  const slice = { position: 2, label: 'Slice 2: Implement the next feature', complete: false };
  const result = markSliceComplete(PIPELINE_TWO_SLICES, slice);
  assert.ok(result !== null);
  assert.ok(result!.includes('## Handoff Notes'), 'expected non-backlog sections preserved');
});

test('markSliceComplete: returns null when label not found in content', () => {
  const slice = { position: 3, label: 'Slice 3: Not present', complete: false };
  const result = markSliceComplete(PIPELINE_TWO_SLICES, slice);
  assert.equal(result, null, 'expected null when label is not found');
});

test('markSliceComplete: does not match a checked slice with the same label', () => {
  const content = `\n## Slice Backlog\n\n- [x] Slice 1: Already done\n`;
  const slice = { position: 1, label: 'Slice 1: Already done', complete: true };
  const result = markSliceComplete(content, slice);
  assert.equal(result, null, 'should not match a checked slice');
});

test('markSliceComplete: only replaces the first unchecked occurrence', () => {
  const content = `\n## Slice Backlog\n\n- [ ] Slice 1: Duplicate\n- [ ] Slice 1: Duplicate\n`;
  const slice = { position: 1, label: 'Slice 1: Duplicate', complete: false };
  const result = markSliceComplete(content, slice);
  assert.ok(result !== null);
  const checked = (result!.match(/- \[x\] Slice 1: Duplicate/g) ?? []).length;
  assert.equal(checked, 1, 'expected exactly one replacement');
});
