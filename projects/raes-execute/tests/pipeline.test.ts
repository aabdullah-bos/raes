import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSlices, getPipelineStatus } from '../src/pipeline.ts';

const BACKLOG_ONLY = `
## Slice Backlog

- [x] Slice 1: First slice label
- [x] Slice 2: Second slice label
- [ ] Slice 3: Third slice label
- [ ] Slice 4: Fourth slice label
`;

const WITH_SURROUNDING_SECTIONS = `
## Purpose

Some purpose text.

## Slice Backlog

- [x] Slice 1: Do the thing
- [ ] Slice 2: Do the next thing

## Handoff Notes

- [ ] This line should NOT be parsed as a slice
`;

const ALL_COMPLETE = `
## Slice Backlog

- [x] Slice 1: First
- [x] Slice 2: Second
`;

const ALL_UNCHECKED = `
## Slice Backlog

- [ ] Slice 1: First
- [ ] Slice 2: Second
`;

const EMPTY_BACKLOG = `
## Slice Backlog

`;

const NO_BACKLOG_SECTION = `
## Purpose

Some text with no backlog.
`;

// ---------------------------------------------------------------------------
// parseSlices
// ---------------------------------------------------------------------------

test('parseSlices returns empty array for content with no Slice Backlog section', () => {
  const slices = parseSlices(NO_BACKLOG_SECTION);
  assert.deepEqual(slices, []);
});

test('parseSlices returns empty array for empty Slice Backlog section', () => {
  const slices = parseSlices(EMPTY_BACKLOG);
  assert.deepEqual(slices, []);
});

test('parseSlices returns empty array for empty string', () => {
  const slices = parseSlices('');
  assert.deepEqual(slices, []);
});

test('parseSlices extracts correct position, label, and complete for checked items', () => {
  const slices = parseSlices(BACKLOG_ONLY);
  assert.equal(slices.length, 4);
  assert.equal(slices[0].position, 1);
  assert.equal(slices[0].label, 'Slice 1: First slice label');
  assert.equal(slices[0].complete, true);
  assert.equal(slices[1].position, 2);
  assert.equal(slices[1].label, 'Slice 2: Second slice label');
  assert.equal(slices[1].complete, true);
});

test('parseSlices extracts correct position, label, and complete for unchecked items', () => {
  const slices = parseSlices(BACKLOG_ONLY);
  assert.equal(slices[2].position, 3);
  assert.equal(slices[2].label, 'Slice 3: Third slice label');
  assert.equal(slices[2].complete, false);
  assert.equal(slices[3].position, 4);
  assert.equal(slices[3].label, 'Slice 4: Fourth slice label');
  assert.equal(slices[3].complete, false);
});

test('parseSlices only collects items within the Slice Backlog section', () => {
  const slices = parseSlices(WITH_SURROUNDING_SECTIONS);
  assert.equal(slices.length, 2, 'should only find slices in Slice Backlog, not Handoff Notes');
  assert.equal(slices[0].label, 'Slice 1: Do the thing');
  assert.equal(slices[1].label, 'Slice 2: Do the next thing');
});

test('parseSlices handles all-complete backlog', () => {
  const slices = parseSlices(ALL_COMPLETE);
  assert.equal(slices.length, 2);
  assert.ok(slices.every((s) => s.complete));
});

test('parseSlices handles all-unchecked backlog', () => {
  const slices = parseSlices(ALL_UNCHECKED);
  assert.equal(slices.length, 2);
  assert.ok(slices.every((s) => !s.complete));
});

// ---------------------------------------------------------------------------
// getPipelineStatus
// ---------------------------------------------------------------------------

test('getPipelineStatus returns correct totalComplete and totalRemaining', () => {
  const status = getPipelineStatus(BACKLOG_ONLY);
  assert.equal(status.totalComplete, 2);
  assert.equal(status.totalRemaining, 2);
});

test('getPipelineStatus returns first unchecked slice as nextSlice', () => {
  const status = getPipelineStatus(BACKLOG_ONLY);
  assert.ok(status.nextSlice !== undefined);
  assert.equal(status.nextSlice!.position, 3);
  assert.equal(status.nextSlice!.label, 'Slice 3: Third slice label');
  assert.equal(status.nextSlice!.complete, false);
});

test('getPipelineStatus returns nextSlice undefined when all slices are complete', () => {
  const status = getPipelineStatus(ALL_COMPLETE);
  assert.equal(status.nextSlice, undefined);
  assert.equal(status.totalComplete, 2);
  assert.equal(status.totalRemaining, 0);
});

test('getPipelineStatus returns correct counts when all slices are unchecked', () => {
  const status = getPipelineStatus(ALL_UNCHECKED);
  assert.equal(status.totalComplete, 0);
  assert.equal(status.totalRemaining, 2);
  assert.ok(status.nextSlice !== undefined);
  assert.equal(status.nextSlice!.position, 1);
});

test('getPipelineStatus returns empty slices array for empty content', () => {
  const status = getPipelineStatus('');
  assert.deepEqual(status.slices, []);
  assert.equal(status.totalComplete, 0);
  assert.equal(status.totalRemaining, 0);
  assert.equal(status.nextSlice, undefined);
});
