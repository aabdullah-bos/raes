import { spawn as nodeSpawn } from 'node:child_process';
import type { RaesConfig } from './config.ts';

export interface ProviderResult {
  output: string;
  error?: string;
  fix?: string;
}

export interface ProviderProgressEvent {
  kind: 'status' | 'message' | 'tool' | 'warning';
  text: string;
}

export interface ProviderHooks {
  onProgress?: (event: ProviderProgressEvent) => void;
}

export interface ProviderSession {
  submitTurn(prompt: string, hooks?: ProviderHooks): Promise<ProviderResult>;
  close(): Promise<void>;
}

export interface Provider {
  startSession(): Promise<ProviderSession>;
  submit(prompt: string, hooks?: ProviderHooks): Promise<ProviderResult>;
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

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
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

function emitProgress(hooks: ProviderHooks | undefined, event: ProviderProgressEvent): void {
  hooks?.onProgress?.(event);
}

class OneShotProviderSession implements ProviderSession {
  private closed = false;
  private runTurn: (prompt: string, hooks?: ProviderHooks) => Promise<ProviderResult>;

  constructor(runTurn: (prompt: string, hooks?: ProviderHooks) => Promise<ProviderResult>) {
    this.runTurn = runTurn;
  }

  async submitTurn(prompt: string, hooks?: ProviderHooks): Promise<ProviderResult> {
    if (this.closed) {
      return {
        output: '',
        error: 'provider session is already closed',
      };
    }
    return this.runTurn(prompt, hooks);
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

abstract class OneShotProvider implements Provider {
  async startSession(): Promise<ProviderSession> {
    return new OneShotProviderSession((prompt, hooks) => this.submit(prompt, hooks));
  }

  abstract submit(prompt: string, hooks?: ProviderHooks): Promise<ProviderResult>;
}

function parseJsonlChunk(
  chunk: string,
  buffer: string,
  onLine: (line: string) => ProviderResult | void,
): { buffer: string; result?: ProviderResult } {
  const combined = buffer + chunk;
  const lines = combined.split('\n');
  const nextBuffer = lines.pop() ?? '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const result = onLine(line);
    if (result) {
      return { buffer: nextBuffer, result };
    }
  }

  return { buffer: nextBuffer };
}

function parseTrailingJsonlBuffer(
  buffer: string,
  onLine: (line: string) => ProviderResult | void,
): ProviderResult | undefined {
  const line = buffer.trim();
  if (line.length === 0) return undefined;
  const result = onLine(line);
  return result === undefined ? undefined : result;
}

function readEventType(event: Record<string, unknown>): string | undefined {
  return readString(event['type']) ?? readString(event['event']);
}

function isCodexCompletedEvent(type: string | undefined): boolean {
  return type === 'turn/completed' || type === 'turn.completed';
}

function normalizeEventType(type: string | undefined): string | undefined {
  return type?.replace(/\//g, '.');
}

function summarizeCodexItemKind(item: Record<string, unknown> | undefined): string | undefined {
  if (!item) return undefined;
  return (
    readNonEmptyString(item['kind']) ??
    readNonEmptyString(item['type']) ??
    readNonEmptyString(item['item_type']) ??
    readNonEmptyString(item['role'])
  );
}

function summarizeCodexEvent(event: Record<string, unknown>): ProviderProgressEvent | undefined {
  const rawType = readEventType(event);
  const type = normalizeEventType(rawType);
  if (!type || isCodexCompletedEvent(rawType)) return undefined;

  const toolName =
    readNonEmptyString(event['tool_name']) ??
    readNonEmptyString(event['tool']) ??
    readNonEmptyString(event['name']) ??
    readNonEmptyString(readRecord(event['tool_call'])?.['name']) ??
    readNonEmptyString(readRecord(event['item'])?.['name']) ??
    readNonEmptyString(readRecord(event['item'])?.['tool_name']);
  if (toolName) {
    return { kind: 'tool', text: toolName };
  }

  switch (type) {
    case 'thread.started':
      return { kind: 'status', text: 'Session started' };
    case 'turn.started':
      return { kind: 'status', text: 'Agent turn started' };
    case 'turn.waiting':
      return { kind: 'status', text: 'Agent is waiting for tool results' };
    case 'turn.completed':
      return { kind: 'status', text: 'Agent turn completed' };
    case 'item.started': {
      const itemKind = summarizeCodexItemKind(readRecord(event['item']));
      if (itemKind) {
        return { kind: 'status', text: `${itemKind} started` };
      }
      return { kind: 'status', text: 'Work item started' };
    }
    case 'item.completed': {
      const itemKind = summarizeCodexItemKind(readRecord(event['item']));
      if (itemKind) {
        return { kind: 'status', text: `${itemKind} completed` };
      }
      return { kind: 'status', text: 'Work item completed' };
    }
    case 'error':
      return {
        kind: 'warning',
        text: readNonEmptyString(event['message']) ?? 'Provider reported an error event',
      };
    default:
      if (type.startsWith('message.')) {
        return { kind: 'status', text: 'Agent is generating output' };
      }
      if (type.startsWith('tool_call') || type.startsWith('tool.')) {
        return { kind: 'status', text: `Running ${type}` };
      }
      return { kind: 'status', text: `Observed ${type}` };
  }
}

function summarizeClaudeEvent(event: Record<string, unknown>): ProviderProgressEvent | undefined {
  const type = readString(event['type']);
  if (!type) return undefined;

  const toolName =
    readNonEmptyString(event['tool_name']) ??
    readNonEmptyString(event['tool']) ??
    readNonEmptyString(event['name']) ??
    readNonEmptyString(readRecord(event['tool_use'])?.['name']);
  if (toolName) {
    return { kind: 'tool', text: toolName };
  }

  switch (type) {
    case 'result':
      return undefined;
    case 'message_start':
      return { kind: 'status', text: 'Agent response started' };
    case 'message_delta':
    case 'content_block_delta':
      return { kind: 'status', text: 'Agent is generating output' };
    case 'content_block_start':
      return { kind: 'status', text: 'Agent started a new content block' };
    case 'content_block_stop':
    case 'message_stop':
      return { kind: 'status', text: 'Agent finished a response segment' };
    case 'error':
      return {
        kind: 'warning',
        text: readNonEmptyString(event['message']) ?? 'Provider reported an error event',
      };
    default:
      return { kind: 'status', text: `Observed ${type}` };
  }
}

function extractClaudeFinalText(event: Record<string, unknown>): string | undefined {
  return (
    readNonEmptyString(event['result']) ??
    readNonEmptyString(event['output_text']) ??
    readNonEmptyString(event['text']) ??
    readNonEmptyString(readRecord(event['message'])?.['text']) ??
    readNonEmptyString(readRecord(event['delta'])?.['text'])
  );
}

function extractCodexResultFromLine(line: string, hooks?: ProviderHooks): ProviderResult | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return {
      output: '',
      error: `failed to parse codex output as JSONL: ${line.slice(0, 200)}`,
    };
  }

