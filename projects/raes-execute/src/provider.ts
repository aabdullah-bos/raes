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
  eventType?: string;
  phase?: 'turn' | 'item' | 'message' | 'reasoning' | 'command' | 'plan' | 'diff' | 'unknown';
  item?: {
    id?: string;
    kind?: string;
    command?: string;
    cwd?: string;
    status?: string;
    exitCode?: number;
    durationMs?: number;
    changes?: Array<Record<string, unknown>>;
  };
  command?: string;
  delta?: string;
  plan?: Array<Record<string, unknown>>;
  files?: Array<Record<string, unknown>>;
}

export interface ProviderHooks {
  onProgress?: (event: ProviderProgressEvent) => void;
  rawEvents?: boolean;
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

interface SpawnedProcess {
  stdin: { write(d: string): unknown; end(): void } | null;
  stdout: { on(event: 'data', cb: (chunk: Buffer) => void): unknown } | null;
  stderr: { on(event: 'data', cb: (chunk: Buffer) => void): unknown } | null;
  on(event: 'close', cb: (code: number | null) => void): unknown;
}

interface PendingRequest {
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

interface CodexAppServerSessionOptions {
  requestTimeoutMs?: number;
  turnCompletionTimeoutMs?: number;
}

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

function readArray(value: unknown): Array<Record<string, unknown>> | undefined {
  if (!Array.isArray(value)) return undefined;
  const records = value
    .map((entry) => readRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== undefined);
  return records.length > 0 ? records : undefined;
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

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatCodexAppServerError(error: unknown): ProviderResult {
  const message = toErrorMessage(error);
  if (AUTH_ERROR_RE.test(message)) {
    return {
      output: '',
      error: `codex app-server authentication failure: ${message}`,
      fix: 'Run `codex login` to authenticate before using the openai provider.',
    };
  }
  if (message.includes('failed to parse codex app-server output as JSONL')) {
    return {
      output: '',
      error: `codex app-server protocol failure: ${message}`,
    };
  }
  if (message.includes('notification missing') || message.includes('request timed out:')) {
    return {
      output: '',
      error: `codex app-server protocol failure: ${message}`,
    };
  }
  if (message.includes('request failed:')) {
    return {
      output: '',
      error: `codex app-server protocol failure: ${message}`,
    };
  }
  if (message.includes('incomplete turn')) {
    return {
      output: '',
      error: `codex app-server agent execution failure: ${message}`,
    };
  }
  if (message.includes('turn failed')) {
    return {
      output: '',
      error: `codex app-server agent execution failure: ${message}`,
    };
  }
  if (message.includes('exited before clean shutdown')) {
    return {
      output: '',
      error: `codex app-server transport failure: ${message}`,
    };
  }
  return {
    output: '',
    error: `codex app-server transport startup failure: ${message}`,
  };
}

function makeAppServerPayloadError(line: string): ProviderResult {
  return {
    output: '',
    error: `codex app-server protocol failure: failed to parse codex app-server output as JSONL: ${line.slice(0, 200)}`,
  };
}

function readJsonRpcId(value: unknown): string | number | undefined {
  return typeof value === 'string' || typeof value === 'number' ? value : undefined;
}

function readJsonRpcError(value: unknown): { code?: number; message: string } | undefined {
  const record = readRecord(value);
  const message = readString(record?.['message']);
  if (!message) return undefined;
  const code = typeof record?.['code'] === 'number' ? record['code'] as number : undefined;
  return { code, message };
}

function extractTurnRecord(params: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  return readRecord(params?.['turn']);
}

function extractThreadRecord(params: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  return readRecord(params?.['thread']);
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

export class CodexAppServerSession implements ProviderSession {
  private static readonly DEFAULT_REQUEST_TIMEOUT_MS = 5_000;
  private static readonly DEFAULT_TURN_COMPLETION_TIMEOUT_MS = 120_000;

  private config: RaesConfig;
  private cwd: string;
  private spawnFn: SpawnFn;
  private requestTimeoutMs: number;
  private turnCompletionTimeoutMs: number;
  private child: SpawnedProcess | null = null;
  private nextRequestId = 1;
  private stdoutBuffer = '';
  private stderr = '';
  private pendingRequests = new Map<string | number, PendingRequest>();
  private threadId: string | undefined;
  private started = false;
  private startPromise: Promise<void> | null = null;
  private closed = false;
  private closePromise: Promise<void> | null = null;
  private activeTurn:
    | {
        hooks?: ProviderHooks;
        resolve: (value: ProviderResult) => void;
        reject: (error: Error) => void;
        done: boolean;
        timeout?: NodeJS.Timeout;
      }
    | undefined;

  constructor(config: RaesConfig, cwd: string, spawnFn?: SpawnFn, options: CodexAppServerSessionOptions = {}) {
    this.config = config;
    this.cwd = cwd;
    this.spawnFn = spawnFn ?? (nodeSpawn as unknown as SpawnFn);
    this.requestTimeoutMs = options.requestTimeoutMs ?? CodexAppServerSession.DEFAULT_REQUEST_TIMEOUT_MS;
    this.turnCompletionTimeoutMs =
      options.turnCompletionTimeoutMs ?? CodexAppServerSession.DEFAULT_TURN_COMPLETION_TIMEOUT_MS;
  }

  async start(): Promise<void> {
    if (this.closed) {
      throw new Error('provider session is already closed');
    }
    if (this.started) return;
    if (this.startPromise) return this.startPromise;

    this.startPromise = this.startInternal();
    try {
      await this.startPromise;
      this.started = true;
    } finally {
      this.startPromise = null;
    }
  }

  async submitTurn(prompt: string, hooks?: ProviderHooks): Promise<ProviderResult> {
    if (this.closed) {
      return {
        output: '',
        error: 'provider session is already closed',
      };
    }

    try {
      await this.start();
    } catch (error) {
      return formatCodexAppServerError(error);
    }

    if (!this.threadId) {
      return {
        output: '',
        error: 'codex app-server session did not return a thread id',
      };
    }

    return new Promise<ProviderResult>((resolve, reject) => {
      this.activeTurn = {
        hooks,
        resolve,
        reject,
        done: false,
        timeout: setTimeout(() => {
          this.finishActiveTurnWithError(
            new Error(
              `incomplete turn: timed out waiting for turn/completed after ${this.turnCompletionTimeoutMs}ms`,
            ),
          );
        }, this.turnCompletionTimeoutMs),
      };

      const params: Record<string, unknown> = {
        threadId: this.threadId,
        input: [{ type: 'text', text: prompt }],
        cwd: this.cwd,
      };
      if (this.config.provider.model) {
        params['model'] = this.config.provider.model;
      }
      if (this.config.provider.sandbox?.write_access !== false) {
        params['sandboxPolicy'] = {
          type: 'workspaceWrite',
        };
      }

      this.sendRequest('turn/start', params).catch((error) => {
        this.finishActiveTurnWithError(error);
      });
    });
  }

  async close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.closed = true;

    if (!this.child) {
      this.closePromise = Promise.resolve();
      return this.closePromise;
    }

    this.closePromise = (async () => {
      if (this.threadId) {
        await this.sendRequest('thread/unsubscribe', { threadId: this.threadId });
      }
      this.child?.stdin?.end();
      await new Promise<void>((resolve, reject) => {
        const currentChild = this.child;
        if (!currentChild) {
          resolve();
          return;
        }

        const existing = currentChild;
        existing.on('close', (code) => {
          this.child = null;
          if (code === 0 || code === null) {
            resolve();
            return;
          }
          reject(new Error(
            `codex app-server exited before clean shutdown (code ${code})${this.stderr ? `: ${this.stderr.trim()}` : ''}`,
          ));
        });
      });
    })();

    return this.closePromise;
  }

  private async startInternal(): Promise<void> {
    const child = this.spawnFn('codex', ['app-server', '--listen', 'stdio://']) as SpawnedProcess;
    this.child = child;

    if (!child.stdin || !child.stdout || !child.stderr) {
      throw new Error('Failed to spawn codex app-server subprocess: stdio streams unavailable');
    }

    child.stdout.on('data', (chunk: Buffer) => {
      const parsed = parseJsonlChunk(chunk.toString(), this.stdoutBuffer, (line) =>
        this.handleJsonRpcLine(line),
      );
      this.stdoutBuffer = parsed.buffer;
      if (parsed.result) {
        this.resolveMalformedPayload(parsed.result);
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      this.stderr += chunk.toString();
    });
    child.on('close', (code: number | null) => {
      this.handleProcessClose(code);
    });

    await this.sendRequest('initialize', {
      clientInfo: {
        name: 'raes-execute',
        title: 'RAES Execute',
        version: '0.1.0',
      },
    });
    this.sendNotification('initialized', {});
    const threadResult = await this.sendRequest('thread/start', {
      cwd: this.cwd,
      ephemeral: true,
    });
    const resultThread = extractThreadRecord(threadResult);
    this.threadId = readNonEmptyString(resultThread?.['id']) ?? this.threadId;
    if (!this.threadId) {
      throw new Error('codex app-server thread/start did not return a thread id');
    }
  }

  private sendNotification(method: string, params: Record<string, unknown>): void {
    this.writeMessage({ method, params });
  }

  private sendRequest(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this.child?.stdin) {
      return Promise.reject(new Error('codex app-server subprocess is not available'));
    }

      const id = this.nextRequestId++;
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`request timed out: ${method} after ${this.requestTimeoutMs}ms`));
      }, this.requestTimeoutMs);
      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeout,
      });
      this.writeMessage({ id, method, params });
    });
  }

  private writeMessage(message: Record<string, unknown>): void {
    this.child?.stdin?.write(`${JSON.stringify(message)}\n`);
  }

  private handleJsonRpcLine(line: string): ProviderResult | void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return makeAppServerPayloadError(line);
    }

    const message = readRecord(parsed);
    if (!message) {
      return makeAppServerPayloadError(line);
    }

    const id = readJsonRpcId(message['id']);
    const method = readString(message['method']);
    if (id !== undefined) {
      const pending = this.pendingRequests.get(id);
      if (!pending) return undefined;
      this.pendingRequests.delete(id);
      clearTimeout(pending.timeout);

      const error = readJsonRpcError(message['error']);
      if (error) {
        pending.reject(new Error(`codex app-server ${method ?? 'request'} failed: ${error.message}`));
        return undefined;
      }

      const result = readRecord(message['result']) ?? {};
      pending.resolve(result);
      return undefined;
    }

    if (!method) return undefined;
    const params = readRecord(message['params']);
    this.handleNotification(method, params);
    return undefined;
  }

  private handleNotification(method: string, params: Record<string, unknown> | undefined): void {
    if (method === 'thread/started' && !this.threadId) {
      this.threadId = readNonEmptyString(extractThreadRecord(params)?.['id']) ?? this.threadId;
    }

    if (!this.activeTurn || this.activeTurn.done) {
      return;
    }

    if (shouldEmitRawEvents(this.activeTurn.hooks)) {
      emitProgress(this.activeTurn.hooks, makeRawNotificationDebugEvent(method, params));
    }

    if (method === 'turn/completed') {
      const turn = extractTurnRecord(params);
      if (!turn) {
        this.finishActiveTurnWithError(new Error('turn/completed notification missing turn payload'));
        return;
      }
      const status = readNonEmptyString(turn?.['status']) ?? 'completed';
      if (status === 'failed') {
        const message =
          readNonEmptyString(readRecord(turn?.['error'])?.['message']) ??
          'codex app-server turn failed';
        this.finishActiveTurn({ output: '', error: message });
        return;
      }
      this.finishActiveTurn({ output: extractCodexCompletedText(turn ?? {}) });
      return;
    }

    const progress = normalizeAppServerEvent({ type: method, ...(params ?? {}) });
    if (progress) {
      emitProgress(this.activeTurn.hooks, progress);
    }
  }

  private resolveMalformedPayload(result: ProviderResult): void {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(result.error ?? 'codex app-server emitted malformed output'));
    }
    this.pendingRequests.clear();

    if (this.activeTurn && !this.activeTurn.done) {
      this.finishActiveTurn(result);
    }
  }

  private finishActiveTurn(result: ProviderResult): void {
    if (!this.activeTurn || this.activeTurn.done) return;
    this.activeTurn.done = true;
    if (this.activeTurn.timeout) {
      clearTimeout(this.activeTurn.timeout);
    }
    this.activeTurn.resolve(result);
    this.activeTurn = undefined;
  }

  private finishActiveTurnWithError(error: unknown): void {
    if (!this.activeTurn || this.activeTurn.done) return;
    this.activeTurn.done = true;
    if (this.activeTurn.timeout) {
      clearTimeout(this.activeTurn.timeout);
    }
    this.activeTurn.resolve(formatCodexAppServerError(error));
    this.activeTurn = undefined;
  }

  private handleProcessClose(code: number | null): void {
    if (this.child === null) return;
    this.child = null;

    const error = new Error(
      `codex app-server exited before clean shutdown (code ${code ?? 'null'})${this.stderr ? `: ${this.stderr.trim()}` : ''}`,
    );

    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();

    if (this.activeTurn && !this.activeTurn.done) {
      this.finishActiveTurn(formatCodexAppServerError(error));
    }
  }
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
  const rawKind = (
    readNonEmptyString(item['kind']) ??
    readNonEmptyString(item['type']) ??
    readNonEmptyString(item['item_type']) ??
    readNonEmptyString(item['role'])
  );
  if (!rawKind) return undefined;

  switch (rawKind) {
    case 'agentMessage':
      return 'agent_message';
    case 'userMessage':
      return 'user_message';
    case 'commandExecution':
      return 'command_execution';
    case 'fileChange':
      return 'file_change';
    case 'contextCompaction':
      return 'context_compaction';
    default:
      return rawKind;
  }
}

