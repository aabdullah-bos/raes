import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgressRenderer } from '../src/progress-renderer.ts';
import type { ProviderProgressEvent } from '../src/provider.ts';

function render(events: ProviderProgressEvent[], verbosity: 'quiet' | 'progress' | 'debug' = 'progress'): {
  out: string[];
  err: string[];
} {
  const out: string[] = [];
  const err: string[] = [];
  const renderer = createProgressRenderer(
    {
      out: (line) => out.push(line),
      err: (line) => err.push(line),
    },
    verbosity,
  );

  for (const event of events) {
    renderer.push(event);
  }
  renderer.flush();
  return { out, err };
}

test('createProgressRenderer: quiet suppresses progress events', () => {
  const result = render([
    { kind: 'status', text: 'Session started', eventType: 'thread/started', phase: 'turn' },
    { kind: 'tool', text: 'npm test', phase: 'command', command: 'npm test', delta: 'PASS test.ts' },
    { kind: 'warning', text: 'raw turn/started: {}', eventType: 'turn/started', phase: 'unknown' },
  ], 'quiet');

  assert.deepEqual(result.out, []);
  assert.deepEqual(result.err, []);
});

test('createProgressRenderer: progress suppresses raw warnings and low-value lifecycle noise', () => {
  const result = render([
    { kind: 'warning', text: 'raw thread/started: {}', eventType: 'thread/started', phase: 'unknown' },
    { kind: 'status', text: 'user_message started', eventType: 'item/started', phase: 'item', item: { kind: 'user_message' } },
    { kind: 'status', text: 'reasoning completed', eventType: 'item/completed', phase: 'item', item: { kind: 'reasoning' } },
    { kind: 'message', text: 'Agent message delta received', eventType: 'item/agentMessage/delta', phase: 'message' },
    { kind: 'status', text: 'Session started', eventType: 'thread/started', phase: 'turn' },
    { kind: 'status', text: 'MCP codex_apps ready', eventType: 'mcpServer/startupStatus/updated', phase: 'unknown' },
    { kind: 'tool', text: 'npm test', phase: 'command', command: 'npm test', delta: 'PASS test.ts' },
    { kind: 'status', text: 'file_change completed', eventType: 'item/completed', phase: 'diff', item: { kind: 'file_change' }, files: [{ path: 'src/app.ts', kind: 'modified' }] },
  ], 'progress');

  assert.deepEqual(result.err, []);
  assert.ok(!result.out.some((line) => line.includes('raw thread/started')));
  assert.ok(!result.out.some((line) => line.includes('user_message started')));
  assert.ok(!result.out.some((line) => line.includes('reasoning completed')));
  assert.ok(!result.out.some((line) => line.includes('Agent message delta received')));
  assert.ok(result.out.includes('[status] Session started'));
  assert.ok(result.out.includes('[status] MCP codex_apps ready'));
  assert.ok(result.out.includes('[tool] npm test'));
  assert.ok(result.out.includes('[diff] Updated src/app.ts'));
});

test('createProgressRenderer: debug includes raw warnings', () => {
  const result = render([
    { kind: 'warning', text: 'raw turn/started: {"turn":{"id":"1"}}', eventType: 'turn/started', phase: 'unknown' },
    { kind: 'status', text: 'Agent turn started', eventType: 'turn/started', phase: 'turn' },
  ], 'debug');

  assert.deepEqual(result.out, ['[status] Agent turn started']);
  assert.deepEqual(result.err, ['[warning] raw turn/started: {"turn":{"id":"1"}}']);
});

test('createProgressRenderer: progress renders only substantive agent-message deltas', () => {
  const result = render([
    { kind: 'message', text: '   ', eventType: 'item/agentMessage/delta', phase: 'message', delta: '   ' },
    { kind: 'message', text: '...', eventType: 'item/agentMessage/delta', phase: 'message', delta: '...' },
    {
      kind: 'message',
      text: 'Updated the failing renderer assertions and started the implementation.',
      eventType: 'item/agentMessage/delta',
      phase: 'message',
      delta: 'Updated the failing renderer assertions and started the implementation.',
    },
  ], 'progress');

  assert.deepEqual(result.err, []);
  assert.deepEqual(result.out, ['[message] Updated the failing renderer assertions and started the implementation.']);
});

test('createProgressRenderer: progress groups reasoning summary deltas into a readable summary', () => {
  const result = render([
    { kind: 'status', text: 'reasoning started', eventType: 'item/started', phase: 'item', item: { id: 'item-1', kind: 'reasoning' } },
    {
      kind: 'message',
      text: 'Inspecting the current renderer behavior.',
      eventType: 'item/reasoning/summaryTextDelta',
      phase: 'reasoning',
      item: { id: 'item-1', kind: 'reasoning' },
      delta: 'Inspecting the current renderer behavior.',
    },
    {
      kind: 'message',
      text: 'Planning concise operator summaries for command failures and diffs.',
      eventType: 'item/reasoning/summaryTextDelta',
      phase: 'reasoning',
      item: { id: 'item-1', kind: 'reasoning' },
      delta: 'Planning concise operator summaries for command failures and diffs.',
    },
    { kind: 'status', text: 'reasoning completed', eventType: 'item/completed', phase: 'item', item: { id: 'item-1', kind: 'reasoning' } },
  ], 'progress');

  assert.deepEqual(result.err, []);
  assert.deepEqual(result.out, [
    '[reasoning] Inspecting the current renderer behavior. Planning concise operator summaries for command failures and diffs.',
  ]);
});

