import type { RaesConfig } from './config.ts';
import { loadAllArtifacts, validateBoundaries } from './artifacts.ts';
import { loadPrompt, type PromptLoadError } from './prompt.ts';

export interface SlicePreflightOk {
  ok: true;
  prompt: string;
}

export interface SlicePreflightError {
  ok: false;
  errors: string[];
}

export type SlicePreflightResult = SlicePreflightOk | SlicePreflightError;

export function runSlicePreflight(
  config: RaesConfig,
  cwd: string,
  readPrompt: () => string = loadPrompt,
): SlicePreflightResult {
  const { artifacts, errors: loadErrors } = loadAllArtifacts(config, cwd);
  if (loadErrors.length > 0 || !artifacts) {
    return {
      ok: false,
      errors: loadErrors.map((error) => `error: ${error}`),
    };
  }

  const violations = validateBoundaries(artifacts);
  if (violations.length > 0) {
    const errors = ['error: artifact boundary violations detected — execution halted'];
    for (const violation of violations) {
      errors.push(`  artifact: ${violation.path} [${violation.role}]`);
      errors.push(`  issue:    ${violation.issue}`);
      errors.push(`  evidence: ${violation.evidence}`);
      errors.push('');
    }
    return { ok: false, errors };
  }

  try {
    return {
      ok: true,
      prompt: readPrompt(),
    };
  } catch (error) {
    const lines = [`error: ${(error as Error).message}`];
    const fix = (error as Partial<PromptLoadError>).fix;
    if (typeof fix === 'string' && fix.length > 0) {
      lines.push(`fix: ${fix}`);
    }
    return { ok: false, errors: lines };
  }
}
