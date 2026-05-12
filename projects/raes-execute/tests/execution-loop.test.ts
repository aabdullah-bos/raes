import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFileSync, rmSync } from 'node:fs';
import { markSliceComplete } from '../src/execution-loop.ts';
import { runExecutionLoop } from '../src/execution-loop.ts';
import type { RaesSummaryData } from '../src/output-summary.ts';
import type { Provider, ProviderHooks, ProviderProgressEvent } from '../src/provider.ts';
import type { RaesConfig } from '../src/config.ts';

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

test('markSliceComplete: returns content unchanged when slice already complete', () => {
  const content = `\n## Slice Backlog\n\n- [x] Slice 1: Already done\n`;
  const slice = { position: 1, label: 'Slice 1: Already done', complete: true };
  const result = markSliceComplete(content, slice);
  assert.equal(result, content, 'should return unchanged content for already-complete slice');
});

test('markSliceComplete: returns null when label absent entirely', () => {
  const content = `\n## Slice Backlog\n\n- [x] Slice 1: Already done\n`;
  const slice = { position: 2, label: 'Slice 2: Not in file', complete: false };
  const result = markSliceComplete(content, slice);
  assert.equal(result, null);
});

test('markSliceComplete: only replaces the first unchecked occurrence', () => {
  const content = `\n## Slice Backlog\n\n- [ ] Slice 1: Duplicate\n- [ ] Slice 1: Duplicate\n`;
  const slice = { position: 1, label: 'Slice 1: Duplicate', complete: false };
  const result = markSliceComplete(content, slice);
  assert.ok(result !== null);
  const checked = (result!.match(/- \[x\] Slice 1: Duplicate/g) ?? []).length;
  assert.equal(checked, 1, 'expected exactly one replacement');
});

const VALID_CONFIG: RaesConfig = {
  project: { name: 'test-project' },
  sources: {
    build_intent: 'docs/prd.md',
    system_constraints: 'docs/system.md',
    next_slice: { path: 'docs/pipeline.md', selection_rule: 'first_unchecked_slice' },
    durable_decisions: 'docs/decisions.md',
    execution_guidance: 'docs/execution-guidance.md',
    validation: 'docs/validation.md',
  },
  provider: { name: 'anthropic' },
};

const VALID_ARTIFACTS: Record<string, string> = {
  'docs/prd.md': '# RAES Execute\n\n## Goals\n- Goal\n',
  'docs/system.md': '# raes-execute — system.md\n\n## Product Invariants\n- Invariant\n',
  'docs/pipeline.md': '## Slice Backlog\n\n- [ ] Slice 1: Run execution loop\n',
  'docs/decisions.md': '# RAES Execute\n\n## Durable Decisions\n\n| Decision | Rationale | Date |\n|----------|-----------|------|\n',
  'docs/execution-guidance.md': '# RAES Execute: Execution Guidance\n\n## Invariants\n1. Keep boundaries.\n',
  'docs/validation.md': '# raes-execute — validation.md\n\n## Testing Approach\n- Test\n',
};

const VALID_SUMMARY: RaesSummaryData = {
  slice: {
    label: 'Slice 1: Run execution loop',
    type: 'execution',
    pipeline: { path: 'docs/pipeline.md', line: 3 },
    position: 1,
  },
  artifactsInspected: [
    { path: 'docs/prd.md', line: 1 },
    { path: 'docs/pipeline.md', line: 3 },
  ],
  repoInspection: [],
  plan: ['Add summary parsing to the execution loop.'],
  testsAddedOrUpdated: [
    { text: 'Added execution loop summary rendering coverage.', refs: [{ path: 'tests/execution-loop.test.ts', line: 1 }] },
  ],
  implementationChanges: [
    { text: 'Execution loop now renders parsed RAES summaries.', refs: [{ path: 'src/execution-loop.ts', line: 1 }] },
  ],
  findings: [
    { text: 'Summary rendering is deterministic when the tagged block is valid.' },
  ],
  validation: ['npm test'],
  gaps: ['Malformed summaries still fall back to raw output.'],
  artifactsProduced: ['Updated docs/pipeline.md.'],
  flags: ['No blocking guidance conflict found.'],
  nextRecommendedSlice: {
    label: 'Slice 2: Follow-on slice',
    path: 'docs/pipeline.md',
    line: 6,
    reason: 'It remains the next unchecked slice.',
  },
};

