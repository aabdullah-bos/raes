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
  assert.ok(result.out.includes('[diff] src/app.ts (modified)'));
});

test('createProgressRenderer: debug includes raw warnings', () => {
  const result = render([
    { kind: 'warning', text: 'raw turn/started: {"turn":{"id":"1"}}', eventType: 'turn/started', phase: 'unknown' },
    { kind: 'status', text: 'Agent turn started', eventType: 'turn/started', phase: 'turn' },
  ], 'debug');

  assert.deepEqual(result.out, ['[status] Agent turn started']);
  assert.deepEqual(result.err, ['[warning] raw turn/started: {"turn":{"id":"1"}}']);
});
