#!/usr/bin/env -S node --experimental-strip-types
import { realpathSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { checkConfig } from './config.ts';
import { getPipelineStatus } from './pipeline.ts';

const VERSION = '0.1.0';

const HELP = `\
Usage:
  raes-execute [options]

RAES Execute — disciplined, one-slice-at-a-time CLI workflow enforcer.

Enforces RAES methodology: one bounded slice at a time, artifact boundary
validation, and halt-on-ambiguity before any work advances.

Options:
  -c, --check-config       Validate raes.config.yaml and all referenced artifact paths
  -s, --status             Show current project status: next slice, milestone, flags
  -l, --list-slices        List all pipeline slices with position, status, type, and label
  -n, --show-next-slice    Print full details of the next unchecked slice
  -p, --print-artifact     Print the content of a named RAES artifact to stdout
  -e, --execute-next-slice Execute the next unchecked slice (Execution or Review loop)
      --flag               Register an ambiguity, blocking issue, or known problem
      --history            List most recent N executed slices
      --version            Show version
  -h, --help               Show this help message`;

const KNOWN_FLAGS = new Set([
  '--check-config', '-c',
  '--status', '-s',
  '--list-slices', '-l',
  '--show-next-slice', '-n',
  '--print-artifact', '-p',
  '--execute-next-slice', '-e',
  '--flag',
  '--history',
  '--version',
  '--help', '-h',
]);

export interface IO {
  out?: (line: string) => void;
  err?: (line: string) => void;
  cwd?: string;
}

export interface Result {
  exitCode: number;
}

export async function main(argv: string[], io: IO = {}): Promise<Result> {
  const out = io.out ?? ((l) => process.stdout.write(l + '\n'));
  const err = io.err ?? ((l) => process.stderr.write(l + '\n'));
  const cwd = io.cwd ?? process.cwd();

  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    out(HELP);
    return { exitCode: 0 };
  }

  if (argv.includes('--version')) {
    out(`raes-execute ${VERSION}`);
    return { exitCode: 0 };
  }

  for (const arg of argv) {
    if (arg.startsWith('-')) {
      if (!KNOWN_FLAGS.has(arg)) {
        err(`error: unknown option: ${arg}`);
        err(`       run 'raes-execute --help' for usage`);
        return { exitCode: 1 };
      }
    } else {
      err(`error: unexpected argument: ${arg}`);
      err(`       run 'raes-execute --help' for usage`);
      return { exitCode: 1 };
    }
  }

  if (argv.includes('--check-config') || argv.includes('-c')) {
    const { errors, config } = checkConfig(cwd);
    if (errors.length === 0 && config) {
      const paths: Array<[string, string]> = [
        ['sources.build_intent', config.sources.build_intent],
        ['sources.system_constraints', config.sources.system_constraints],
        ['sources.next_slice', config.sources.next_slice.path],
        ['sources.durable_decisions', config.sources.durable_decisions],
        ['sources.execution_guidance', config.sources.execution_guidance],
        ['sources.validation', config.sources.validation],
      ];
      const labelWidth = Math.max(...paths.map(([l]) => l.length));
      for (const [label, path] of paths) {
        out(`  ${label.padEnd(labelWidth)}  ${path}`);
      }
      out('');
      out(`raes.config.yaml OK — ${paths.length} artifact paths verified.`);
      return { exitCode: 0 };
    }
    for (const e of errors) {
      err(`error: ${e.message}`);
      err(`  field: ${e.field}`);
      if (e.fix) err(`  fix:   ${e.fix}`);
      err('');
    }
    const count = errors.length;
    err(`${count} ${count === 1 ? 'error' : 'errors'} found. Fix the ${count === 1 ? 'issue' : 'issues'} above and re-run --check-config.`);
    return { exitCode: 2 };
  }

  if (argv.includes('--status') || argv.includes('-s')) {
    const { errors, config } = checkConfig(cwd);
    if (errors.length > 0 || !config) {
      for (const e of errors) {
        err(`error: ${e.message}`);
        if (e.fix) err(`  fix:   ${e.fix}`);
      }
      return { exitCode: 2 };
    }
    const pipelinePath = join(cwd, config.sources.next_slice.path);
    let pipelineContent: string;
    try {
      pipelineContent = readFileSync(pipelinePath, 'utf8');
    } catch {
      err(`error: cannot read pipeline file: ${config.sources.next_slice.path}`);
      return { exitCode: 2 };
    }
    const status = getPipelineStatus(pipelineContent);
    const total = status.totalComplete + status.totalRemaining;
    out(`Project:   ${config.project.name}`);
    out(`Slices:    ${status.totalComplete} complete, ${status.totalRemaining} remaining (${total} total)`);
    if (status.nextSlice) {
      out(`Next:      ${status.nextSlice.label}`);
    } else {
      out(`Next:      all slices complete`);
    }
    out(`Flags:     none`);
    return { exitCode: 0 };
  }

  // All other known flags are unimplemented stubs — subcommands TBD
  err(`error: that option is not yet implemented`);
  err(`       run 'raes-execute --help' for usage`);
  return { exitCode: 1 };
}

const currentFile = realpathSync(fileURLToPath(import.meta.url));
const scriptFile = realpathSync(process.argv[1]);
if (currentFile === scriptFile) {
  const { exitCode } = await main(process.argv.slice(2));
  process.exit(exitCode);
}
