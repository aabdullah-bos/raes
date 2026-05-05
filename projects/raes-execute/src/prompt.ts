import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

export interface PromptLoadError extends Error {
  fix: string;
}

export function getPromptPath(): string {
  const dir = dirname(fileURLToPath(import.meta.url));
  return join(dir, 'prompts', 'execution-loop.md');
}

export function loadPrompt(): string {
  const promptPath = getPromptPath();

  if (!existsSync(promptPath)) {
    const err = new Error(`Prompt file not found: ${promptPath}`) as PromptLoadError;
    err.fix = `Create src/prompts/execution-loop.md with the canonical RAES prompt text (raes-reference.md Section 7, "Default Prompt (canonical form)")`;
    throw err;
  }

  return readFileSync(promptPath, 'utf8');
}
