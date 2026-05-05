import test from 'node:test';
import assert from 'node:assert/strict';
import { ClaudeCodeProvider, CodexProvider } from '../src/provider.ts';
import type { RaesConfig } from '../src/config.ts';
import type { SpawnFn } from '../src/provider.ts';

function makeConfig(providerName: 'anthropic' | 'openai', writeAccess?: boolean): RaesConfig {
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
      name: providerName,
      ...(writeAccess !== undefined ? { sandbox: { write_access: writeAccess } } : {}),
    },
  };
}

function makeSpawnMock(opts: { stdoutData?: string; stderrData?: string; exitCode?: number } = {}) {
  const {
    stdoutData = JSON.stringify({ result: 'agent-output' }),
    stderrData = '',
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
            if (stderrData) {
              for (const l of stderrListeners) l(Buffer.from(stderrData));
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
  const provider = new ClaudeCodeProvider(makeConfig('anthropic', true), mock.spawnFn);
  await provider.submit('test prompt');
  assert.ok(mock.capturedArgs.includes('--allowedTools'), 'expected --allowedTools in args');
  assert.ok(mock.capturedArgs.includes('Edit,Write,Read'), 'expected tool list in args');
});

test('ClaudeCodeProvider: passes --allowedTools flag when sandbox is not set (default)', async () => {
  const mock = makeSpawnMock();
  const provider = new ClaudeCodeProvider(makeConfig('anthropic'), mock.spawnFn);
  await provider.submit('test prompt');
  assert.ok(mock.capturedArgs.includes('--allowedTools'), 'expected --allowedTools when sandbox not configured');
});

test('ClaudeCodeProvider: omits --allowedTools flag when write_access is false', async () => {
  const mock = makeSpawnMock();
  const provider = new ClaudeCodeProvider(makeConfig('anthropic', false), mock.spawnFn);
  await provider.submit('test prompt');
  assert.ok(!mock.capturedArgs.includes('--allowedTools'), 'expected --allowedTools to be absent when write_access is false');
});

test('ClaudeCodeProvider: subprocess exits non-zero with auth error output returns ProviderResult with error and fix string', async () => {
  const mock = makeSpawnMock({
    stdoutData: '',
    stderrData: 'Error: Not logged in. Please run claude login.',
    exitCode: 1,
  });
  const provider = new ClaudeCodeProvider(makeConfig('anthropic'), mock.spawnFn);
  const result = await provider.submit('test prompt');
  assert.equal(result.output, '', 'expected empty output on auth error');
  assert.ok(result.error, 'expected error field to be set');
  assert.ok(result.fix, 'expected fix field to be set');
  assert.match(result.fix, /claude login/, 'expected fix to mention claude login');
});

test('ClaudeCodeProvider: passes prompt via stdin, not in args', async () => {
  const mock = makeSpawnMock();
  const provider = new ClaudeCodeProvider(makeConfig('anthropic'), mock.spawnFn);
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
});

test('ClaudeCodeProvider: extracts output from JSON result field', async () => {
  const expectedOutput = 'the agent response text';
  const mock = makeSpawnMock({ stdoutData: JSON.stringify({ result: expectedOutput }) });
  const provider = new ClaudeCodeProvider(makeConfig('anthropic'), mock.spawnFn);
  const result = await provider.submit('test prompt');
  assert.equal(result.output, expectedOutput);
  assert.equal(result.error, undefined);
});

test('CodexProvider: passes --sandbox workspace-write when write_access is true', async () => {
  const mock = makeSpawnMock({ stdoutData: `${JSON.stringify({ type: 'turn/completed', output_text: 'agent-output' })}\n` });
  const provider = new CodexProvider(makeConfig('openai', true), mock.spawnFn);
  await provider.submit('test prompt');
  assert.equal(mock.capturedCmd, 'codex');
  assert.ok(mock.capturedArgs.includes('exec'), 'expected exec in args');
  assert.ok(mock.capturedArgs.includes('-'), 'expected stdin sentinel in args');
  assert.ok(mock.capturedArgs.includes('--sandbox'), 'expected --sandbox in args');
  assert.ok(mock.capturedArgs.includes('workspace-write'), 'expected workspace-write in args');
});

test('CodexProvider: omits --sandbox when write_access is false', async () => {
  const mock = makeSpawnMock({ stdoutData: `${JSON.stringify({ type: 'turn/completed', output_text: 'agent-output' })}\n` });
  const provider = new CodexProvider(makeConfig('openai', false), mock.spawnFn);
  await provider.submit('test prompt');
  assert.ok(!mock.capturedArgs.includes('--sandbox'), 'expected --sandbox to be absent when write_access is false');
});

test('CodexProvider: subprocess exits non-zero with auth error output returns ProviderResult with error and fix string', async () => {
  const mock = makeSpawnMock({
    stdoutData: '',
    stderrData: 'Authentication failed. Please run codex login.',
    exitCode: 1,
  });
  const provider = new CodexProvider(makeConfig('openai'), mock.spawnFn);
  const result = await provider.submit('test prompt');
  assert.equal(result.output, '', 'expected empty output on auth error');
  assert.ok(result.error, 'expected error field to be set');
  assert.ok(result.fix, 'expected fix field to be set');
  assert.match(result.fix, /codex login/, 'expected fix to mention codex login');
});

test('CodexProvider: passes prompt via stdin, not in args', async () => {
  const mock = makeSpawnMock({ stdoutData: `${JSON.stringify({ type: 'turn/completed', output_text: 'agent-output' })}\n` });
  const provider = new CodexProvider(makeConfig('openai'), mock.spawnFn);
  const prompt = 'unique-codex-prompt-content-for-stdin-test';
  await provider.submit(prompt);
  assert.ok(
    mock.stdinWritten.some((s) => s.includes(prompt)),
    'expected prompt to be written to stdin',
  );
  assert.ok(
    !mock.capturedArgs.some((a) => a.includes(prompt)),
    'expected prompt to not appear in args',
  );
});

test('CodexProvider: extracts output from JSONL turn/completed event', async () => {
  const expectedOutput = 'codex final response';
  const stdoutData = [
    JSON.stringify({ type: 'turn/started', turn_id: 'turn-1' }),
    JSON.stringify({ type: 'message', role: 'assistant', content: 'partial output ignored here' }),
    JSON.stringify({ type: 'turn/completed', output_text: expectedOutput }),
  ].join('\n');
  const mock = makeSpawnMock({ stdoutData });
  const provider = new CodexProvider(makeConfig('openai'), mock.spawnFn);
  const result = await provider.submit('test prompt');
  assert.equal(result.output, expectedOutput);
  assert.equal(result.error, undefined);
});
