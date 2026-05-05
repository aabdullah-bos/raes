import test from 'node:test';
import assert from 'node:assert/strict';
import { ClaudeCodeProvider } from '../src/provider.ts';
import type { RaesConfig } from '../src/config.ts';
import type { SpawnFn } from '../src/provider.ts';

function makeConfig(writeAccess?: boolean): RaesConfig {
  return {
    project: { name: 'test' },
    sources: {
      build_intent: 'docs/prd.md',
      system_constraints: 'docs/system.md',
      next_slice: { path: 'docs/pipeline.md', selection_rule: 'first_unchecked_slice' },
      durable_decisions: 'docs/decisions.md',
      execution_guidance: 'docs/execution-guidance.md',
      validation: 'docs/validation.md',
    },
    provider: {
      name: 'anthropic',
      ...(writeAccess !== undefined ? { sandbox: { write_access: writeAccess } } : {}),
    },
  };
}

function makeSpawnMock(opts: { stdoutData?: string; exitCode?: number } = {}) {
  const {
    stdoutData = JSON.stringify({ result: 'agent-output' }),
    exitCode = 0,
  } = opts;

  let capturedCmd = '';
  let capturedArgs: string[] = [];
  const stdinWritten: string[] = [];

  const spawnFn: SpawnFn = (cmd, args) => {
    capturedCmd = cmd;
    capturedArgs = [...args];

    const stdoutListeners: Array<(c: Buffer) => void> = [];
    const stderrListeners: Array<(c: Buffer) => void> = [];
    const closeListeners: Array<(code: number | null) => void> = [];

    return {
      stdin: {
        write: (data: string) => { stdinWritten.push(data); return true; },
        end: () => {
          setImmediate(() => {
            if (stdoutData) {
              for (const l of stdoutListeners) l(Buffer.from(stdoutData));
            }
            for (const l of closeListeners) l(exitCode);
          });
        },
      },
      stdout: {
        on: (_event: 'data', cb: (c: Buffer) => void) => {
          stdoutListeners.push(cb);
          return {} as unknown;
        },
      },
      stderr: {
        on: (_event: 'data', cb: (c: Buffer) => void) => {
          stderrListeners.push(cb);
          return {} as unknown;
        },
      },
      on: (_event: 'close', cb: (code: number | null) => void) => {
        closeListeners.push(cb);
        return {} as unknown;
      },
    };
  };

  return {
    spawnFn,
    get capturedCmd() { return capturedCmd; },
    get capturedArgs() { return capturedArgs; },
    get stdinWritten() { return stdinWritten; },
  };
}

test('ClaudeCodeProvider: passes --allowedTools flag when write_access is true', async () => {
  const mock = makeSpawnMock();
  const provider = new ClaudeCodeProvider(makeConfig(true), mock.spawnFn);
  const saved = process.env['ANTHROPIC_API_KEY'];
  process.env['ANTHROPIC_API_KEY'] = 'test-key';
  try {
    await provider.submit('test prompt');
    assert.ok(mock.capturedArgs.includes('--allowedTools'), 'expected --allowedTools in args');
    assert.ok(mock.capturedArgs.includes('Edit,Write,Read'), 'expected tool list in args');
  } finally {
    if (saved === undefined) delete process.env['ANTHROPIC_API_KEY'];
    else process.env['ANTHROPIC_API_KEY'] = saved;
  }
});

test('ClaudeCodeProvider: passes --allowedTools flag when sandbox is not set (default)', async () => {
  const mock = makeSpawnMock();
  const provider = new ClaudeCodeProvider(makeConfig(), mock.spawnFn);
  const saved = process.env['ANTHROPIC_API_KEY'];
  process.env['ANTHROPIC_API_KEY'] = 'test-key';
  try {
    await provider.submit('test prompt');
    assert.ok(mock.capturedArgs.includes('--allowedTools'), 'expected --allowedTools when sandbox not configured');
  } finally {
    if (saved === undefined) delete process.env['ANTHROPIC_API_KEY'];
    else process.env['ANTHROPIC_API_KEY'] = saved;
  }
});

test('ClaudeCodeProvider: omits --allowedTools flag when write_access is false', async () => {
  const mock = makeSpawnMock();
  const provider = new ClaudeCodeProvider(makeConfig(false), mock.spawnFn);
  const saved = process.env['ANTHROPIC_API_KEY'];
  process.env['ANTHROPIC_API_KEY'] = 'test-key';
  try {
    await provider.submit('test prompt');
    assert.ok(!mock.capturedArgs.includes('--allowedTools'), 'expected --allowedTools to be absent when write_access is false');
  } finally {
    if (saved === undefined) delete process.env['ANTHROPIC_API_KEY'];
    else process.env['ANTHROPIC_API_KEY'] = saved;
  }
});

test('ClaudeCodeProvider: returns error result (not thrown) when ANTHROPIC_API_KEY is missing', async () => {
  const mock = makeSpawnMock();
  const provider = new ClaudeCodeProvider(makeConfig(), mock.spawnFn);
  const saved = process.env['ANTHROPIC_API_KEY'];
  delete process.env['ANTHROPIC_API_KEY'];
  try {
    let result!: { output: string; error?: string };
    await assert.doesNotReject(async () => {
      result = await provider.submit('test prompt');
    });
    assert.ok(result.error, 'expected error field to be set when API key is missing');
    assert.equal(result.output, '', 'expected empty output when API key is missing');
  } finally {
    if (saved !== undefined) process.env['ANTHROPIC_API_KEY'] = saved;
  }
});

test('ClaudeCodeProvider: passes prompt via stdin, not in args', async () => {
  const mock = makeSpawnMock();
  const provider = new ClaudeCodeProvider(makeConfig(), mock.spawnFn);
  const saved = process.env['ANTHROPIC_API_KEY'];
  process.env['ANTHROPIC_API_KEY'] = 'test-key';
  try {
    const prompt = 'unique-prompt-content-for-stdin-test';
    await provider.submit(prompt);
    assert.ok(
      mock.stdinWritten.some((s) => s.includes(prompt)),
      'expected prompt to be written to stdin',
    );
    assert.ok(
      !mock.capturedArgs.some((a) => a.includes(prompt)),
      'expected prompt to not appear in args',
    );
  } finally {
    if (saved === undefined) delete process.env['ANTHROPIC_API_KEY'];
    else process.env['ANTHROPIC_API_KEY'] = saved;
  }
});

test('ClaudeCodeProvider: extracts output from JSON result field', async () => {
  const expectedOutput = 'the agent response text';
  const mock = makeSpawnMock({ stdoutData: JSON.stringify({ result: expectedOutput }) });
  const provider = new ClaudeCodeProvider(makeConfig(), mock.spawnFn);
  const saved = process.env['ANTHROPIC_API_KEY'];
  process.env['ANTHROPIC_API_KEY'] = 'test-key';
  try {
    const result = await provider.submit('test prompt');
    assert.equal(result.output, expectedOutput);
    assert.equal(result.error, undefined);
  } finally {
    if (saved === undefined) delete process.env['ANTHROPIC_API_KEY'];
    else process.env['ANTHROPIC_API_KEY'] = saved;
  }
});
