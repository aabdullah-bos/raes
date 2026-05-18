import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ClaudeCodeProvider,
  CodexAppServerProvider,
  CodexAppServerSession,
  CodexProvider,
  GitHubCopilotProvider,
  createProvider,
} from '../src/provider.ts';
import type { RaesConfig } from '../src/config.ts';
import type { ProviderProgressEvent, ProviderSession, SpawnFn } from '../src/provider.ts';

function makeConfig(
  providerName: 'anthropic' | 'openai' | 'github_copilot',
  writeAccess?: boolean,
  openaiTransport?: 'exec' | 'app_server',
  githubCopilotTransport?: 'exec',
): RaesConfig {
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
      ...(providerName === 'openai' && openaiTransport
        ? { openai: { transport: openaiTransport } }
        : {}),
      ...(providerName === 'github_copilot' && githubCopilotTransport
        ? { github_copilot: { transport: githubCopilotTransport } }
        : {}),
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

test('ClaudeCodeProvider: missing claude binary returns structured error with install guidance', async () => {
  const spawnFn: SpawnFn = () => {
    throw new Error('spawn claude ENOENT');
  };
  const provider = new ClaudeCodeProvider(makeConfig('anthropic'), spawnFn);
  const result = await provider.submit('test prompt');
  assert.equal(result.output, '');
  assert.match(result.error ?? '', /binary missing/i);
  assert.match(result.error ?? '', /claude/i);
  assert.match(result.fix ?? '', /install Claude Code/i);
  assert.match(result.fix ?? '', /PATH/i);
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

test('CodexProvider: missing codex binary returns structured error with install guidance', async () => {
  const spawnFn: SpawnFn = () => {
    throw new Error('spawn codex ENOENT');
  };
  const provider = new CodexProvider(makeConfig('openai'), spawnFn);
  const result = await provider.submit('test prompt');
  assert.equal(result.output, '');
  assert.match(result.error ?? '', /binary missing/i);
  assert.match(result.error ?? '', /codex/i);
  assert.match(result.fix ?? '', /install Codex CLI/i);
  assert.match(result.fix ?? '', /PATH/i);
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

test('GitHubCopilotProvider: uses copilot prompt mode with non-interactive flags', async () => {
  const mock = makeSpawnMock({ stdoutData: `${JSON.stringify({ type: 'turn.completed', output_text: 'done' })}\n` });
  const provider = new GitHubCopilotProvider(makeConfig('github_copilot', true), mock.spawnFn);
  await provider.submit('test prompt');
  assert.equal(mock.capturedCmd, 'copilot');
  assert.ok(mock.capturedArgs.includes('-p'));
  assert.ok(mock.capturedArgs.includes('test prompt'));
  assert.ok(mock.capturedArgs.includes('--output-format=json'));
  assert.ok(mock.capturedArgs.includes('--allow-all-tools'));
});

test('GitHubCopilotProvider: read-only sandbox denies write and shell tools', async () => {
  const mock = makeSpawnMock({ stdoutData: `${JSON.stringify({ type: 'turn.completed', output_text: 'done' })}\n` });
  const provider = new GitHubCopilotProvider(makeConfig('github_copilot', false), mock.spawnFn);
  await provider.submit('test prompt');
  assert.ok(mock.capturedArgs.includes('--deny-tool=write'));
  assert.ok(mock.capturedArgs.includes('--deny-tool=shell'));
});

test('GitHubCopilotProvider: auth failure includes copilot auth login guidance', async () => {
  const mock = makeSpawnMock({
    stdoutData: '',
    stderrData: 'Not logged in',
    exitCode: 1,
  });
  const provider = new GitHubCopilotProvider(makeConfig('github_copilot'), mock.spawnFn);
  const result = await provider.submit('test prompt');
  assert.equal(result.output, '');
  assert.match(result.error ?? '', /copilot subprocess exited/i);
  assert.match(result.fix ?? '', /copilot auth login/i);
});

test('GitHubCopilotProvider: missing copilot binary returns structured error with install guidance', async () => {
  const spawnFn: SpawnFn = () => {
    throw new Error('spawn copilot ENOENT');
  };
  const provider = new GitHubCopilotProvider(makeConfig('github_copilot'), spawnFn);
  const result = await provider.submit('test prompt');
  assert.equal(result.output, '');
  assert.match(result.error ?? '', /binary missing/i);
  assert.match(result.error ?? '', /copilot/i);
  assert.match(result.fix ?? '', /install Copilot CLI/i);
  assert.match(result.fix ?? '', /PATH/i);
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
  assert.deepEqual(params.sandboxPolicy, { type: 'workspaceWrite' });

  mock.emitStdout({ method: 'turn/started', params: { turn: { id: 'turn-1' } } });
  mock.emitStdout({ method: 'item/started', params: { item: { type: 'reasoning' } } });
  mock.reply({ turn: { id: 'turn-1', status: 'inProgress' } });
  mock.emitStdout({
    method: 'turn/completed',
    params: { turn: { id: 'turn-1', status: 'completed', output_text: 'done' } },
  });

  const result = await turnPromise;
  assert.deepEqual(events, [
    { kind: 'status', text: 'Agent turn started', phase: 'turn', eventType: 'turn/started' },
    {
      kind: 'status',
      text: 'reasoning started',
      phase: 'item',
      eventType: 'item/started',
      item: { kind: 'reasoning' },
    },
  ]);
  assert.equal(result.output, 'done');

  const closePromise = session.close();
  const unsubscribe = JSON.parse(mock.stdinWritten[4].trim()) as Record<string, unknown>;
  assert.equal(unsubscribe.method, 'thread/unsubscribe');
  mock.reply({});
  mock.close(0);
  await closePromise;
});

test('CodexAppServerSession: falls back to accumulated agent-message deltas when turn output_text is empty', async () => {
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
  mock.emitStdout({ method: 'turn/started', params: { turn: { id: 'turn-1' } } });
  mock.emitStdout({
    method: 'item/agentMessage/delta',
    params: {
      item: { id: 'item-1', type: 'agentMessage' },
      delta: { text: 'Current Slice\n\nRecovered from agent delta output.' },
    },
  });
  mock.reply({ turn: { id: 'turn-1', status: 'inProgress' } });
  mock.emitStdout({
    method: 'turn/completed',
    params: { turn: { id: 'turn-1', status: 'completed' } },
  });

  const result = await turnPromise;
  assert.equal(result.output, 'Current Slice\n\nRecovered from agent delta output.');

  const closePromise = session.close();
  mock.reply({});
  mock.close(0);
  await closePromise;
});

test('CodexAppServerSession: prefers turn output_text over accumulated agent-message deltas when both are present', async () => {
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
  mock.emitStdout({
    method: 'item/agentMessage/delta',
    params: {
      item: { id: 'item-1', type: 'agentMessage' },
      delta: { text: 'delta output that should lose' },
    },
  });
  mock.reply({ turn: { id: 'turn-1', status: 'inProgress' } });
  mock.emitStdout({
    method: 'turn/completed',
    params: { turn: { id: 'turn-1', status: 'completed', output_text: 'authoritative turn output' } },
  });

  const result = await turnPromise;
  assert.equal(result.output, 'authoritative turn output');

  const closePromise = session.close();
  mock.reply({});
  mock.close(0);
  await closePromise;
});

test('CodexAppServerSession: falls back to completed agentMessage text when turn output_text is empty', async () => {
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
  mock.reply({ turn: { id: 'turn-1', status: 'inProgress' } });
  mock.emitStdout({
    method: 'item/completed',
    params: {
      item: {
        type: 'agentMessage',
        id: 'msg-1',
        text: 'Current Slice\n\nRecovered from completed agentMessage text.',
      },
    },
  });
  mock.emitStdout({
    method: 'turn/completed',
    params: { turn: { id: 'turn-1', status: 'completed' } },
  });

  const result = await turnPromise;
  assert.equal(result.output, 'Current Slice\n\nRecovered from completed agentMessage text.');

  const closePromise = session.close();
  mock.reply({});
  mock.close(0);
  await closePromise;
});

test('CodexAppServerSession: normalizes supported app-server notifications into structured RAES progress events', async () => {
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
  mock.emitStdout({ method: 'thread/started', params: { thread: { id: 'thread-1' } } });
  mock.reply({ thread: { id: 'thread-1' } });
  await startup;

  const turnPromise = session.submitTurn('Implement the slice', {
    onProgress: (event) => events.push(event),
  });
  await Promise.resolve();

  mock.emitStdout({
    method: 'thread/started',
    params: {
      thread: { id: 'thread-1' },
    },
  });
  mock.emitStdout({
    method: 'mcpServer/startupStatus/updated',
    params: {
      name: 'codex_apps',
      status: 'ready',
      error: null,
    },
  });
  mock.emitStdout({
    method: 'thread/status/changed',
    params: {
      threadId: 'thread-1',
      status: { type: 'active', activeFlags: [] },
    },
  });
  mock.emitStdout({ method: 'turn/started', params: { turn: { id: 'turn-1' } } });
  mock.emitStdout({
    method: 'item/started',
    params: {
      item: {
        id: 'item-1',
        type: 'reasoning',
      },
    },
  });
  mock.emitStdout({
    method: 'item/started',
    params: {
      item: {
        id: 'item-3',
        type: 'commandExecution',
        command: 'npm test',
        cwd: '/repo',
        status: 'inProgress',
      },
    },
  });
  mock.emitStdout({
    method: 'item/agentMessage/delta',
    params: {
      item: { id: 'item-2', type: 'agentMessage' },
      delta: { text: 'Thinking through the boundary checks' },
    },
  });
  mock.emitStdout({
    method: 'item/reasoning/summaryTextDelta',
    params: {
      item: { id: 'item-1', type: 'reasoning' },
      delta: { text: 'Summarized plan update' },
    },
  });
  mock.emitStdout({
    method: 'item/commandExecution/outputDelta',
    params: {
      item: { id: 'item-3', type: 'commandExecution', command: 'npm test' },
      delta: { text: 'ok 12 tests\n' },
    },
  });
  mock.emitStdout({
    method: 'item/completed',
    params: {
      item: {
        id: 'item-3',
        type: 'commandExecution',
        command: 'npm test',
        status: 'completed',
        exitCode: 0,
        durationMs: 42,
      },
    },
  });
  mock.emitStdout({
    method: 'item/completed',
    params: {
      item: {
        id: 'item-4',
        type: 'fileChange',
        status: 'completed',
        changes: [{ path: 'src/provider.ts', kind: 'modified' }],
      },
    },
  });
  mock.emitStdout({
    method: 'turn/plan/updated',
    params: {
      plan: [{ step: 'Run provider tests', status: 'completed' }],
    },
  });
  mock.emitStdout({
    method: 'turn/diff/updated',
    params: {
      diff: { files: [{ path: 'src/provider.ts', change: 'modified' }] },
    },
  });
  mock.emitStdout({ method: 'item/completed', params: { item: { id: 'item-1', type: 'reasoning' } } });
  mock.reply({ turn: { id: 'turn-1', status: 'inProgress' } });
  mock.emitStdout({
    method: 'turn/completed',
    params: { turn: { id: 'turn-1', status: 'completed', output_text: 'done' } },
  });

  const result = await turnPromise;
  assert.equal(result.output, 'done');
  assert.deepEqual(events, [
    {
      kind: 'status',
      text: 'Session started',
      phase: 'turn',
      eventType: 'thread/started',
    },
    {
      kind: 'status',
      text: 'MCP codex_apps ready',
      phase: 'unknown',
      eventType: 'mcpServer/startupStatus/updated',
    },
    {
      kind: 'status',
      text: 'Session active',
      phase: 'turn',
      eventType: 'thread/status/changed',
    },
    {
      kind: 'status',
      text: 'Agent turn started',
      phase: 'turn',
      eventType: 'turn/started',
    },
    {
      kind: 'status',
      text: 'reasoning started',
      phase: 'item',
      eventType: 'item/started',
      item: { id: 'item-1', kind: 'reasoning' },
    },
    {
      kind: 'status',
      text: 'command_execution started',
      phase: 'command',
      eventType: 'item/started',
      item: {
        id: 'item-3',
        kind: 'command_execution',
        command: 'npm test',
        cwd: '/repo',
        status: 'inProgress',
      },
      command: 'npm test',
    },
    {
      kind: 'message',
      text: 'Thinking through the boundary checks',
      phase: 'message',
      eventType: 'item/agentMessage/delta',
      item: { id: 'item-2', kind: 'agent_message' },
      delta: 'Thinking through the boundary checks',
    },
    {
      kind: 'message',
      text: 'Summarized plan update',
      phase: 'reasoning',
      eventType: 'item/reasoning/summaryTextDelta',
      item: { id: 'item-1', kind: 'reasoning' },
      delta: 'Summarized plan update',
    },
    {
      kind: 'tool',
      text: 'npm test',
      phase: 'command',
      eventType: 'item/commandExecution/outputDelta',
      item: { id: 'item-3', kind: 'command_execution', command: 'npm test' },
      command: 'npm test',
      delta: 'ok 12 tests\n',
    },
    {
      kind: 'status',
      text: 'command_execution completed',
      phase: 'command',
      eventType: 'item/completed',
      item: {
        id: 'item-3',
        kind: 'command_execution',
        command: 'npm test',
        status: 'completed',
        exitCode: 0,
        durationMs: 42,
      },
      command: 'npm test',
    },
    {
      kind: 'status',
      text: 'file_change completed',
      phase: 'diff',
      eventType: 'item/completed',
      item: {
        id: 'item-4',
        kind: 'file_change',
        status: 'completed',
        changes: [{ path: 'src/provider.ts', kind: 'modified' }],
      },
      files: [{ path: 'src/provider.ts', kind: 'modified' }],
    },
    {
      kind: 'status',
      text: 'Plan updated',
      phase: 'plan',
      eventType: 'turn/plan/updated',
      plan: [{ step: 'Run provider tests', status: 'completed' }],
    },
    {
      kind: 'status',
      text: 'Diff updated',
      phase: 'diff',
      eventType: 'turn/diff/updated',
      files: [{ path: 'src/provider.ts', change: 'modified' }],
    },
    {
      kind: 'status',
      text: 'reasoning completed',
      phase: 'item',
      eventType: 'item/completed',
      item: { id: 'item-1', kind: 'reasoning' },
    },
  ]);

  const closePromise = session.close();
  mock.reply({});
  mock.close(0);
  await closePromise;
});

test('CodexAppServerSession: emits raw notification debug events when RAES_DEBUG_CODEX_EVENTS is set', async () => {
  const previous = process.env['RAES_DEBUG_CODEX_EVENTS'];
  process.env['RAES_DEBUG_CODEX_EVENTS'] = '1';
  const events: ProviderProgressEvent[] = [];
  const mock = makeAppServerSpawnMock();
  const session = new CodexAppServerSession(makeConfig('openai', true), '/repo', mock.spawnFn);

  try {
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

    const turnPromise = session.submitTurn('Implement the slice', {
      onProgress: (event) => events.push(event),
      rawEvents: true,
    });
    await Promise.resolve();

    mock.emitStdout({ method: 'turn/started', params: { turn: { id: 'turn-1' } } });
    mock.reply({ turn: { id: 'turn-1', status: 'inProgress' } });
    mock.emitStdout({
      method: 'turn/completed',
      params: { turn: { id: 'turn-1', status: 'completed', output_text: 'done' } },
    });

    const result = await turnPromise;
    assert.equal(result.output, 'done');
    assert.deepEqual(events[0], {
      kind: 'warning',
      text: 'raw turn/started: {"turn":{"id":"turn-1"}}',
      phase: 'unknown',
      eventType: 'turn/started',
    });
    assert.deepEqual(events[2], {
      kind: 'warning',
      text: 'raw turn/completed: {"turn":{"id":"turn-1","status":"completed","output_text":"done"}}',
      phase: 'unknown',
      eventType: 'turn/completed',
    });
  } finally {
    if (previous === undefined) {
      delete process.env['RAES_DEBUG_CODEX_EVENTS'];
    } else {
      process.env['RAES_DEBUG_CODEX_EVENTS'] = previous;
    }
    const closePromise = session.close();
    mock.reply({});
    mock.close(0);
    await closePromise;
  }
});

test('CodexAppServerSession: unsupported notifications degrade safely without failing the turn', async () => {
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
  mock.emitStdout({ method: 'thread/started', params: { thread: { id: 'thread-1' } } });
  mock.reply({ thread: { id: 'thread-1' } });
  await startup;

  const turnPromise = session.submitTurn('Implement the slice', {
    onProgress: (event) => events.push(event),
  });
  await Promise.resolve();

  mock.emitStdout({
    method: 'turn/custom-progress',
    params: { detail: 'something unsupported' },
  });
  mock.reply({ turn: { id: 'turn-1', status: 'inProgress' } });
  mock.emitStdout({
    method: 'turn/completed',
    params: { turn: { id: 'turn-1', status: 'completed', output_text: 'done' } },
  });

  const result = await turnPromise;
  assert.equal(result.output, 'done');
  assert.deepEqual(events, [
    {
      kind: 'status',
      text: 'Observed turn/custom-progress',
      phase: 'unknown',
      eventType: 'turn/custom-progress',
    },
  ]);

  const closePromise = session.close();
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

  const result = await turnPromise;
  assert.equal(result.output, '');
  assert.match(result.error ?? '', /codex app-server agent execution failure/i);
  assert.match(result.error ?? '', /turn\/start failed/i);
  assert.match(result.error ?? '', /turn failed/i);

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

test('createProvider: returns CodexProvider for explicit openai exec transport', () => {
  const provider = createProvider(makeConfig('openai', undefined, 'exec'));
  assert.ok(provider instanceof CodexProvider);
});

test('createProvider: returns CodexAppServerProvider for openai app_server transport', () => {
  const provider = createProvider(makeConfig('openai', undefined, 'app_server'));
  assert.ok(provider instanceof CodexAppServerProvider);
});

test('createProvider: returns GitHubCopilotProvider for github_copilot config', () => {
  const provider = createProvider(makeConfig('github_copilot'));
  assert.ok(provider instanceof GitHubCopilotProvider);
});

test('createProvider: returns GitHubCopilotProvider for explicit github_copilot exec transport', () => {
  const provider = createProvider(makeConfig('github_copilot', undefined, undefined, 'exec'));
  assert.ok(provider instanceof GitHubCopilotProvider);
});

test('CodexAppServerSession: authentication failure returns actionable fix guidance', async () => {
  const mock = makeAppServerSpawnMock();
  const session = new CodexAppServerSession(makeConfig('openai', true, 'app_server'), '/repo', mock.spawnFn);

  const turnPromise = session.submitTurn('Implement the slice');
  await Promise.resolve();
  mock.emitStderr('Error: Not logged in. Please run codex login.');
  mock.close(1);

  const result = await turnPromise;
  assert.equal(result.output, '');
  assert.match(result.error ?? '', /authentication failure/i);
  assert.match(result.fix ?? '', /codex login/i);
});

test('CodexAppServerSession: thread/start session-state failure returns actionable ownership fix guidance', async () => {
  const mock = makeAppServerSpawnMock();
  const session = new CodexAppServerSession(makeConfig('openai', true, 'app_server'), '/repo', mock.spawnFn);

  const turnPromise = session.submitTurn('Implement the slice');
  await Promise.resolve();
  mock.reply({
    userAgent: 'codex-test',
    codexHome: '/tmp/codex-home',
    platformFamily: 'unix',
    platformOs: 'darwin',
  });
  await Promise.resolve();
  mock.replyError('failed to persist session under /Users/test/.codex/sessions: EACCES: permission denied, mkdir');

  const result = await turnPromise;
  assert.equal(result.output, '');
  assert.match(result.error ?? '', /session state failure/i);
  assert.match(result.error ?? '', /thread\/start/i);
  assert.doesNotMatch(result.error ?? '', /protocol failure/i);
  assert.match(result.fix ?? '', /~\/\.codex\/sessions/);
  assert.match(result.fix ?? '', /ownership\/permissions/i);
  assert.match(result.fix ?? '', /codex login/i);
});

test('CodexAppServerSession: missing codex binary returns structured error with install guidance', async () => {
  const spawnFn: SpawnFn = () => {
    throw new Error('spawn codex ENOENT');
  };
  const session = new CodexAppServerSession(
    makeConfig('openai', true, 'app_server'),
    '/repo',
    spawnFn,
  );

  const result = await session.submitTurn('Implement the slice');
  assert.equal(result.output, '');
  assert.match(result.error ?? '', /binary missing/i);
  assert.match(result.error ?? '', /codex/i);
  assert.match(result.fix ?? '', /install Codex CLI/i);
  assert.match(result.fix ?? '', /PATH/i);
});

test('CodexAppServerSession: JSON-RPC timeout returns a structured protocol error', async () => {
  const mock = makeAppServerSpawnMock();
  const session = new CodexAppServerSession(
    makeConfig('openai', true, 'app_server'),
    '/repo',
    mock.spawnFn,
    { requestTimeoutMs: 10, turnCompletionTimeoutMs: 25 },
  );

  const resultPromise = session.submitTurn('Implement the slice');
  await new Promise((resolve) => setTimeout(resolve, 30));

  const result = await resultPromise;
  assert.equal(result.output, '');
  assert.match(result.error ?? '', /protocol failure/i);
  assert.match(result.error ?? '', /request timed out/i);
});

test('CodexAppServerSession: incomplete turn returns a structured agent execution failure', async () => {
  const mock = makeAppServerSpawnMock();
  const session = new CodexAppServerSession(
    makeConfig('openai', true, 'app_server'),
    '/repo',
    mock.spawnFn,
    { requestTimeoutMs: 25, turnCompletionTimeoutMs: 10 },
  );

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
  mock.reply({ turn: { id: 'turn-1', status: 'inProgress' } });

  const result = await turnPromise;
  assert.equal(result.output, '');
  assert.match(result.error ?? '', /agent execution failure/i);
  assert.match(result.error ?? '', /agent turn exceeded 10ms without turn\/completed/i);

  const closePromise = session.close();
  mock.reply({});
  mock.close(0);
  await closePromise;
});

test('CodexAppServerSession: incomplete turn timeout reports last observed event context', async () => {
  const mock = makeAppServerSpawnMock();
  const session = new CodexAppServerSession(
    makeConfig('openai', true, 'app_server'),
    '/repo',
    mock.spawnFn,
    { requestTimeoutMs: 25, turnCompletionTimeoutMs: 10 },
  );

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
  mock.reply({ turn: { id: 'turn-1', status: 'inProgress' } });
  mock.emitStdout({
    method: 'turn/diff/updated',
    params: { diff: { files: [{ path: 'src/provider.ts', change: 'modified' }] } },
  });

  const result = await turnPromise;
  assert.equal(result.output, '');
  assert.match(result.error ?? '', /last event was turn\/diff\/updated/i);
  assert.match(result.error ?? '', /last activity was \d+ms ago/i);

  const closePromise = session.close();
  mock.reply({});
  mock.close(0);
  await closePromise;
});

test('CodexAppServerSession: production default incomplete-turn timeout is 300 seconds', async () => {
  const mock = makeAppServerSpawnMock();
  const session = new CodexAppServerSession(
    makeConfig('openai', true, 'app_server'),
    '/repo',
    mock.spawnFn,
  );

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
  mock.reply({ turn: { id: 'turn-1', status: 'inProgress' } });
  await new Promise((resolve) => setTimeout(resolve, 20));

  const turnPending = await Promise.race([
    turnPromise.then(() => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 0)),
  ]);
  assert.equal(turnPending, true, 'expected default timeout to exceed 20ms');

  const closePromise = session.close();
  mock.reply({});
  mock.close(0);
  await closePromise;
});

test('CodexAppServerSession: malformed turn completion notification returns a structured protocol error', async () => {
  const mock = makeAppServerSpawnMock();
  const session = new CodexAppServerSession(makeConfig('openai', true, 'app_server'), '/repo', mock.spawnFn);

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
  mock.reply({ turn: { id: 'turn-1', status: 'inProgress' } });
  mock.emitStdout({ method: 'turn/completed', params: {} });

  const result = await turnPromise;
  assert.equal(result.output, '');
  assert.match(result.error ?? '', /protocol failure/i);
  assert.match(result.error ?? '', /turn\/completed notification missing turn payload/i);

  const closePromise = session.close();
  mock.reply({});
  mock.close(0);
  await closePromise;
});

test('CodexAppServerSession: subprocess termination mid-turn returns a structured transport error', async () => {
  const mock = makeAppServerSpawnMock();
  const session = new CodexAppServerSession(makeConfig('openai', true, 'app_server'), '/repo', mock.spawnFn);

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
  mock.emitStderr('transport died');
  mock.close(1);

  const result = await turnPromise;
  assert.equal(result.output, '');
  assert.match(result.error ?? '', /transport failure/i);
  assert.match(result.error ?? '', /exited before clean shutdown/i);
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
