import { spawn as nodeSpawn } from 'node:child_process';
import type { RaesConfig } from './config.ts';

export interface ProviderResult {
  output: string;
  error?: string;
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

export class ClaudeCodeProvider implements Provider {
  private config: RaesConfig;
  private spawnFn: SpawnFn;

  constructor(config: RaesConfig, spawnFn?: SpawnFn) {
    this.config = config;
    this.spawnFn = spawnFn ?? (nodeSpawn as unknown as SpawnFn);
  }

  async submit(prompt: string): Promise<ProviderResult> {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) {
      return {
        output: '',
        error:
          'ANTHROPIC_API_KEY is not set — set it in your environment before running raes-execute.',
      };
    }

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
          resolve({
            output: '',
            error: `claude subprocess exited with code ${code ?? 'null'}${stderr ? `. stderr: ${stderr}` : ''}`,
          });
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(stdout);
        } catch {
          resolve({
            output: '',
            error: `failed to parse claude output as JSON: ${stdout.slice(0, 200)}`,
          });
          return;
        }

        const text =
          parsed !== null &&
          typeof parsed === 'object' &&
          'result' in parsed &&
          typeof (parsed as Record<string, unknown>)['result'] === 'string'
            ? (parsed as Record<string, unknown>)['result'] as string
            : '';

        resolve({ output: text });
      });
    });
  }
}
