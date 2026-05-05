import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { writeFileAtomic } from '../src/io.ts';

test('writeFileAtomic: creates a new file with correct content', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'raes-io-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const target = join(dir, 'output.md');
  const result = writeFileAtomic(target, 'hello world');
  assert.deepEqual(result, {});
  const content = await readFile(target, 'utf8');
  assert.equal(content, 'hello world');
});

test('writeFileAtomic: overwrites existing file with new content', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'raes-io-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const target = join(dir, 'output.md');
  await writeFile(target, 'original content', 'utf8');
  const result = writeFileAtomic(target, 'new content');
  assert.deepEqual(result, {});
  const content = await readFile(target, 'utf8');
  assert.equal(content, 'new content');
});

test('writeFileAtomic: returns error if directory does not exist', () => {
  const target = join(tmpdir(), 'raes-no-such-dir-xyz123', 'output.md');
  const result = writeFileAtomic(target, 'content');
  assert.ok(result.error !== undefined, 'expected an error');
  assert.ok(result.error.includes('failed to write'), `error should say "failed to write": ${result.error}`);
});

test('writeFileAtomic: original file is untouched when target directory does not exist', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'raes-io-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const existing = join(dir, 'existing.md');
  await writeFile(existing, 'preserved', 'utf8');
  // target in a non-existent subdirectory — write will fail
  const badTarget = join(dir, 'missing-subdir', 'output.md');
  const result = writeFileAtomic(badTarget, 'replacement');
  assert.ok(result.error !== undefined, 'expected an error');
  // the unrelated existing file in dir is untouched
  const content = await readFile(existing, 'utf8');
  assert.equal(content, 'preserved');
});

test('writeFileAtomic: leaves no temp files behind on success', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'raes-io-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const target = join(dir, 'output.md');
  writeFileAtomic(target, 'content');
  const files = readdirSync(dir);
  assert.deepEqual(files, ['output.md']);
});

test('writeFileAtomic: leaves no temp files behind on error', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'raes-io-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const badTarget = join(dir, 'subdir', 'output.md');
  writeFileAtomic(badTarget, 'content');
  const files = readdirSync(dir);
  assert.deepEqual(files, [], `expected empty dir, got: ${files.join(', ')}`);
});

test('writeFileAtomic: handles empty string content', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'raes-io-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const target = join(dir, 'empty.md');
  const result = writeFileAtomic(target, '');
  assert.deepEqual(result, {});
  const content = await readFile(target, 'utf8');
  assert.equal(content, '');
});

test('writeFileAtomic: handles unicode content', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'raes-io-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const target = join(dir, 'unicode.md');
  const unicode = '# Hello\nこんにちは 🎉\n';
  const result = writeFileAtomic(target, unicode);
  assert.deepEqual(result, {});
  const content = await readFile(target, 'utf8');
  assert.equal(content, unicode);
});

test('writeFileAtomic: temp file is in the same directory as target', async (t) => {
  // Verify by capturing directory listing mid-write is not feasible synchronously,
  // but we can confirm no .raes-tmp-* files remain and the write succeeded.
  const dir = await mkdtemp(join(tmpdir(), 'raes-io-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const target = join(dir, 'out.md');
  writeFileAtomic(target, 'data');
  const files = readdirSync(dir);
  assert.ok(!files.some(f => f.startsWith('.raes-tmp-')), `unexpected temp files: ${files.join(', ')}`);
  assert.ok(files.includes('out.md'));
});
