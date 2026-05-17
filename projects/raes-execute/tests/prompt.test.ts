import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

import { loadPrompt } from '../src/prompt.ts';

test('execution-loop.md: file exists', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const promptPath = join(dir, '..', 'src', 'prompts', 'execution-loop.md');
  assert.ok(existsSync(promptPath), `prompt file not found: ${promptPath}`);
});

test('execution-loop.md: file is non-empty', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const promptPath = join(dir, '..', 'src', 'prompts', 'execution-loop.md');
  const content = readFileSync(promptPath, 'utf8');
  assert.ok(content.length > 0, 'prompt file is empty');
});

test('loadPrompt: returns string containing EXECUTION SLICE section header', () => {
  const prompt = loadPrompt();
  assert.ok(typeof prompt === 'string', 'loadPrompt should return a string');
  assert.ok(prompt.includes('EXECUTION SLICE'), 'prompt should contain EXECUTION SLICE section header');
});

test('loadPrompt: returns string containing REVIEW SLICE section header', () => {
  const prompt = loadPrompt();
  assert.ok(prompt.includes('REVIEW SLICE'), 'prompt should contain REVIEW SLICE section header');
});

test('loadPrompt: contains "In either case" rules block', () => {
  const prompt = loadPrompt();
  assert.ok(prompt.includes('In either case'));
});
