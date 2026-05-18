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
  semanticLabel?: string;
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

function isSubstantiveText(text: string | undefined): text is string {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  return /[A-Za-z0-9]/.test(trimmed);
}

function summarizeFiles(files: Array<Record<string, unknown>>): string | undefined {
  const paths = files
    .map((file) => typeof file['path'] === 'string' ? file['path'] : typeof file['file'] === 'string' ? file['file'] : undefined)
    .filter((path): path is string => Boolean(path));
  if (paths.length === 0) return undefined;

  const statuses = files
    .map((file) =>
      typeof file['status'] === 'string'
        ? file['status']
        : typeof file['change'] === 'string'
          ? file['change']
          : typeof file['kind'] === 'string'
            ? file['kind']
            : undefined)
    .filter((status): status is string => Boolean(status));
  const primaryStatus = statuses[0];
  const verb =
    primaryStatus === 'added' ? 'Added'
      : primaryStatus === 'deleted' || primaryStatus === 'removed' ? 'Deleted'
        : primaryStatus === 'renamed' ? 'Renamed'
          : 'Updated';

  if (paths.length === 1) return `${verb} ${paths[0]}`;
  if (paths.length === 2) return `${verb} ${paths[0]}, ${paths[1]}`;
  return `${verb} ${paths[0]}, ${paths[1]}, and ${paths.length - 2} more file${paths.length - 2 === 1 ? '' : 's'}`;
}

function summarizeCommandFailure(command: string | undefined, exitCode: number | undefined, deltas: string[]): string {
  const label = command ?? 'Command';
  const suffix = exitCode !== undefined ? ` (exit ${exitCode})` : '';
  const detail = deltas
    .map((delta) => delta.trim())
    .find((delta) => isSubstantiveText(delta));
  return detail ? `Command failed: ${label}${suffix} - ${detail}` : `Command failed: ${label}${suffix}`;
}

function classifySemanticCommand(command: string | undefined): string | undefined {
  if (!command) return undefined;
  const normalized = command.replace(/\s+/g, ' ').trim();

  if (
    /(?:^| )pwd$/.test(normalized) ||
    /\bls -la\b/.test(normalized) ||
    /\brg --files\b/.test(normalized)
  ) {
    return 'Inspecting workspace layout';
  }

  if (/\bgit status --short\b/.test(normalized) || /\bgit diff --stat\b/.test(normalized)) {
    return 'Reviewing repository status';
  }

  if (/\b(?:sed|cat|nl|rg)\b/.test(normalized)) {
    if (/\bdocs\//.test(normalized)) {
      return 'Reading project guidance and pipeline';
    }
    if (/\btests\//.test(normalized)) {
      return 'Reviewing test coverage';
    }
    if (/\bsrc\//.test(normalized)) {
      return 'Inspecting implementation';
    }
  }

  return undefined;
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

  if (verbosity === 'progress' && event.kind === 'tool' && event.phase !== 'command') {
    return true;
  }

  return false;
}

export function createProgressRenderer(io: RenderIO, verbosity: ProgressVerbosity = 'progress'): ProgressRenderer {
  let pendingCommand: PendingCommandEvent | undefined;
  let reasoningSummaryParts: string[] = [];
  const emittedSemanticLabels = new Set<string>();

  function flushReasoningSummary(): void {
    if (reasoningSummaryParts.length === 0) return;
    io.out(`[reasoning] ${reasoningSummaryParts.join(' ')}`);
    reasoningSummaryParts = [];
  }

  function flushPendingCommand(): void {
    if (!pendingCommand) return;
    if (verbosity === 'progress' && pendingCommand.exitCode !== undefined && pendingCommand.exitCode !== 0) {
      io.out(`[tool] ${summarizeCommandFailure(pendingCommand.command, pendingCommand.exitCode, pendingCommand.deltas)}`);
      pendingCommand = undefined;
      return;
    }
    if (verbosity === 'progress' && pendingCommand.semanticLabel) {
      if (!emittedSemanticLabels.has(pendingCommand.semanticLabel)) {
        io.out(`[status] ${pendingCommand.semanticLabel}`);
        emittedSemanticLabels.add(pendingCommand.semanticLabel);
      }
      pendingCommand = undefined;
      return;
    }
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

      if (verbosity === 'progress' && event.eventType === 'item/reasoning/summaryTextDelta') {
        const delta = event.delta?.trim() ?? event.text.trim();
        if (isSubstantiveText(delta)) {
          reasoningSummaryParts.push(delta);
        }
        return;
      }

      if (verbosity === 'progress' && event.phase !== 'reasoning') {
        flushReasoningSummary();
      }

      const isCommandDelta = event.phase === 'command' && (event.command || event.delta || event.kind === 'tool');

      if (isCommandDelta) {
        const command = event.command ?? pendingCommand?.command;
        const canCoalesce = pendingCommand !== undefined && pendingCommand.command === command;
        if (!canCoalesce) {
          flushPendingCommand();
          const semanticLabel = verbosity === 'progress' ? classifySemanticCommand(command) : undefined;
          pendingCommand = {
            text: event.command ?? event.text,
            command,
            status: event.item?.status,
            exitCode: event.item?.exitCode,
            deltas: [],
            ...(semanticLabel ? { semanticLabel } : {}),
          };
        }
        pendingCommand!.text = pendingCommand!.command ?? event.text;
        pendingCommand!.status = event.item?.status ?? pendingCommand!.status;
        pendingCommand!.exitCode = event.item?.exitCode ?? pendingCommand!.exitCode;
        if (event.delta) {
          pendingCommand!.deltas.push(event.delta);
        } else if (event.eventType === 'item/completed' || verbosity === 'debug') {
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
        if (verbosity === 'progress') {
          const summary = summarizeFiles(event.files);
          write(summary ? `[diff] ${summary}` : '[diff] Diff updated', event.kind === 'warning');
          return;
        }
        for (const file of event.files) {
          const summary = formatFile(file);
          write(summary ? `[diff] ${summary}` : '[diff] Diff updated', event.kind === 'warning');
        }
        return;
      }

      if (event.item?.kind === 'file_change' && event.files && event.files.length > 0) {
        if (verbosity === 'progress') {
          const summary = summarizeFiles(event.files);
          write(summary ? `[diff] ${summary}` : '[diff] File change updated', event.kind === 'warning');
          return;
        }
        for (const file of event.files) {
          const summary = formatFile(file);
          write(summary ? `[diff] ${summary}` : '[diff] File change updated', event.kind === 'warning');
        }
        return;
      }

      if (verbosity === 'progress' && event.eventType === 'item/agentMessage/delta') {
        const delta = event.delta?.trim() ?? event.text.trim();
        if (!isSubstantiveText(delta)) {
          return;
        }
        write(`[message] ${delta}`, event.kind === 'warning');
        return;
      }

      write(`[${kindLabel(event)}] ${event.text}`, event.kind === 'warning');
    },

    flush(): void {
      flushReasoningSummary();
      flushPendingCommand();
    },
  };
}
