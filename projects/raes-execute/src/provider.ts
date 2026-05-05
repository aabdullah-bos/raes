import { spawn as nodeSpawn } from 'node:child_process';
import type { RaesConfig } from './config.ts';

export interface ProviderResult {
  output: string;
  error?: string;
  fix?: string;
}

export interface Provider {
  submit(prompt: string): Promise<ProviderResult>;
}

export type SpawnFn = (
  cmd: string,
  args: string[],
) => {
  stdin: { write(d: string): unknown; end(): void } | null;
  stdout: { on(event: 'data', cb: (chunk: Buffer) => void): unknown } | null;
  stderr: { on(event: 'data', cb: (chunk: Buffer) => void): unknown } | null;
  on(event: 'close', cb: (code: number | null) => void): unknown;
};

const AUTH_ERROR_RE = /not logged in|unauthorized|unauthenticated|authentication|login required|auth failed|authentication failed/i;

function extractClaudeResult(stdout: string): ProviderResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return {
      output: '',
      error: `failed to parse claude output as JSON: ${stdout.slice(0, 200)}`,
    };
  }

  const text =
    parsed !== null &&
    typeof parsed === 'object' &&
    'result' in parsed &&
    typeof (parsed as Record<string, unknown>)['result'] === 'string'
      ? (parsed as Record<string, unknown>)['result'] as string
      : '';

  return { output: text };
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function extractCodexCompletedText(event: Record<string, unknown>): string {
  const direct =
    readString(event['output_text']) ??
    readString(event['result']) ??
    readString(event['text']);
  if (direct !== undefined) return direct;

  const turn = event['turn'];
  if (turn !== null && typeof turn === 'object') {
    const turnRecord = turn as Record<string, unknown>;
    const nested =
      readString(turnRecord['output_text']) ??
      readString(turnRecord['result']) ??
      readString(turnRecord['text']);
    if (nested !== undefined) return nested;
  }

  return '';
}

function extractCodexResult(stdout: string): ProviderResult {
  const lines = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return {
        output: '',
        error: `failed to parse codex output as JSONL: ${line.slice(0, 200)}`,
      };
    }

    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      (parsed as Record<string, unknown>)['type'] === 'turn/completed'
    ) {
      return { output: extractCodexCompletedText(parsed as Record<string, unknown>) };
    }
  }

  return {
    output: '',
    error: 'codex output did not include a turn/completed event',
  };
}

export class ClaudeCodeProvider implements Provider {
  private config: RaesConfig;
  private spawnFn: SpawnFn;

  constructor(config: RaesConfig, spawnFn?: SpawnFn) {
    this.config = config;
    this.spawnFn = spawnFn ?? (nodeSpawn as unknown as SpawnFn);
  }

  async submit(prompt: string): Promise<ProviderResult> {
    const writeAccess = this.config.provider.sandbox?.write_access !== false;
    const args = ['-p', '--output-format', 'json'];
    if (writeAccess) {
      args.push('--allowedTools', 'Edit,Write,Read');
    }

    return new Promise((resolve) => {
      const child = this.spawnFn('claude', args);

      if (!child.stdin || !child.stdout || !child.stderr) {
        resolve({
          output: '',
          error: 'Failed to spawn claude subprocess: stdio streams unavailable',
        });
        return;
      }

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      child.stdin.write(prompt);
      child.stdin.end();

      child.on('close', (code: number | null) => {
        if (code !== 0) {
          const isAuthError = AUTH_ERROR_RE.test(stderr);
          if (isAuthError) {
            resolve({
              output: '',
              error: `claude subprocess exited with code ${code ?? 'null'}. ${stderr.trim()}`,
              fix: 'Run `claude login` to authenticate before using the anthropic provider.',
            });
          } else {
            resolve({
              output: '',
              error: `claude subprocess exited with code ${code ?? 'null'}${stderr ? `. stderr: ${stderr}` : ''}`,
            });
          }
          return;
        }

        resolve(extractClaudeResult(stdout));
      });
    });
  }
}

export class CodexProvider implements Provider {
  private config: RaesConfig;
  private spawnFn: SpawnFn;

  constructor(config: RaesConfig, spawnFn?: SpawnFn) {
    this.config = config;
    this.spawnFn = spawnFn ?? (nodeSpawn as unknown as SpawnFn);
  }

  async submit(prompt: string): Promise<ProviderResult> {
    const writeAccess = this.config.provider.sandbox?.write_access !== false;
    const args = ['exec', '-'];
    if (writeAccess) {
      args.push('--sandbox', 'workspace-write');
    }

    return new Promise((resolve) => {
      const child = this.spawnFn('codex', args);

      if (!child.stdin || !child.stdout || !child.stderr) {
        resolve({
          output: '',
          error: 'Failed to spawn codex subprocess: stdio streams unavailable',
        });
        return;
      }

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      child.stdin.write(prompt);
      child.stdin.end();

      child.on('close', (code: number | null) => {
        if (code !== 0) {
          const isAuthError = AUTH_ERROR_RE.test(stderr);
          if (isAuthError) {
            resolve({
              output: '',
              error: `codex subprocess exited with code ${code ?? 'null'}. ${stderr.trim()}`,
              fix: 'Run `codex login` to authenticate before using the openai provider.',
            });
          } else {
            resolve({
              output: '',
              error: `codex subprocess exited with code ${code ?? 'null'}${stderr ? `. stderr: ${stderr}` : ''}`,
            });
          }
          return;
        }

        resolve(extractCodexResult(stdout));
      });
    });
  }
}

export function createProvider(config: RaesConfig): Provider {
  switch (config.provider.name) {
    case 'anthropic':
      return new ClaudeCodeProvider(config);
    case 'openai':
      return new CodexProvider(config);
    default:
      throw new Error(`unknown provider: ${(config.provider as { name?: string }).name ?? '(missing)'}`);
  }
}
