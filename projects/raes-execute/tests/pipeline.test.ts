import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSlices, getPipelineStatus, formatSliceList, formatNextSlice, determineLoopType } from '../src/pipeline.ts';

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

// ---------------------------------------------------------------------------
// formatSliceList
// ---------------------------------------------------------------------------

test('formatSliceList returns empty array for empty slices', () => {
  const lines = formatSliceList([]);
  assert.deepEqual(lines, []);
});

test('formatSliceList returns one line per slice', () => {
  const slices = parseSlices(BACKLOG_ONLY);
  const lines = formatSliceList(slices);
  assert.equal(lines.length, 4);
});

test('formatSliceList uses ✓ for complete slices', () => {
  const slices = parseSlices(BACKLOG_ONLY);
  const lines = formatSliceList(slices);
  assert.ok(lines[0].includes('✓'), 'complete slice should show ✓');
  assert.ok(lines[1].includes('✓'), 'second complete slice should show ✓');
});

test('formatSliceList uses ○ for pending slices', () => {
  const slices = parseSlices(BACKLOG_ONLY);
  const lines = formatSliceList(slices);
  assert.ok(lines[2].includes('○'), 'first pending slice should show ○');
  assert.ok(lines[3].includes('○'), 'second pending slice should show ○');
});

test('formatSliceList includes position number in each line', () => {
  const slices = parseSlices(BACKLOG_ONLY);
  const lines = formatSliceList(slices);
  assert.ok(lines[0].trimStart().startsWith('1'), 'first line should start with position 1');
  assert.ok(lines[3].trimStart().startsWith('4'), 'fourth line should start with position 4');
});

test('formatSliceList includes slice label in each line', () => {
  const slices = parseSlices(BACKLOG_ONLY);
  const lines = formatSliceList(slices);
  assert.ok(lines[0].includes('First slice label'), 'first line should include label');
  assert.ok(lines[2].includes('Third slice label'), 'third line should include label');
});

// ---------------------------------------------------------------------------
// formatNextSlice
// ---------------------------------------------------------------------------

test('formatNextSlice returns non-empty lines for a pending slice', () => {
  const slice = { position: 3, label: 'Slice 3: Do something', complete: false };
  const lines = formatNextSlice(slice);
  assert.ok(lines.length > 0);
});

test('formatNextSlice includes position number in output', () => {
  const slice = { position: 7, label: 'Slice 7: Test', complete: false };
  const lines = formatNextSlice(slice);
  assert.ok(lines.some((l) => l.includes('7')), 'should include position number');
});

test('formatNextSlice includes "Position" label', () => {
  const slice = { position: 1, label: 'Slice 1: Test', complete: false };
  const lines = formatNextSlice(slice);
  assert.ok(lines.some((l) => l.toLowerCase().includes('position')), 'should have Position label');
});

test('formatNextSlice shows "pending" status for unchecked slice', () => {
  const slice = { position: 3, label: 'Slice 3: Do something', complete: false };
  const lines = formatNextSlice(slice);
  assert.ok(lines.some((l) => l.includes('pending')), 'should show pending status');
});

test('formatNextSlice shows "complete" status for checked slice', () => {
  const slice = { position: 1, label: 'Slice 1: Done', complete: true };
  const lines = formatNextSlice(slice);
  assert.ok(lines.some((l) => l.includes('complete')), 'should show complete status');
});

test('formatNextSlice includes "Status" label', () => {
  const slice = { position: 1, label: 'Slice 1: Test', complete: false };
  const lines = formatNextSlice(slice);
  assert.ok(lines.some((l) => l.toLowerCase().includes('status')), 'should have Status label');
});

test('formatNextSlice includes slice label text', () => {
  const slice = { position: 3, label: 'Slice 3: Do something specific', complete: false };
  const lines = formatNextSlice(slice);
  assert.ok(lines.some((l) => l.includes('Slice 3: Do something specific')), 'should include label text');
});

test('formatNextSlice includes "Label" field', () => {
  const slice = { position: 1, label: 'Slice 1: Test', complete: false };
  const lines = formatNextSlice(slice);
  assert.ok(lines.some((l) => l.toLowerCase().startsWith('label')), 'should have Label field');
});

// ---------------------------------------------------------------------------
// determineLoopType
// ---------------------------------------------------------------------------

test('determineLoopType returns "execution" for a standard implementation slice', () => {
  const slice = { position: 10, label: 'Slice 10: implement --execute-next-slice skeleton', complete: false };
  assert.equal(determineLoopType(slice), 'execution');
});

test('determineLoopType returns "review" when label contains lowercase "review"', () => {
  const slice = { position: 12, label: 'Slice 12: review decisions and promote constraints', complete: false };
  assert.equal(determineLoopType(slice), 'review');
});

test('determineLoopType returns "review" when label contains capitalized "Review"', () => {
  const slice = { position: 12, label: 'Slice 12: Implement Review Loop for --execute-next-slice', complete: false };
  assert.equal(determineLoopType(slice), 'review');
});

test('determineLoopType does not match "preview" as a review slice', () => {
  const slice = { position: 5, label: 'Slice 5: preview and inspect current state', complete: false };
  assert.equal(determineLoopType(slice), 'execution');
});

test('determineLoopType returns "review" for a slice whose label is exactly the word "review"', () => {
  const slice = { position: 1, label: 'review', complete: false };
  assert.equal(determineLoopType(slice), 'review');
});

test('formatSliceList pads position column when max position is multi-digit', () => {
  const tenSlices = Array.from({ length: 10 }, (_, i) => ({
    position: i + 1,
    label: `Slice ${i + 1}: label`,
    complete: false,
  }));
  const lines = formatSliceList(tenSlices);
  assert.ok(lines[0].startsWith(' 1'), 'single-digit position should be right-padded when max is 2 digits');
  assert.ok(lines[9].startsWith('10'), 'double-digit position should not be padded');
});
