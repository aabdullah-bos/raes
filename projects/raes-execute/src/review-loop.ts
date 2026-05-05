import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { RaesConfig } from './config.ts';
import type { Slice } from './pipeline.ts';
import { writeFileAtomic } from './io.ts';
import { markSliceComplete } from './execution-loop.ts';
import { loadPrompt } from './prompt.ts';
import { createProvider, type Provider } from './provider.ts';
import { runSlicePreflight } from './slice-preflight.ts';

export interface ReviewLoopResult {
  exitCode: number;
}

interface ReviewLoopDeps {
  provider?: Provider;
  loadPrompt?: () => string;
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

export async function runReviewLoop(
  slice: Slice,
  config: RaesConfig,
  cwd: string,
  io: { out?: (l: string) => void; err?: (l: string) => void; in?: () => Promise<string | null> },
  deps: ReviewLoopDeps = {},
): Promise<ReviewLoopResult> {
  const out = io.out ?? ((l) => process.stdout.write(l + '\n'));
  const err = io.err ?? ((l) => process.stderr.write(l + '\n'));
  const readLine = io.in ?? defaultIn;
  const provider = deps.provider ?? createProvider(config);
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
  out('');

  const result = await provider.submit(prompt);
  if (result.error) {
    err(`error: ${result.error}`);
    if (result.fix) {
      err(`fix: ${result.fix}`);
    }
    return { exitCode: 2 };
  }

  for (const line of result.output.split('\n')) {
    out(line);
  }
  out('');
  out(`Agent output shown above. Record this slice as complete? [y/N]`);

  const answer = await readLine();
  if (!answer || answer.trim().toLowerCase() !== 'y') {
    out('Slice not recorded. No artifacts written.');
    return { exitCode: 0 };
  }

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

  out(`Review complete: ${slice.label}`);
  return { exitCode: 0 };
}
