import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFileSync, rmSync } from 'node:fs';
import { runReviewLoop } from '../src/review-loop.ts';
import type { Provider, ProviderHooks, ProviderProgressEvent } from '../src/provider.ts';
import type { RaesConfig } from '../src/config.ts';

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
  'docs/pipeline.md': '## Slice Backlog\n\n- [ ] Slice 1: Review the execution loop\n',
  'docs/decisions.md': '# RAES Execute\n\n## Durable Decisions\n\n| Decision | Rationale | Date |\n|----------|-----------|------|\n',
  'docs/execution-guidance.md': '# RAES Execute: Execution Guidance\n\n## Invariants\n1. Keep boundaries.\n',
  'docs/validation.md': '# raes-execute — validation.md\n\n## Testing Approach\n- Test\n',
};

async function makeProject(pipelineContent = VALID_ARTIFACTS['docs/pipeline.md']): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'raes-review-loop-'));
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
        hooks?.onProgress?.({ kind: 'status', text: 'Reviewing artifacts' });
        hooks?.onProgress?.({ kind: 'tool', text: 'Read' });
        return result;
      },
      close: async () => {},
    }),
    submit: async (_prompt: string, hooks?: ProviderHooks) => {
      hooks?.onProgress?.({ kind: 'status', text: 'Reviewing artifacts' });
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

test('runReviewLoop: prints provider output before confirmation prompt', async () => {
  const dir = await makeProject();
  try {
    const out: string[] = [];
    const result = await runReviewLoop(
      { position: 1, label: 'Slice 1: Review the execution loop', complete: false },
      VALID_CONFIG,
      dir,
      {
        out: (line) => out.push(line),
        err: () => {},
        in: async () => 'n',
      },
      {
        provider: providerReturning({ output: 'review output line' }),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(result.exitCode, 0);
    const outputIndex = out.indexOf('review output line');
    const promptIndex = out.indexOf('Agent output shown above. Record this slice as complete? [y/N]');
    assert.ok(outputIndex >= 0, 'expected provider output to be printed');
    assert.ok(promptIndex >= 0, 'expected confirmation prompt to be printed');
    assert.ok(outputIndex < promptIndex, 'expected provider output before confirmation prompt');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('runReviewLoop: prints intermediate provider progress before final output', async () => {
  const dir = await makeProject();
  try {
    const out: string[] = [];
    const result = await runReviewLoop(
      { position: 1, label: 'Slice 1: Review the execution loop', complete: false },
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
            { kind: 'status', text: 'Reviewing artifacts' },
            { kind: 'tool', text: 'Read' },
          ],
          { output: 'review output line' },
        ),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(result.exitCode, 0);
    const providerStartIndex = out.indexOf('Provider:    started; waiting for progress...');
    const progressIndex = out.indexOf('[status] Reviewing artifacts');
    const outputIndex = out.indexOf('review output line');
    assert.ok(providerStartIndex >= 0);
    assert.ok(progressIndex > providerStartIndex, 'expected status after provider start');
    assert.ok(!out.includes('[tool] Read'), 'expected non-command tool events to be suppressed in progress mode');
    assert.ok(outputIndex > progressIndex, 'expected final output after progress events');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('runReviewLoop: renders rich structured progress before final output', async () => {
  const dir = await makeProject();
  try {
    const out: string[] = [];
    const result = await runReviewLoop(
      { position: 1, label: 'Slice 1: Review the execution loop', complete: false },
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
            { kind: 'message', text: 'Comparing current state to build intent', phase: 'message' },
            {
              kind: 'status',
              text: 'command_execution completed',
              phase: 'command',
              eventType: 'item/completed',
              item: { kind: 'command_execution', command: 'git diff --stat', status: 'completed', exitCode: 0 },
              command: 'git diff --stat',
            },
            { kind: 'status', text: 'Plan updated', phase: 'plan', plan: [{ step: 'Inspect pipeline', status: 'completed' }] },
            {
              kind: 'status',
              text: 'file_change completed',
              phase: 'diff',
              eventType: 'item/completed',
              item: { kind: 'file_change', status: 'completed', changes: [{ path: 'docs/pipeline.md', kind: 'modified' }] },
              files: [{ path: 'docs/pipeline.md', kind: 'modified' }],
            },
          ],
          { output: 'review output line' },
        ),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(result.exitCode, 0);
    assert.ok(out.includes('[status] Agent turn started'));
    assert.ok(out.includes('[message] Comparing current state to build intent'));
    assert.ok(out.includes('[status] Reviewing repository status'));
    assert.ok(out.includes('[plan] Inspect pipeline [completed]'));
    assert.ok(out.includes('[diff] Updated docs/pipeline.md'));
    const finalOutputIndex = out.indexOf('review output line');
    const diffIndex = out.indexOf('[diff] Updated docs/pipeline.md');
    assert.ok(diffIndex >= 0 && finalOutputIndex > diffIndex, 'expected structured progress before final output');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('runReviewLoop: records slice when operator confirms', async () => {
  const dir = await makeProject();
  try {
    const result = await runReviewLoop(
      { position: 1, label: 'Slice 1: Review the execution loop', complete: false },
      VALID_CONFIG,
      dir,
      { out: () => {}, err: () => {}, in: async () => 'y' },
      {
        provider: providerReturning({ output: 'review output line' }),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(result.exitCode, 0);
    const pipeline = readFileSync(join(dir, 'docs/pipeline.md'), 'utf8');
    assert.ok(pipeline.includes('- [x] Slice 1: Review the execution loop'));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('runReviewLoop: does not write when operator declines recording', async () => {
  const dir = await makeProject();
  try {
    const out: string[] = [];
    const result = await runReviewLoop(
      { position: 1, label: 'Slice 1: Review the execution loop', complete: false },
      VALID_CONFIG,
      dir,
      { out: (line) => out.push(line), err: () => {}, in: async () => 'n' },
      {
        provider: providerReturning({ output: 'review output line' }),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(result.exitCode, 0);
    assert.ok(out.includes('Slice not recorded. No artifacts written.'));
    const pipeline = readFileSync(join(dir, 'docs/pipeline.md'), 'utf8');
    assert.ok(pipeline.includes('- [ ] Slice 1: Review the execution loop'));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('runReviewLoop: provider error exits 2 without writing', async () => {
  const dir = await makeProject();
  try {
    const err: string[] = [];
    const result = await runReviewLoop(
      { position: 1, label: 'Slice 1: Review the execution loop', complete: false },
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
    assert.ok(pipeline.includes('- [ ] Slice 1: Review the execution loop'));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('runReviewLoop: missing provider binary exits 2 without writing', async () => {
  const dir = await makeProject();
  try {
    const err: string[] = [];
    const result = await runReviewLoop(
      { position: 1, label: 'Slice 1: Review the execution loop', complete: false },
      VALID_CONFIG,
      dir,
      { out: () => {}, err: (line) => err.push(line), in: async () => 'y' },
      {
        provider: providerReturning({
          output: '',
          error: 'claude binary missing: spawn claude ENOENT',
          fix: 'Install Claude Code or make `claude` available on PATH, then retry.',
        }),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(result.exitCode, 2);
    assert.ok(err.includes('error: claude binary missing: spawn claude ENOENT'));
    assert.ok(err.includes('fix: Install Claude Code or make `claude` available on PATH, then retry.'));
    const pipeline = readFileSync(join(dir, 'docs/pipeline.md'), 'utf8');
    assert.ok(pipeline.includes('- [ ] Slice 1: Review the execution loop'));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('runReviewLoop: warns when provider completes without any final output', async () => {
  const dir = await makeProject();
  try {
    const out: string[] = [];
    const result = await runReviewLoop(
      { position: 1, label: 'Slice 1: Review the execution loop', complete: false },
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
