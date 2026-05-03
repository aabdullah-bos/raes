import test from 'node:test';
import assert from 'node:assert/strict';
import { main } from '../src/cli.ts';

test('--help exits 0 and prints usage', async () => {
  const lines: string[] = [];
  const { exitCode } = await main(['--help'], { out: (l) => lines.push(l) });
  assert.equal(exitCode, 0);
  assert.ok(lines.some((l) => l.includes('Usage:')), 'expected Usage: in output');
});

test('-h exits 0 and prints usage', async () => {
  const lines: string[] = [];
  const { exitCode } = await main(['-h'], { out: (l) => lines.push(l) });
  assert.equal(exitCode, 0);
  assert.ok(lines.some((l) => l.includes('Usage:')), 'expected Usage: in output');
});

test('bare invocation exits 0 and prints usage', async () => {
  const lines: string[] = [];
  const { exitCode } = await main([], { out: (l) => lines.push(l) });
  assert.equal(exitCode, 0);
  assert.ok(lines.some((l) => l.includes('Usage:')), 'expected Usage: in output');
});

test('--version exits 0 and prints version', async () => {
  const lines: string[] = [];
  const { exitCode } = await main(['--version'], { out: (l) => lines.push(l) });
  assert.equal(exitCode, 0);
  assert.ok(lines.some((l) => /\d+\.\d+\.\d+/.test(l)), 'expected semver in output');
});

test('unknown long option exits 1 and names the bad option', async () => {
  const lines: string[] = [];
  const { exitCode } = await main(['--bogus-flag'], { err: (l) => lines.push(l) });
  assert.equal(exitCode, 1);
  assert.ok(lines.some((l) => l.includes('--bogus-flag')), 'expected bad option named in error');
});

test('unknown short option exits 1 and names the bad option', async () => {
  const lines: string[] = [];
  const { exitCode } = await main(['-z'], { err: (l) => lines.push(l) });
  assert.equal(exitCode, 1);
  assert.ok(lines.some((l) => l.includes('-z')), 'expected bad option named in error');
});

test('extra positional argument exits 1 with actionable message', async () => {
  const lines: string[] = [];
  const { exitCode } = await main(['unexpected'], { err: (l) => lines.push(l) });
  assert.equal(exitCode, 1);
  assert.ok(lines.some((l) => l.includes('unexpected')), 'expected extra arg named in error');
});

test('help output lists known options', async () => {
  const lines: string[] = [];
  await main(['--help'], { out: (l) => lines.push(l) });
  const full = lines.join('\n');
  assert.ok(full.includes('--help'), 'expected --help in output');
  assert.ok(full.includes('--version'), 'expected --version in output');
});
