import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractRaesSummaryBlock,
  parseRaesSummary,
  renderRaesSummary,
  type RaesSummaryData,
} from '../src/output-summary.ts';

const VALID_SUMMARY: RaesSummaryData = {
  slice: {
    label: 'Slice 13o: Review operator observability',
    type: 'review',
    pipeline: { path: 'docs/pipeline.md', line: 496 },
    position: '13o',
  },
  artifactsInspected: [
    { path: 'docs/raes.config.yaml', line: 1 },
    { path: 'docs/prd.md', line: 1 },
    { path: 'docs/pipeline.md', line: 496 },
  ],
  repoInspection: [],
  plan: [],
  testsAddedOrUpdated: [],
  implementationChanges: [],
  findings: [
    {
      text: 'App-server integration improves operator observability.',
      refs: [{ path: 'src/provider.ts', line: 248 }],
    },
  ],
  validation: ['npm test', 'npm run typecheck'],
  gaps: ['The active OpenAI transport is not visible in loop output.'],
  artifactsProduced: ['Updated pipeline.md to mark Slice 13o complete.'],
  flags: ['No blocking guidance conflict found.'],
  nextRecommendedSlice: {
    label: 'Slice 13g-1: Handle missing binary path',
    path: 'docs/pipeline.md',
    line: 508,
    reason: 'Missing-binary handling is still an unaddressed hard failure path.',
  },
};

function makeTaggedSummary(summary: unknown = VALID_SUMMARY, prelude = 'Freeform prose before summary.', trailing = ''): string {
  return [
    prelude,
    'RAES_SUMMARY_START',
    JSON.stringify(summary, null, 2),
    'RAES_SUMMARY_END',
    trailing,
  ].join('\n');
}

test('extractRaesSummaryBlock: returns tagged JSON block with surrounding prose preserved', () => {
  const output = makeTaggedSummary(VALID_SUMMARY, 'Prelude', 'Trailing note');
  const result = extractRaesSummaryBlock(output);
  assert.ok(result.json?.includes('"slice"'));
  assert.equal(result.preludeText.trim(), 'Prelude');
  assert.equal(result.trailingText.trim(), 'Trailing note');
});

test('extractRaesSummaryBlock: returns null json when no tagged block exists', () => {
  const result = extractRaesSummaryBlock('plain output only');
  assert.equal(result.json, null);
  assert.equal(result.preludeText, 'plain output only');
  assert.equal(result.trailingText, '');
});

test('extractRaesSummaryBlock: returns null json when multiple tagged blocks exist', () => {
  const output = [
    makeTaggedSummary(VALID_SUMMARY, 'one'),
    makeTaggedSummary(VALID_SUMMARY, 'two'),
  ].join('\n');
  const result = extractRaesSummaryBlock(output);
  assert.equal(result.json, null);
});

test('parseRaesSummary: returns parsed normalized summary for valid tagged JSON', () => {
  const result = parseRaesSummary(makeTaggedSummary());
  assert.ok(result);
  assert.equal(result.summary.slice.label, VALID_SUMMARY.slice.label);
  assert.equal(result.summary.findings[0]?.text, VALID_SUMMARY.findings[0]?.text);
});

test('parseRaesSummary: returns null for malformed JSON', () => {
  const output = ['RAES_SUMMARY_START', '{not json}', 'RAES_SUMMARY_END'].join('\n');
  assert.equal(parseRaesSummary(output), null);
});

test('parseRaesSummary: returns null when required slice fields are missing', () => {
  const summary = { ...VALID_SUMMARY, slice: { type: 'review', pipeline: { path: 'docs/pipeline.md' } } };
  assert.equal(parseRaesSummary(makeTaggedSummary(summary)), null);
});

test('parseRaesSummary: returns null when findings is missing or empty', () => {
  assert.equal(parseRaesSummary(makeTaggedSummary({ ...VALID_SUMMARY, findings: [] })), null);
  const { findings: _findings, ...missingFindings } = VALID_SUMMARY;
  assert.equal(parseRaesSummary(makeTaggedSummary(missingFindings)), null);
});

test('parseRaesSummary: returns null when flags is missing', () => {
  const { flags: _flags, ...missingFlags } = VALID_SUMMARY;
  assert.equal(parseRaesSummary(makeTaggedSummary(missingFlags)), null);
});

test('parseRaesSummary: returns null when nextRecommendedSlice is missing required fields', () => {
  assert.equal(
    parseRaesSummary(makeTaggedSummary({ ...VALID_SUMMARY, nextRecommendedSlice: { label: 'Slice 13g-1' } })),
    null,
  );
});

test('parseRaesSummary: defaults optional arrays to empty arrays', () => {
  const summary = {
    slice: VALID_SUMMARY.slice,
    findings: VALID_SUMMARY.findings,
    flags: VALID_SUMMARY.flags,
    nextRecommendedSlice: VALID_SUMMARY.nextRecommendedSlice,
  };
  const result = parseRaesSummary(makeTaggedSummary(summary));
  assert.ok(result);
  assert.deepEqual(result.summary.artifactsInspected, []);
  assert.deepEqual(result.summary.repoInspection, []);
  assert.deepEqual(result.summary.plan, []);
  assert.deepEqual(result.summary.testsAddedOrUpdated, []);
  assert.deepEqual(result.summary.implementationChanges, []);
  assert.deepEqual(result.summary.validation, []);
  assert.deepEqual(result.summary.gaps, []);
  assert.deepEqual(result.summary.artifactsProduced, []);
});

test('renderRaesSummary: renders stable section order for populated summary', () => {
  const lines = renderRaesSummary(VALID_SUMMARY);
  const sectionOrder = [
    'Current Slice',
    'Artifacts Inspected',
    'Findings',
    'Validation',
    'Gaps (Explicit)',
    'Output Artifact(s) Produced',
    'Flags',
    'Next Recommended Slice',
  ];
  let previousIndex = -1;
  for (const heading of sectionOrder) {
    const index = lines.indexOf(heading);
    assert.ok(index > previousIndex, `expected ${heading} after previous section`);
    previousIndex = index;
  }
});

test('renderRaesSummary: omits empty optional sections', () => {
  const lines = renderRaesSummary({
    ...VALID_SUMMARY,
    artifactsInspected: [],
    repoInspection: [],
    plan: [],
    testsAddedOrUpdated: [],
    implementationChanges: [],
    validation: [],
    gaps: [],
    artifactsProduced: [],
  });
  assert.ok(!lines.includes('Artifacts Inspected'));
  assert.ok(!lines.includes('Repo Inspection'));
  assert.ok(!lines.includes('Plan'));
  assert.ok(!lines.includes('Validation'));
});

test('renderRaesSummary: includes path and line references when present', () => {
  const lines = renderRaesSummary(VALID_SUMMARY);
  assert.ok(lines.includes('docs/raes.config.yaml (line 1)'));
  assert.ok(lines.includes('App-server integration improves operator observability. [src/provider.ts (line 248)]'));
  assert.ok(lines.includes('Slice 13g-1: Handle missing binary path in docs/pipeline.md (line 508)'));
});
