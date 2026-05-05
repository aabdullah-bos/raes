import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { RaesConfig } from './config.ts';
import type { Slice } from './pipeline.ts';
import { loadAllArtifacts, validateBoundaries } from './artifacts.ts';
import { writeFileAtomic } from './io.ts';

interface LoopIO {
  out: (line: string) => void;
  err: (line: string) => void;
  in: () => Promise<string | null>;
}

export interface ExecutionLoopResult {
  exitCode: number;
}

// Replace the first `- [ ] {label}` occurrence with `- [x] {label}`.
// Returns null if no matching unchecked slice line is found.
export function markSliceComplete(content: string, slice: Slice): string | null {
  const target = `- [ ] ${slice.label}`;
  if (!content.includes(target)) return null;
  return content.replace(target, `- [x] ${slice.label}`);
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
  io: { out?: (l: string) => void; err?: (l: string) => void; in?: () => Promise<string | null> },
): Promise<ExecutionLoopResult> {
  const out = io.out ?? ((l) => process.stdout.write(l + '\n'));
  const err = io.err ?? ((l) => process.stderr.write(l + '\n'));
  const readLine = io.in ?? defaultIn;

  // Load all artifacts and validate boundaries before any confirmation
  const { artifacts, errors: loadErrors } = loadAllArtifacts(config, cwd);
  if (loadErrors.length > 0 || !artifacts) {
    for (const e of loadErrors) {
      err(`error: ${e}`);
    }
    return { exitCode: 2 };
  }

  const violations = validateBoundaries(artifacts);
  if (violations.length > 0) {
    err(`error: artifact boundary violations detected — execution halted`);
    for (const v of violations) {
      err(`  artifact: ${v.path} [${v.role}]`);
      err(`  issue:    ${v.issue}`);
      err(`  evidence: ${v.evidence}`);
      err('');
    }
    return { exitCode: 2 };
  }

  out(`Boundaries:  ok`);
  out('');
  out(`Proceed? [y/N]`);

  const answer = await readLine();
  if (!answer || answer.trim().toLowerCase() !== 'y') {
    out('Execution cancelled.');
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