function makeTaggedSummaryJson(overrides: Partial<RaesSummaryData> = {}): string {
  const summary = {
    ...VALID_SUMMARY,
    ...overrides,
  };
  return [
    'Freeform prose before summary.',
    'RAES_SUMMARY_START',
    JSON.stringify(summary, null, 2),
    'RAES_SUMMARY_END',
  ].join('\n');
}

async function makeProject(pipelineContent = VALID_ARTIFACTS['docs/pipeline.md']): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'raes-execution-loop-'));
  await mkdir(join(dir, 'docs'), { recursive: true });
  for (const [path, content] of Object.entries(VALID_ARTIFACTS)) {
    await writeFile(join(dir, path), path === 'docs/pipeline.md' ? pipelineContent : content);
  }
  return dir;
}

function providerReturning(result: { output: string; error?: string; fix?: string }): Provider {
  return {
    startSession: async () => ({
      submitTurn: async (_prompt: string, hooks?: ProviderHooks) => {
        hooks?.onProgress?.({ kind: 'status', text: 'Reading artifacts' });
        hooks?.onProgress?.({ kind: 'tool', text: 'Read' });
        return result;
      },
      close: async () => {},
    }),
    submit: async (_prompt: string, hooks?: ProviderHooks) => {
      hooks?.onProgress?.({ kind: 'status', text: 'Reading artifacts' });
      hooks?.onProgress?.({ kind: 'tool', text: 'Read' });
      return result;
    },
  };
}

function providerWithProgress(progress: ProviderProgressEvent[], result: { output: string; error?: string; fix?: string }): Provider {
  return {
    startSession: async () => ({
      submitTurn: async (_prompt: string, hooks?: ProviderHooks) => {
        for (const event of progress) {
          hooks?.onProgress?.(event);
        }
        return result;
      },
      close: async () => {},
    }),
    submit: async (_prompt: string, hooks?: ProviderHooks) => {
      for (const event of progress) {
        hooks?.onProgress?.(event);
      }
      return result;
    },
  };
}