test('createProgressRenderer: progress summarizes failed commands concisely', () => {
  const result = render([
    {
      kind: 'status',
      text: 'command_execution started',
      eventType: 'item/started',
      phase: 'command',
      item: { kind: 'command_execution', command: 'npm test', status: 'inProgress' },
      command: 'npm test',
    },
    {
      kind: 'tool',
      text: 'npm test',
      eventType: 'item/commandExecution/outputDelta',
      phase: 'command',
      item: { kind: 'command_execution', command: 'npm test' },
      command: 'npm test',
      delta: 'FAIL src/example.test.ts\n',
    },
    {
      kind: 'status',
      text: 'command_execution completed',
      eventType: 'item/completed',
      phase: 'command',
      item: { kind: 'command_execution', command: 'npm test', status: 'completed', exitCode: 1 },
      command: 'npm test',
    },
  ], 'progress');

  assert.deepEqual(result.err, []);
  assert.deepEqual(result.out, ['[tool] Command failed: npm test (exit 1) - FAIL src/example.test.ts']);
});

test('createProgressRenderer: progress summarizes diff activity concisely', () => {
  const result = render([
    {
      kind: 'status',
      text: 'file_change completed',
      eventType: 'item/completed',
      phase: 'diff',
      item: {
        kind: 'file_change',
        status: 'completed',
        changes: [
          { path: 'src/provider.ts', kind: 'modified' },
          { path: 'src/progress-renderer.ts', kind: 'modified' },
          { path: 'tests/progress-renderer.test.ts', kind: 'modified' },
        ],
      },
      files: [
        { path: 'src/provider.ts', kind: 'modified' },
        { path: 'src/progress-renderer.ts', kind: 'modified' },
        { path: 'tests/progress-renderer.test.ts', kind: 'modified' },
      ],
    },
  ], 'progress');

  assert.deepEqual(result.err, []);
  assert.deepEqual(result.out, ['[diff] Updated src/provider.ts, src/progress-renderer.ts, and 1 more file']);
});

test('createProgressRenderer: progress summarizes read-heavy commands by operator intent', () => {
  const result = render([
    { kind: 'status', text: 'Session started', eventType: 'thread/started', phase: 'turn' },
    {
      kind: 'status',
      text: 'command_execution completed',
      eventType: 'item/completed',
      phase: 'command',
      item: { kind: 'command_execution', command: '/bin/zsh -lc pwd', status: 'completed', exitCode: 0 },
      command: '/bin/zsh -lc pwd',
    },
    {
      kind: 'status',
      text: 'command_execution completed',
      eventType: 'item/completed',
      phase: 'command',
      item: { kind: 'command_execution', command: '/bin/zsh -lc \'rg -n --no-heading "" docs/prd.md\'', status: 'completed', exitCode: 0 },
      command: '/bin/zsh -lc \'rg -n --no-heading "" docs/prd.md\'',
    },
    {
      kind: 'status',
      text: 'command_execution completed',
      eventType: 'item/completed',
      phase: 'command',
      item: { kind: 'command_execution', command: '/bin/zsh -lc "sed -n \'1,260p\' src/provider.ts"', status: 'completed', exitCode: 0 },
      command: '/bin/zsh -lc "sed -n \'1,260p\' src/provider.ts"',
    },
    {
      kind: 'status',
      text: 'command_execution completed',
      eventType: 'item/completed',
      phase: 'command',
      item: { kind: 'command_execution', command: '/bin/zsh -lc "sed -n \'1,260p\' tests/provider.test.ts"', status: 'completed', exitCode: 0 },
      command: '/bin/zsh -lc "sed -n \'1,260p\' tests/provider.test.ts"',
    },
    {
      kind: 'status',
      text: 'command_execution completed',
      eventType: 'item/completed',
      phase: 'command',
      item: { kind: 'command_execution', command: '/bin/zsh -lc \'git status --short\'', status: 'completed', exitCode: 0 },
      command: '/bin/zsh -lc \'git status --short\'',
    },
  ], 'progress');

  assert.deepEqual(result.err, []);
  assert.deepEqual(result.out, [
    '[status] Session started',
    '[status] Inspecting workspace layout',
    '[status] Reading project guidance and pipeline',
    '[status] Inspecting implementation',
    '[status] Reviewing test coverage',
    '[status] Reviewing repository status',
  ]);
});

test('createProgressRenderer: debug keeps raw command details for read-heavy commands', () => {
  const result = render([
    {
      kind: 'status',
      text: 'command_execution completed',
      eventType: 'item/completed',
      phase: 'command',
      item: { kind: 'command_execution', command: '/bin/zsh -lc "sed -n \'1,260p\' src/provider.ts"', status: 'completed', exitCode: 0 },
      command: '/bin/zsh -lc "sed -n \'1,260p\' src/provider.ts"',
    },
  ], 'debug');

  assert.deepEqual(result.err, []);
  assert.deepEqual(result.out, [
    '[tool] /bin/zsh -lc "sed -n \'1,260p\' src/provider.ts"',
    '  command: /bin/zsh -lc "sed -n \'1,260p\' src/provider.ts"',
    '  status: completed',
    '  exit: 0',
  ]);
});
