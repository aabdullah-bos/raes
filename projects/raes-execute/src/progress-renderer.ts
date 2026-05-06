import type { ProviderProgressEvent } from './provider.ts';

export type ProgressVerbosity = 'quiet' | 'progress' | 'debug';

interface RenderIO {
  out: (line: string) => void;
  err: (line: string) => void;
}

interface PendingCommandEvent {
  text: string;
  command?: string;
  status?: string;
  exitCode?: number;
  deltas: string[];
}

function formatStep(step: Record<string, unknown>): string | undefined {
  const label = typeof step['step'] === 'string'
    ? step['step']
    : typeof step['title'] === 'string'
      ? step['title']
      : undefined;
  if (!label) return undefined;
  const status = typeof step['status'] === 'string' ? step['status'] : undefined;
  return status ? `${label} [${status}]` : label;
}

function formatFile(file: Record<string, unknown>): string | undefined {
  const path = typeof file['path'] === 'string'
    ? file['path']
    : typeof file['file'] === 'string'
      ? file['file']
      : undefined;
  if (!path) return undefined;
  const status = typeof file['status'] === 'string'
    ? file['status']
    : typeof file['change'] === 'string'
      ? file['change']
      : typeof file['kind'] === 'string'
        ? file['kind']
      : undefined;
  return status ? `${path} (${status})` : path;
}

function kindLabel(event: ProviderProgressEvent): string {
  switch (event.kind) {
    case 'message':
      return 'message';
    case 'warning':
      return 'warning';
    case 'tool':
      return 'tool';
    default:
      return 'status';
  }
}

export interface ProgressRenderer {
  push(event: ProviderProgressEvent): void;
  flush(): void;
}

function shouldSuppressEvent(event: ProviderProgressEvent, verbosity: ProgressVerbosity): boolean {
  if (verbosity === 'quiet') {
    return true;
  }

  if (verbosity === 'debug') {
    return false;
  }

  if (event.kind === 'warning' && event.text.startsWith('raw ')) {
    return true;
  }

  if (event.eventType === 'item/started' || event.eventType === 'item/completed') {
    const kind = event.item?.kind;
    if (kind === 'user_message' || kind === 'agent_message' || kind === 'reasoning') {
      return true;
    }
  }

  if (event.eventType === 'item/agentMessage/delta' && event.text === 'Agent message delta received') {
    return true;
  }

  if (event.phase === 'unknown' && event.eventType !== 'mcpServer/startupStatus/updated') {
    return true;
  }

  return false;
}

export function createProgressRenderer(io: RenderIO, verbosity: ProgressVerbosity = 'progress'): ProgressRenderer {
  let pendingCommand: PendingCommandEvent | undefined;

  function flushPendingCommand(): void {
    if (!pendingCommand) return;
    io.out(`[tool] ${pendingCommand.text}`);
    if (pendingCommand.command) {
      io.out(`  command: ${pendingCommand.command}`);
    }
    if (pendingCommand.status) {
      io.out(`  status: ${pendingCommand.status}`);
    }
    if (pendingCommand.exitCode !== undefined) {
      io.out(`  exit: ${pendingCommand.exitCode}`);
    }
    if (pendingCommand.deltas.length > 0) {
      const visible = pendingCommand.deltas.slice(0, 3);
      io.out(`  output: ${visible.join(' | ')}`);
      const extraCount = pendingCommand.deltas.length - visible.length;
      if (extraCount > 0) {
        io.out(`  output: ... ${extraCount} more updates`);
      }
    }
    pendingCommand = undefined;
  }

  function write(line: string, warning = false): void {
    if (warning) {
      io.err(line);
      return;
    }
    io.out(line);
  }

  return {
    push(event: ProviderProgressEvent): void {
      if (shouldSuppressEvent(event, verbosity)) {
        return;
      }

      const isCommandDelta = event.phase === 'command' && (event.command || event.delta || event.kind === 'tool');

      if (isCommandDelta) {
        const canCoalesce =
          pendingCommand !== undefined &&
          pendingCommand.text === event.text &&
          pendingCommand.command === event.command;
        if (!canCoalesce) {
          flushPendingCommand();
          pendingCommand = {
            text: event.text,
            command: event.command,
            status: event.item?.status,
            exitCode: event.item?.exitCode,
            deltas: [],
          };
        }
        pendingCommand!.status = event.item?.status ?? pendingCommand!.status;
        pendingCommand!.exitCode = event.item?.exitCode ?? pendingCommand!.exitCode;
        if (event.delta) {
          pendingCommand!.deltas.push(event.delta);
        } else if (pendingCommand!.deltas.length === 0) {
          flushPendingCommand();
        }
        return;
      }

      flushPendingCommand();

      if (event.phase === 'plan' && event.plan && event.plan.length > 0) {
        for (const step of event.plan) {
          const summary = formatStep(step);
          write(summary ? `[plan] ${summary}` : '[plan] Plan updated', event.kind === 'warning');
        }
        return;
      }

      if (event.phase === 'diff' && event.files && event.files.length > 0) {
        for (const file of event.files) {
          const summary = formatFile(file);
          write(summary ? `[diff] ${summary}` : '[diff] Diff updated', event.kind === 'warning');
        }
        return;
      }

      if (event.item?.kind === 'file_change' && event.files && event.files.length > 0) {
        for (const file of event.files) {
          const summary = formatFile(file);
          write(summary ? `[diff] ${summary}` : '[diff] File change updated', event.kind === 'warning');
        }
        return;
      }

      write(`[${kindLabel(event)}] ${event.text}`, event.kind === 'warning');
    },

    flush(): void {
      flushPendingCommand();
    },
  };
}