test('runExecutionLoop: prints provider output before confirmation prompt', async () => {
  const dir = await makeProject();
  try {
    const out: string[] = [];
    const result = await runExecutionLoop(
      { position: 1, label: 'Slice 1: Run execution loop', complete: false },
      VALID_CONFIG,
      dir,
      {
        out: (line) => out.push(line),
        err: () => {},
        in: async () => 'n',
      },
      {
        provider: providerReturning({ output: 'agent output line' }),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(result.exitCode, 0);
    const outputIndex = out.indexOf('agent output line');
    const promptIndex = out.indexOf('Agent output shown above. Record this slice as complete? [y/N]');
    assert.ok(outputIndex >= 0, 'expected provider output to be printed');
    assert.ok(promptIndex >= 0, 'expected confirmation prompt to be printed');
    assert.ok(outputIndex < promptIndex, 'expected provider output before confirmation prompt');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('runExecutionLoop: prints intermediate provider progress before final output', async () => {
  const dir = await makeProject();
  try {
    const out: string[] = [];
    const result = await runExecutionLoop(
      { position: 1, label: 'Slice 1: Run execution loop', complete: false },
      VALID_CONFIG,
      dir,
      {
        out: (line) => out.push(line),
        err: () => {},
        in: async () => 'n',
      },
      {
        provider: providerWithProgress(
          [
            { kind: 'status', text: 'Reading artifacts' },
            { kind: 'tool', text: 'Read' },
          ],
          { output: 'agent output line' },
        ),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(result.exitCode, 0);
    const providerStartIndex = out.indexOf('Provider:    started; waiting for progress...');
    const progressIndex = out.indexOf('[status] Reading artifacts');
    const toolIndex = out.indexOf('[tool] Read');
    const outputIndex = out.indexOf('agent output line');
    assert.ok(providerStartIndex >= 0);
    assert.ok(progressIndex > providerStartIndex, 'expected status after provider start');
    assert.ok(toolIndex > progressIndex, 'expected tool event after status event');
    assert.ok(outputIndex > toolIndex, 'expected final output after progress events');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('runExecutionLoop: renders rich structured progress before final output', async () => {
  const dir = await makeProject();
  try {
    const out: string[] = [];
    const result = await runExecutionLoop(
      { position: 1, label: 'Slice 1: Run execution loop', complete: false },
      VALID_CONFIG,
      dir,
      {
        out: (line) => out.push(line),
        err: () => {},
        in: async () => 'n',
      },
      {
        provider: providerWithProgress(
          [
            { kind: 'status', text: 'Agent turn started', phase: 'turn', eventType: 'turn/started' },
            {
              kind: 'status',
              text: 'command_execution started',
              phase: 'command',
              eventType: 'item/started',
              item: { kind: 'command_execution', command: 'npm test', status: 'inProgress' },
              command: 'npm test',
            },
            { kind: 'tool', text: 'Running npm test', phase: 'command', command: 'npm test', delta: 'PASS src/example.test.ts' },
            {
              kind: 'status',
              text: 'command_execution completed',
              phase: 'command',
              eventType: 'item/completed',
              item: { kind: 'command_execution', command: 'npm test', status: 'completed', exitCode: 0 },
              command: 'npm test',
            },
            { kind: 'status', text: 'Plan updated', phase: 'plan', plan: [{ step: 'Run tests', status: 'completed' }] },
            {
              kind: 'status',
              text: 'file_change completed',
              phase: 'diff',
              eventType: 'item/completed',
              item: { kind: 'file_change', status: 'completed', changes: [{ path: 'src/example.ts', kind: 'modified' }] },
              files: [{ path: 'src/example.ts', kind: 'modified' }],
            },
          ],
          { output: 'agent output line' },
        ),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(result.exitCode, 0);
    assert.ok(out.includes('[status] Agent turn started'));
    assert.ok(out.includes('[tool] npm test'));
    assert.ok(out.includes('  command: npm test'));
    assert.ok(out.includes('  status: completed'));
    assert.ok(out.includes('  exit: 0'));
    assert.ok(out.includes('  output: PASS src/example.test.ts'));
    assert.ok(out.includes('[plan] Run tests [completed]'));
    assert.ok(out.includes('[diff] Updated src/example.ts'));
    const finalOutputIndex = out.indexOf('agent output line');
    const diffIndex = out.indexOf('[diff] Updated src/example.ts');
    assert.ok(diffIndex >= 0 && finalOutputIndex > diffIndex, 'expected structured progress before final output');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('runExecutionLoop: coalesces repeated noisy deltas predictably', async () => {
  const dir = await makeProject();
  try {
    const out: string[] = [];
    const result = await runExecutionLoop(
      { position: 1, label: 'Slice 1: Run execution loop', complete: false },
      VALID_CONFIG,
      dir,
      {
        out: (line) => out.push(line),
        err: () => {},
        in: async () => 'n',
      },
      {
        provider: providerWithProgress(
          [
            { kind: 'tool', text: 'Streaming test output', phase: 'command', command: 'npm test', delta: 'line 1' },
            { kind: 'tool', text: 'Streaming test output', phase: 'command', command: 'npm test', delta: 'line 2' },
            { kind: 'tool', text: 'Streaming test output', phase: 'command', command: 'npm test', delta: 'line 3' },
            { kind: 'tool', text: 'Streaming test output', phase: 'command', command: 'npm test', delta: 'line 4' },
          ],
          { output: 'agent output line' },
        ),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(result.exitCode, 0);
    assert.equal(out.filter((line) => line === '[tool] npm test').length, 1);
    assert.ok(out.includes('  command: npm test'));
    assert.ok(out.includes('  output: line 1 | line 2 | line 3'));
    assert.ok(out.includes('  output: ... 1 more updates'));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('runExecutionLoop: records slice when operator confirms', async () => {
  const dir = await makeProject();
  try {
    const result = await runExecutionLoop(
      { position: 1, label: 'Slice 1: Run execution loop', complete: false },
      VALID_CONFIG,
      dir,
      { out: () => {}, err: () => {}, in: async () => 'y' },
      {
        provider: providerReturning({ output: 'agent output line' }),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(result.exitCode, 0);
    const pipeline = readFileSync(join(dir, 'docs/pipeline.md'), 'utf8');
    assert.ok(pipeline.includes('- [x] Slice 1: Run execution loop'));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('runExecutionLoop: does not write when operator declines recording', async () => {
  const dir = await makeProject();
  try {
    const out: string[] = [];
    const result = await runExecutionLoop(
      { position: 1, label: 'Slice 1: Run execution loop', complete: false },
      VALID_CONFIG,
      dir,
      { out: (line) => out.push(line), err: () => {}, in: async () => 'n' },
      {
        provider: providerReturning({ output: 'agent output line' }),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(result.exitCode, 0);
    assert.ok(out.includes('Slice not recorded. No artifacts written.'));
    const pipeline = readFileSync(join(dir, 'docs/pipeline.md'), 'utf8');
    assert.ok(pipeline.includes('- [ ] Slice 1: Run execution loop'));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('runExecutionLoop: provider error exits 2 without writing', async () => {
  const dir = await makeProject();
  try {
    const err: string[] = [];
    const result = await runExecutionLoop(
      { position: 1, label: 'Slice 1: Run execution loop', complete: false },
      VALID_CONFIG,
      dir,
      { out: () => {}, err: (line) => err.push(line), in: async () => 'y' },
      {
        provider: providerReturning({
          output: '',
          error: 'provider failed',
          fix: 'run provider login',
        }),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(result.exitCode, 2);
    assert.ok(err.includes('error: provider failed'));
    assert.ok(err.includes('fix: run provider login'));
    const pipeline = readFileSync(join(dir, 'docs/pipeline.md'), 'utf8');
    assert.ok(pipeline.includes('- [ ] Slice 1: Run execution loop'));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('runExecutionLoop: renders parsed RAES summary instead of raw output when tagged summary is valid', async () => {
  const dir = await makeProject();
  try {
    const out: string[] = [];
    const result = await runExecutionLoop(
      { position: 1, label: 'Slice 1: Run execution loop', complete: false },
      VALID_CONFIG,
      dir,
      { out: (line) => out.push(line), err: () => {}, in: async () => 'n' },
      {
        provider: providerReturning({ output: makeTaggedSummaryJson() }),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(result.exitCode, 0);
    assert.ok(out.includes('Current Slice'));
    assert.ok(out.includes('Findings'));
    assert.ok(out.includes('Next Recommended Slice'));
    assert.ok(!out.includes('RAES_SUMMARY_START'));
    assert.ok(!out.includes('RAES_SUMMARY_END'));
    assert.ok(!out.includes('Freeform prose before summary.'));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('runExecutionLoop: falls back to raw output when RAES summary is malformed', async () => {
  const dir = await makeProject();
  try {
    const out: string[] = [];
    const malformed = ['Freeform prose before summary.', 'RAES_SUMMARY_START', '{bad json}', 'RAES_SUMMARY_END'].join('\n');
    const result = await runExecutionLoop(
      { position: 1, label: 'Slice 1: Run execution loop', complete: false },
      VALID_CONFIG,
      dir,
      { out: (line) => out.push(line), err: () => {}, in: async () => 'n' },
      {
        provider: providerReturning({ output: malformed }),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(result.exitCode, 0);
    assert.ok(out.includes('Freeform prose before summary.'));
    assert.ok(out.includes('RAES_SUMMARY_START'));
    assert.ok(out.includes('{bad json}'));
    assert.ok(!out.includes('Current Slice'));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('runExecutionLoop: falls back to raw output when RAES summary is missing', async () => {
  const dir = await makeProject();
  try {
    const out: string[] = [];
    const result = await runExecutionLoop(
      { position: 1, label: 'Slice 1: Run execution loop', complete: false },
      VALID_CONFIG,
      dir,
      { out: (line) => out.push(line), err: () => {}, in: async () => 'n' },
      {
        provider: providerReturning({ output: 'plain raw output' }),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(result.exitCode, 0);
    assert.ok(out.includes('plain raw output'));
    assert.ok(!out.includes('Current Slice'));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('runExecutionLoop: confirmation prompt still appears after rendered RAES summary', async () => {
  const dir = await makeProject();
  try {
    const out: string[] = [];
    const result = await runExecutionLoop(
      { position: 1, label: 'Slice 1: Run execution loop', complete: false },
      VALID_CONFIG,
      dir,
      { out: (line) => out.push(line), err: () => {}, in: async () => 'n' },
      {
        provider: providerReturning({ output: makeTaggedSummaryJson() }),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(result.exitCode, 0);
    const nextSliceIndex = out.indexOf('Next Recommended Slice');
    const promptIndex = out.indexOf('Agent output shown above. Record this slice as complete? [y/N]');
    assert.ok(nextSliceIndex >= 0);
    assert.ok(promptIndex > nextSliceIndex);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('runExecutionLoop: warns when provider completes without any final output', async () => {
  const dir = await makeProject();
  try {
    const out: string[] = [];
    const result = await runExecutionLoop(
      { position: 1, label: 'Slice 1: Run execution loop', complete: false },
      VALID_CONFIG,
      dir,
      { out: (line) => out.push(line), err: () => {}, in: async () => 'n' },
      {
        provider: providerReturning({ output: '' }),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(result.exitCode, 0);
    assert.ok(out.includes('[warning] Agent completed without any final summary output.'));
    const warningIndex = out.indexOf('[warning] Agent completed without any final summary output.');
    const promptIndex = out.indexOf('Agent output shown above. Record this slice as complete? [y/N]');
    assert.ok(warningIndex >= 0 && promptIndex > warningIndex);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
