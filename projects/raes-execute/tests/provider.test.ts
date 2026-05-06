import test from 'node:test';
import assert from 'node:assert/strict';
import { ClaudeCodeProvider, CodexAppServerSession, CodexProvider, createProvider } from '../src/provider.ts';
import type { RaesConfig } from '../src/config.ts';
import type { ProviderProgressEvent, ProviderSession, SpawnFn } from '../src/provider.ts';

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

function makeAppServerSpawnMock() {
  let capturedCmd = '';
  let capturedArgs: string[] = [];
  let stdoutListener: ((c: Buffer) => void) | undefined;
  let stderrListener: ((c: Buffer) => void) | undefined;
  let closeListener: ((code: number | null) => void) | undefined;
  const stdinWritten: string[] = [];

  const spawnFn: SpawnFn = (cmd, args) => {
    capturedCmd = cmd;
    capturedArgs = [...args];

    return {
      stdin: {
        write: (data: string) => {
          stdinWritten.push(data);
          return true;
        },
        end: () => {},
      },
      stdout: {
        on: (_event: 'data', cb: (c: Buffer) => void) => {
          stdoutListener = cb;
          return {} as unknown;
        },
      },
      stderr: {
        on: (_event: 'data', cb: (c: Buffer) => void) => {
          stderrListener = cb;
          return {} as unknown;
        },
      },
      on: (_event: 'close', cb: (code: number | null) => void) => {
        closeListener = cb;
        return {} as unknown;
      },
    };
  };

  function emitStdout(message: Record<string, unknown>): void {
    stdoutListener?.(Buffer.from(`${JSON.stringify(message)}\n`));
  }

  function emitStdoutRaw(raw: string): void {
    stdoutListener?.(Buffer.from(raw));
  }

  function emitStderr(text: string): void {
    stderrListener?.(Buffer.from(text));
  }

  function close(code: number | null): void {
    closeListener?.(code);
  }

  function nextRequestId(): number {
    const raw = stdinWritten[stdinWritten.length - 1];
    const parsed = JSON.parse(raw.trim()) as { id: number };
    return parsed.id;
  }

  function reply(result: Record<string, unknown>): void {
    emitStdout({ id: nextRequestId(), result });
  }

  function replyError(message: string): void {
    emitStdout({
      id: nextRequestId(),
      error: { code: -32603, message },
    });
  }

  return {
    spawnFn,
    emitStdout,
    emitStdoutRaw,
    emitStderr,
    close,
    reply,
    replyError,
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
  const stdoutData = [
    JSON.stringify({ type: 'message_start' }),
    JSON.stringify({ type: 'result', result: expectedOutput }),
  ].join('\n');
  const mock = makeSpawnMock({ stdoutData });
  const provider = new ClaudeCodeProvider(makeConfig('anthropic'), mock.spawnFn);
  const result = await provider.submit('test prompt');
  assert.equal(result.output, expectedOutput);
  assert.equal(result.error, undefined);
});

test('ClaudeCodeProvider: emits progress events while parsing stream-json output', async () => {
  const events: ProviderProgressEvent[] = [];
  const stdoutData = [
    JSON.stringify({ type: 'message_start' }),
    JSON.stringify({ type: 'content_block_start', tool_name: 'Read' }),
    JSON.stringify({ type: 'result', result: 'done' }),
  ].join('\n');
  const mock = makeSpawnMock({ stdoutData });
  const provider = new ClaudeCodeProvider(makeConfig('anthropic'), mock.spawnFn);
  const result = await provider.submit('test prompt', {
    onProgress: (event) => events.push(event),
  });
  assert.equal(result.output, 'done');
  assert.deepEqual(events, [
    { kind: 'status', text: 'Agent response started' },
    { kind: 'tool', text: 'Read' },
  ]);
});

test('ClaudeCodeProvider: startSession returns a closeable session that preserves one-shot submit behavior', async () => {
  const mock = makeSpawnMock();
  const provider = new ClaudeCodeProvider(makeConfig('anthropic'), mock.spawnFn);
  const session = await provider.startSession();
  const result = await session.submitTurn('test prompt');
  assert.equal(result.output, 'agent-output');
  await session.close();
});