  const event = readRecord(parsed);
  if (!event) {
    return {
      output: '',
      error: `failed to parse codex output as JSONL: ${line.slice(0, 200)}`,
    };
  }

  if (isCodexCompletedEvent(readEventType(event))) {
    return { output: extractCodexCompletedText(event) };
  }

  const progress = summarizeCodexEvent(event);
  if (progress) emitProgress(hooks, progress);
  return undefined;
}

function extractClaudeResultFromLine(
  line: string,
  hooks: ProviderHooks | undefined,
  state: { finalOutput: string },
): ProviderResult | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return {
      output: '',
      error: `failed to parse claude output as JSONL: ${line.slice(0, 200)}`,
    };
  }

  const event = readRecord(parsed);
  if (!event) {
    return {
      output: '',
      error: `failed to parse claude output as JSONL: ${line.slice(0, 200)}`,
    };
  }

  const progress = summarizeClaudeEvent(event);
  if (progress) emitProgress(hooks, progress);

  if (event['type'] === 'result') {
    state.finalOutput = extractClaudeFinalText(event) ?? state.finalOutput;
    return { output: state.finalOutput };
  }

  const finalText = extractClaudeFinalText(event);
  if (finalText) {
    state.finalOutput = finalText;
  }
  return undefined;
}

export class ClaudeCodeProvider extends OneShotProvider {
  private config: RaesConfig;
  private spawnFn: SpawnFn;

  constructor(config: RaesConfig, spawnFn?: SpawnFn) {
    super();
    this.config = config;
    this.spawnFn = spawnFn ?? (nodeSpawn as unknown as SpawnFn);
  }

  async submit(prompt: string, hooks?: ProviderHooks): Promise<ProviderResult> {
    const writeAccess = this.config.provider.sandbox?.write_access !== false;
    const args = ['-p', '--output-format', 'stream-json'];
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

      let stdoutBuffer = '';
      let stderr = '';
      const state = { finalOutput: '' };

      child.stdout.on('data', (chunk: Buffer) => {
        const parsed = parseJsonlChunk(chunk.toString(), stdoutBuffer, (line) =>
          extractClaudeResultFromLine(line, hooks, state),
        );
        stdoutBuffer = parsed.buffer;
        if (parsed.result) {
          state.finalOutput = parsed.result.output;
        }
      });
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

        const trailing = parseTrailingJsonlBuffer(stdoutBuffer, (line) =>
          extractClaudeResultFromLine(line, hooks, state),
        );
        if (trailing?.error) {
          resolve(trailing);
          return;
        }
        if (trailing?.output) {
          state.finalOutput = trailing.output;
        }
        resolve({ output: state.finalOutput });
      });
    });
  }
}

export class CodexProvider extends OneShotProvider {
  private config: RaesConfig;
  private spawnFn: SpawnFn;

  constructor(config: RaesConfig, spawnFn?: SpawnFn) {
    super();
    this.config = config;
    this.spawnFn = spawnFn ?? (nodeSpawn as unknown as SpawnFn);
  }

  async submit(prompt: string, hooks?: ProviderHooks): Promise<ProviderResult> {
    const writeAccess = this.config.provider.sandbox?.write_access !== false;
    const args = ['exec', '--json', '-'];
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

      let stdoutBuffer = '';
      let stderr = '';
      let result: ProviderResult | undefined;

      child.stdout.on('data', (chunk: Buffer) => {
        const parsed = parseJsonlChunk(chunk.toString(), stdoutBuffer, (line) =>
          extractCodexResultFromLine(line, hooks),
        );
        stdoutBuffer = parsed.buffer;
        if (parsed.result) {
          result = parsed.result;
        }
      });
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

        const trailing = parseTrailingJsonlBuffer(stdoutBuffer, (line) =>
          extractCodexResultFromLine(line, hooks),
        );
        if (trailing) {
          result = trailing;
        }
        resolve(result ?? {
          output: '',
          error: 'codex output did not include a turn/completed event',
        });
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
