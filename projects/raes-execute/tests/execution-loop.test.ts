import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFileSync, rmSync } from 'node:fs';
import { markSliceComplete } from '../src/execution-loop.ts';
import { runExecutionLoop } from '../src/execution-loop.ts';
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
    submit: async (_prompt: string, hooks?: ProviderHooks) => {
      hooks?.onProgress?.({ kind: 'status', text: 'Reading artifacts' });
      hooks?.onProgress?.({ kind: 'tool', text: 'Read' });
      return result;
    },
  };
}

function providerWithProgress(progress: ProviderProgressEvent[], result: { output: string; error?: string; fix?: string }): Provider {
  return {
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
    const progressIndex = out.indexOf('[agent] Reading artifacts');
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