test('CodexProvider: passes --sandbox workspace-write when write_access is true', async () => {
  const mock = makeSpawnMock({ stdoutData: `${JSON.stringify({ type: 'turn.completed', output_text: 'agent-output' })}\n` });
  const provider = new CodexProvider(makeConfig('openai', true), mock.spawnFn);
  await provider.submit('test prompt');
  assert.equal(mock.capturedCmd, 'codex');
  assert.ok(mock.capturedArgs.includes('exec'), 'expected exec in args');
  assert.ok(mock.capturedArgs.includes('-'), 'expected stdin sentinel in args');
  assert.ok(mock.capturedArgs.includes('--sandbox'), 'expected --sandbox in args');
  assert.ok(mock.capturedArgs.includes('workspace-write'), 'expected workspace-write in args');
});

test('CodexProvider: omits --sandbox when write_access is false', async () => {
  const mock = makeSpawnMock({ stdoutData: `${JSON.stringify({ type: 'turn.completed', output_text: 'agent-output' })}\n` });
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
  const mock = makeSpawnMock({ stdoutData: `${JSON.stringify({ type: 'turn.completed', output_text: 'agent-output' })}\n` });
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

test('CodexProvider: extracts output from JSONL turn.completed event', async () => {
  const expectedOutput = 'codex final response';
  const stdoutData = [
    JSON.stringify({ type: 'turn.started', turn_id: 'turn-1' }),
    JSON.stringify({ type: 'message.delta', role: 'assistant', content: 'partial output ignored here' }),
    JSON.stringify({ type: 'turn.completed', output_text: expectedOutput }),
  ].join('\n');
  const mock = makeSpawnMock({ stdoutData });
  const provider = new CodexProvider(makeConfig('openai'), mock.spawnFn);
  const result = await provider.submit('test prompt');
  assert.equal(result.output, expectedOutput);
  assert.equal(result.error, undefined);
});

test('CodexProvider: emits progress events before turn.completed', async () => {
  const events: ProviderProgressEvent[] = [];
  const stdoutData = [
    JSON.stringify({ type: 'thread.started' }),
    JSON.stringify({ type: 'turn.started', turn_id: 'turn-1' }),
    JSON.stringify({ type: 'item.started', item: { type: 'reasoning' } }),
    JSON.stringify({ type: 'item.completed', item: { type: 'reasoning' } }),
    JSON.stringify({ type: 'tool_call.started', tool_name: 'Edit' }),
    JSON.stringify({ type: 'turn.completed', output_text: 'done' }),
  ].join('\n');
  const mock = makeSpawnMock({ stdoutData });
  const provider = new CodexProvider(makeConfig('openai'), mock.spawnFn);
  const result = await provider.submit('test prompt', {
    onProgress: (event) => events.push(event),
  });
  assert.equal(result.output, 'done');
  assert.deepEqual(events, [
    { kind: 'status', text: 'Session started' },
    { kind: 'status', text: 'Agent turn started' },
    { kind: 'status', text: 'reasoning started' },
    { kind: 'status', text: 'reasoning completed' },
    { kind: 'tool', text: 'Edit' },
  ]);
});

test('CodexProvider: startSession returns a closeable session that forwards progress callbacks', async () => {
  const events: ProviderProgressEvent[] = [];
  const stdoutData = [
    JSON.stringify({ type: 'thread.started' }),
    JSON.stringify({ type: 'turn.completed', output_text: 'done' }),
  ].join('\n');
  const mock = makeSpawnMock({ stdoutData });
  const provider = new CodexProvider(makeConfig('openai'), mock.spawnFn);
  const session = await provider.startSession();
  const result = await session.submitTurn('test prompt', {
    onProgress: (event) => events.push(event),
  });
  assert.equal(result.output, 'done');
  assert.deepEqual(events, [{ kind: 'status', text: 'Session started' }]);
  await session.close();
});

test('CodexAppServerSession: starts codex app-server over stdio and sends initialize handshake', async () => {
  const mock = makeAppServerSpawnMock();
  const session = new CodexAppServerSession(makeConfig('openai', true), process.cwd(), mock.spawnFn);

  const startup = session.start();
  assert.equal(mock.capturedCmd, 'codex');
  assert.deepEqual(mock.capturedArgs, ['app-server', '--listen', 'stdio://']);

  const initialize = JSON.parse(mock.stdinWritten[0].trim()) as Record<string, unknown>;
  assert.equal(initialize.method, 'initialize');
  assert.deepEqual((initialize.params as Record<string, unknown>).clientInfo, {
    name: 'raes-execute',
    title: 'RAES Execute',
    version: '0.1.0',
  });

  mock.reply({
    userAgent: 'codex-test',
    codexHome: '/tmp/codex-home',
    platformFamily: 'unix',
    platformOs: 'darwin',
  });
  await Promise.resolve();
  const initialized = JSON.parse(mock.stdinWritten[1].trim()) as Record<string, unknown>;
  assert.equal(initialized.method, 'initialized');
  mock.emitStdout({
    method: 'thread/started',
    params: { thread: { id: 'thread-1' } },
  });
  mock.reply({ thread: { id: 'thread-1' } });

  await startup;
  const closePromise = session.close();
  mock.reply({});
  mock.close(0);
  await closePromise;
});

test('CodexAppServerSession: correlates requests, streams notifications, and returns turn output', async () => {
  const events: ProviderProgressEvent[] = [];
  const mock = makeAppServerSpawnMock();
  const session = new CodexAppServerSession(makeConfig('openai', true), '/repo', mock.spawnFn);

  const startup = session.start();
  mock.reply({
    userAgent: 'codex-test',
    codexHome: '/tmp/codex-home',
    platformFamily: 'unix',
    platformOs: 'darwin',
  });
  await Promise.resolve();
  const initialized = JSON.parse(mock.stdinWritten[1].trim()) as Record<string, unknown>;
  assert.equal(initialized.method, 'initialized');
  mock.emitStdout({ method: 'thread/started', params: { thread: { id: 'thread-1' } } });
  mock.reply({ thread: { id: 'thread-1' } });
  await startup;

  const turnPromise = session.submitTurn('Implement the slice', {
    onProgress: (event) => events.push(event),
  });
  await Promise.resolve();
  const turnStart = JSON.parse(mock.stdinWritten[3].trim()) as Record<string, unknown>;
  assert.equal(turnStart.method, 'turn/start');
  const params = turnStart.params as Record<string, unknown>;
  assert.equal(params.threadId, 'thread-1');
  assert.equal((params.input as Array<Record<string, unknown>>)[0].text, 'Implement the slice');
  assert.equal(params.cwd, '/repo');
  assert.equal(params.sandboxPolicy, 'workspace-write');

  mock.emitStdout({ method: 'turn/started', params: { turn: { id: 'turn-1' } } });
  mock.emitStdout({ method: 'item/started', params: { item: { type: 'reasoning' } } });
  mock.reply({ turn: { id: 'turn-1', status: 'inProgress' } });
  mock.emitStdout({
    method: 'turn/completed',
    params: { turn: { id: 'turn-1', status: 'completed', output_text: 'done' } },
  });

  const result = await turnPromise;
  assert.deepEqual(events, [
    { kind: 'status', text: 'Agent turn started' },
    { kind: 'status', text: 'reasoning started' },
  ]);
  assert.equal(result.output, 'done');

  const closePromise = session.close();
  const unsubscribe = JSON.parse(mock.stdinWritten[4].trim()) as Record<string, unknown>;
  assert.equal(unsubscribe.method, 'thread/unsubscribe');
  mock.reply({});
  mock.close(0);
  await closePromise;
});

test('CodexAppServerSession: malformed JSONL payload returns a structured error', async () => {
  const mock = makeAppServerSpawnMock();
  const session = new CodexAppServerSession(makeConfig('openai', true), '/repo', mock.spawnFn);

  const startup = session.start();
  mock.reply({
    userAgent: 'codex-test',
    codexHome: '/tmp/codex-home',
    platformFamily: 'unix',
    platformOs: 'darwin',
  });
  await Promise.resolve();
  mock.emitStdout({ method: 'thread/started', params: { thread: { id: 'thread-1' } } });
  mock.reply({ thread: { id: 'thread-1' } });
  await startup;

  const turnPromise = session.submitTurn('Implement the slice');
  await Promise.resolve();
  mock.emitStdoutRaw('not-json\n');
  mock.reply({ turn: { id: 'turn-1', status: 'inProgress' } });

  const result = await turnPromise;
  assert.equal(result.output, '');
  assert.match(result.error ?? '', /failed to parse codex app-server output as JSONL/i);

  const closePromise = session.close();
  mock.reply({});
  mock.close(0);
  await closePromise;
});

test('CodexAppServerSession: subprocess termination before clean shutdown surfaces a structured error', async () => {
  const mock = makeAppServerSpawnMock();
  const session = new CodexAppServerSession(makeConfig('openai', true), '/repo', mock.spawnFn);

  const startup = session.start();
  mock.reply({
    userAgent: 'codex-test',
    codexHome: '/tmp/codex-home',
    platformFamily: 'unix',
    platformOs: 'darwin',
  });
  await Promise.resolve();
  mock.emitStdout({ method: 'thread/started', params: { thread: { id: 'thread-1' } } });
  mock.reply({ thread: { id: 'thread-1' } });
  await startup;

  const closePromise = session.close();
  mock.emitStderr('app-server exited unexpectedly');
  mock.close(1);

  await assert.rejects(closePromise, /codex app-server exited before clean shutdown/i);
});

test('CodexAppServerSession: JSON-RPC error response rejects the matching request', async () => {
  const mock = makeAppServerSpawnMock();
  const session = new CodexAppServerSession(makeConfig('openai', true), '/repo', mock.spawnFn);

  const startup = session.start();
  mock.reply({
    userAgent: 'codex-test',
    codexHome: '/tmp/codex-home',
    platformFamily: 'unix',
    platformOs: 'darwin',
  });
  await Promise.resolve();
  mock.emitStdout({ method: 'thread/started', params: { thread: { id: 'thread-1' } } });
  mock.reply({ thread: { id: 'thread-1' } });
  await startup;

  const turnPromise = session.submitTurn('Implement the slice');
  await Promise.resolve();
  mock.replyError('turn failed');

  await assert.rejects(turnPromise, /turn failed/);

  const closePromise = session.close();
  mock.reply({});
  mock.close(0);
  await closePromise;
});

test('createProvider: startSession returns a ProviderSession for anthropic config', async () => {
  const provider = createProvider(makeConfig('anthropic'));
  const session = await provider.startSession();
  assert.equal(typeof session.submitTurn, 'function');
  assert.equal(typeof session.close, 'function');
  await session.close();
});

test('ProviderSession shape remains transport-agnostic', () => {
  const fakeSession: ProviderSession = {
    submitTurn: async (_prompt, hooks) => {
      hooks?.onProgress?.({ kind: 'status', text: 'progress' });
      return { output: 'done' };
    },
    close: async () => {},
  };
  assert.equal(typeof fakeSession.submitTurn, 'function');
  assert.equal(typeof fakeSession.close, 'function');
});

test('createProvider: returns ClaudeCodeProvider for anthropic config', () => {
  const provider = createProvider(makeConfig('anthropic'));
  assert.ok(provider instanceof ClaudeCodeProvider);
});

test('createProvider: returns CodexProvider for openai config', () => {
  const provider = createProvider(makeConfig('openai'));
  assert.ok(provider instanceof CodexProvider);
});

test('createProvider: throws for unknown provider name', () => {
  const badConfig = {
    ...makeConfig('anthropic'),
    provider: { name: 'invalid-provider' },
  } as unknown as RaesConfig;
  assert.throws(
    () => createProvider(badConfig),
    /unknown provider/i,
  );
});
