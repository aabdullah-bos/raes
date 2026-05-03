#!/usr/bin/env -S node --experimental-strip-types
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
}

export interface Result {
  exitCode: number;
}

export async function main(argv: string[], io: IO = {}): Promise<Result> {
  const out = io.out ?? ((l) => process.stdout.write(l + '\n'));
  const err = io.err ?? ((l) => process.stderr.write(l + '\n'));

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