function extractProgressItem(item: Record<string, unknown> | undefined): ProviderProgressEvent['item'] | undefined {
  if (!item) return undefined;

  const id = readNonEmptyString(item['id']);
  const kind = summarizeCodexItemKind(item);
  const command = readNonEmptyString(item['command']);
  const cwd = readNonEmptyString(item['cwd']);
  const status = readNonEmptyString(item['status']);
  const exitCode = typeof item['exitCode'] === 'number' ? item['exitCode'] : undefined;
  const durationMs = typeof item['durationMs'] === 'number' ? item['durationMs'] : undefined;
  const changes = readArray(item['changes']);
  if (!id && !kind && !command && !cwd && !status && exitCode === undefined && durationMs === undefined && !changes) {
    return undefined;
  }

  return {
    ...(id ? { id } : {}),
    ...(kind ? { kind } : {}),
    ...(command ? { command } : {}),
    ...(cwd ? { cwd } : {}),
    ...(status ? { status } : {}),
    ...(exitCode !== undefined ? { exitCode } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(changes ? { changes } : {}),
  };
}

function extractDeltaText(event: Record<string, unknown>): string | undefined {
  const deltaText = readString(readRecord(event['delta'])?.['text']);
  if (deltaText !== undefined && deltaText.length > 0) {
    return deltaText;
  }

  return (
    readNonEmptyString(readRecord(event['delta'])?.['text']) ??
    readNonEmptyString(event['text']) ??
    readNonEmptyString(event['message']) ??
    readNonEmptyString(readRecord(event['content'])?.['text'])
  );
}

function extractCommandText(event: Record<string, unknown>): string | undefined {
  const item = readRecord(event['item']);
  return (
    readNonEmptyString(item?.['command']) ??
    readNonEmptyString(event['command']) ??
    readNonEmptyString(event['tool_name']) ??
    readNonEmptyString(event['tool'])
  );
}

function extractFileChanges(event: Record<string, unknown>): Array<Record<string, unknown>> | undefined {
  const item = readRecord(event['item']);
  return (
    readArray(item?.['changes']) ??
    readArray(item?.['files']) ??
    readArray(event['changes']) ??
    readArray(event['files'])
  );
}

function makeRawNotificationDebugEvent(
  method: string,
  params: Record<string, unknown> | undefined,
): ProviderProgressEvent {
  return {
    kind: 'warning',
    text: `raw ${method}: ${JSON.stringify(params ?? {})}`,
    phase: 'unknown',
    eventType: method,
  };
}

function shouldEmitRawEvents(hooks: ProviderHooks | undefined): boolean {
  if (hooks?.rawEvents !== undefined) {
    return hooks.rawEvents;
  }

  const value = process.env['RAES_DEBUG_CODEX_EVENTS'];
  return value === '1' || value === 'true';
}

function normalizeAppServerEvent(event: Record<string, unknown>): ProviderProgressEvent | undefined {
  const eventType = readString(event['type']);
  if (!eventType || eventType === 'turn/completed') return undefined;

  const item = extractProgressItem(readRecord(event['item']));
  const command = extractCommandText(event) ?? item?.command;
  const files = extractFileChanges(event) ?? item?.changes;

  switch (eventType) {
    case 'thread/started':
      return {
        kind: 'status',
        text: 'Session started',
        phase: 'turn',
        eventType,
      };
    case 'thread/status/changed': {
      const status = readRecord(event['status']);
      const statusType = readNonEmptyString(status?.['type']) ?? 'updated';
      return {
        kind: 'status',
        text: `Session ${statusType}`,
        phase: 'turn',
        eventType,
      };
    }
    case 'mcpServer/startupStatus/updated': {
      const name = readNonEmptyString(event['name']) ?? 'unknown';
      const status = readNonEmptyString(event['status']) ?? 'updated';
      const error = readNonEmptyString(event['error']);
      return {
        kind: error ? 'warning' : 'status',
        text: error ? `MCP ${name} ${status}: ${error}` : `MCP ${name} ${status}`,
        phase: 'unknown',
        eventType,
      };
    }
    case 'turn/started':
      return {
        kind: 'status',
        text: 'Agent turn started',
        phase: 'turn',
        eventType,
      };
    case 'item/started':
      return {
        kind: 'status',
        text: item?.kind ? `${item.kind} started` : 'Work item started',
        phase: item?.kind === 'command_execution' ? 'command' : item?.kind === 'file_change' ? 'diff' : 'item',
        eventType,
        ...(item ? { item } : {}),
        ...(command ? { command } : {}),
        ...(files ? { files } : {}),
      };
    case 'item/completed':
      return {
        kind: 'status',
        text: item?.kind ? `${item.kind} completed` : 'Work item completed',
        phase: item?.kind === 'command_execution' ? 'command' : item?.kind === 'file_change' ? 'diff' : 'item',
        eventType,
        ...(item ? { item } : {}),
        ...(command ? { command } : {}),
        ...(files ? { files } : {}),
      };
    case 'item/agentMessage/delta': {
      const delta = extractDeltaText(event) ?? 'Agent message delta received';
      return {
        kind: 'message',
        text: delta,
        phase: 'message',
        eventType,
        ...(item ? { item } : {}),
        delta,
      };
    }
    case 'item/reasoning/summaryTextDelta': {
      const delta = extractDeltaText(event) ?? 'Reasoning summary updated';
      return {
        kind: 'message',
        text: delta,
        phase: 'reasoning',
        eventType,
        ...(item ? { item } : {}),
        delta,
      };
    }
    case 'item/commandExecution/outputDelta': {
      const command = extractCommandText(event);
      const delta = extractDeltaText(event);
      return {
        kind: 'tool',
        text: command ?? 'Command output',
        phase: 'command',
        eventType,
        ...(item ? { item } : {}),
        ...(command ? { command } : {}),
        ...(delta ? { delta } : {}),
      };
    }
    case 'turn/plan/updated': {
      const plan = readArray(event['plan']);
      return {
        kind: 'status',
        text: 'Plan updated',
        phase: 'plan',
        eventType,
        ...(plan ? { plan } : {}),
      };
    }
    case 'turn/diff/updated': {
      const diff = readRecord(event['diff']);
      const files = readArray(diff?.['files']) ?? readArray(event['files']);
      return {
        kind: 'status',
        text: 'Diff updated',
        phase: 'diff',
        eventType,
        ...(files ? { files } : {}),
      };
    }
    default:
      return {
        kind: 'status',
        text: `Observed ${eventType}`,
        phase: 'unknown',
        eventType,
      };
  }
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

export class CodexAppServerProvider implements Provider {
  private config: RaesConfig;
  private cwd: string;
  private spawnFn: SpawnFn;

  constructor(config: RaesConfig, cwd: string, spawnFn?: SpawnFn) {
    this.config = config;
    this.cwd = cwd;
    this.spawnFn = spawnFn ?? (nodeSpawn as unknown as SpawnFn);
  }

  async startSession(): Promise<ProviderSession> {
    return new CodexAppServerSession(this.config, this.cwd, this.spawnFn);
  }

  async submit(prompt: string, hooks?: ProviderHooks): Promise<ProviderResult> {
    const session = await this.startSession();
    try {
      return await session.submitTurn(prompt, hooks);
    } finally {
      await session.close();
    }
  }
}

export function createProvider(config: RaesConfig, cwd = process.cwd()): Provider {
  switch (config.provider.name) {
    case 'anthropic':
      return new ClaudeCodeProvider(config);
    case 'openai':
      if (config.provider.openai?.transport === 'app_server') {
        return new CodexAppServerProvider(config, cwd);
      }
      return new CodexProvider(config);
    default:
      throw new Error(`unknown provider: ${(config.provider as { name?: string }).name ?? '(missing)'}`);
  }
}
