import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { RaesConfig } from './config.ts';
import type { Slice } from './pipeline.ts';
import { writeFileAtomic } from './io.ts';
import { loadPrompt } from './prompt.ts';
import { parseRaesSummary, renderRaesSummary } from './output-summary.ts';
import { createProgressRenderer, type ProgressVerbosity } from './progress-renderer.ts';
import { createProvider, type Provider, type ProviderResult } from './provider.ts';
import { runSlicePreflight } from './slice-preflight.ts';

interface LoopIO {
  out: (line: string) => void;
  err: (line: string) => void;
  in: () => Promise<string | null>;
}

export interface ExecutionLoopResult {
  exitCode: number;
}

interface ExecutionLoopDeps {
  provider?: Provider;
  loadPrompt?: () => string;
}

function writeFinalOutput(output: string, out: (line: string) => void): boolean {
  const parsed = parseRaesSummary(output);
  const lines = parsed
    ? renderRaesSummary(parsed.summary)
    : output.trim().length > 0
      ? output.split('\n')
      : [];
  if (lines.length === 0) {
    out('[warning] Agent completed without any final summary output.');
    return false;
  }
  for (const line of lines) {
    out(line);
  }
  return true;
}

// Replace the first `- [ ] {label}` occurrence with `- [x] {label}`.
// Returns null if the label is not found in either checked or unchecked form.
// Returns content unchanged if the slice is already marked complete (idempotent).
export function markSliceComplete(content: string, slice: Slice): string | null {
  const target = `- [ ] ${slice.label}`;
  if (content.includes(target)) {
    return content.replace(target, `- [x] ${slice.label}`);
  }
  if (content.includes(`- [x] ${slice.label}`)) return content;
  return null;
}

function defaultIn(): Promise<string | null> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, terminal: false });
    let answered = false;
    rl.once('line', (line) => {
      answered = true;
      rl.close();
      resolve(line);
    });
    rl.once('close', () => {
      if (!answered) resolve(null);
    });
  });
}

export async function runExecutionLoop(
  slice: Slice,
  config: RaesConfig,
  cwd: string,
  io: { out?: (l: string) => void; err?: (l: string) => void; in?: () => Promise<string | null>; verbosity?: ProgressVerbosity },
  deps: ExecutionLoopDeps = {},
): Promise<ExecutionLoopResult> {
  const out = io.out ?? ((l) => process.stdout.write(l + '\n'));
  const err = io.err ?? ((l) => process.stderr.write(l + '\n'));
  const readLine = io.in ?? defaultIn;
  const verbosity = io.verbosity ?? 'progress';
  const provider = deps.provider ?? createProvider(config, cwd);
  const readPrompt = deps.loadPrompt ?? loadPrompt;

  const preflight = runSlicePreflight(config, cwd, readPrompt);
  if (!preflight.ok) {
    for (const line of preflight.errors) {
      err(line);
    }
    return { exitCode: 2 };
  }
  const prompt = preflight.prompt;

  out(`Boundaries:  ok`);
  out(`Provider:    started; waiting for progress...`);
  out('');

  const session = await provider.startSession();
  const progress = createProgressRenderer({ out, err }, verbosity);
  let result: ProviderResult;
  try {
    result = await session.submitTurn(prompt, {
      onProgress: (event) => progress.push(event),
      rawEvents: verbosity === 'debug',
    });
  } finally {
    progress.flush();
    await session.close();
  }
  if (result.error) {
    err(`error: ${result.error}`);
    if (result.fix) {
      err(`fix: ${result.fix}`);
    }
    return { exitCode: 2 };
  }

  writeFinalOutput(result.output, out);
  out('');
  out(`Agent output shown above. Record this slice as complete? [y/N]`);

  const answer = await readLine();
  if (!answer || answer.trim().toLowerCase() !== 'y') {
    out('Slice not recorded. No artifacts written.');
    return { exitCode: 0 };
  }

  // Mark the next unchecked slice as complete in the pipeline
  const pipelinePath = join(cwd, config.sources.next_slice.path);
  let pipelineContent: string;
  try {
    pipelineContent = readFileSync(pipelinePath, 'utf8');
  } catch {
    err(`error: cannot read pipeline file: ${config.sources.next_slice.path}`);
    return { exitCode: 2 };
  }

  const updated = markSliceComplete(pipelineContent, slice);
  if (updated === null) {
    err(`error: could not locate unchecked slice in pipeline: ${slice.label}`);
    return { exitCode: 2 };
  }

  const { error: writeError } = writeFileAtomic(pipelinePath, updated);
  if (writeError) {
    err(`error: ${writeError}`);
    return { exitCode: 2 };
  }

  out(`Slice complete: ${slice.label}`);
  return { exitCode: 0 };
}
