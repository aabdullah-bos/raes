#!/usr/bin/env -S node --experimental-strip-types
import { realpathSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { checkConfig } from './config.ts';
import { getPipelineStatus, formatSliceList, formatNextSlice, determineLoopType } from './pipeline.ts';
import { runExecutionLoop } from './execution-loop.ts';
import { runReviewLoop } from './review-loop.ts';
import type { Provider } from './provider.ts';
import type { ProgressVerbosity } from './progress-renderer.ts';
import { getPromptPath } from './prompt.ts';
import { runSlicePreflight } from './slice-preflight.ts';

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
      --config             Use an explicit raes.config.yaml path
      --dry-run            Preflight --execute-next-slice without provider submission or writes
      --verbosity          Progress output: quiet | progress | debug
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
  '--config',
  '--dry-run',
  '--verbosity',
  '--flag',
  '--history',
  '--version',
  '--help', '-h',
]);

export interface IO {
  out?: (line: string) => void;
  err?: (line: string) => void;
  in?: () => Promise<string | null>;
  cwd?: string;
  verbosity?: ProgressVerbosity;
  provider?: Provider;
  loadPrompt?: () => string;
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

  let printArtifactName: string | undefined;
  let configPathOverride: string | undefined;
  let dryRun = false;
  let verbosity: ProgressVerbosity = io.verbosity ?? (process.env['RAES_DEBUG_CODEX_EVENTS'] ? 'debug' : 'progress');

  {
    let i = 0;
    while (i < argv.length) {
      const arg = argv[i];
      if (arg.startsWith('-')) {
        if (!KNOWN_FLAGS.has(arg)) {
          err(`error: unknown option: ${arg}`);
          err(`       run 'raes-execute --help' for usage`);
          return { exitCode: 1 };
        }
        if (arg === '--print-artifact' || arg === '-p') {
          const next = argv[i + 1];
          if (next === undefined || next.startsWith('-')) {
            err(`error: --print-artifact requires an artifact name`);
            err(`       usage: --print-artifact <name>  (e.g. --print-artifact prd)`);
            err(`       run 'raes-execute --help' for usage`);
            return { exitCode: 1 };
          }
          printArtifactName = next;
          i += 2;
          continue;
        }
        if (arg === '--config') {
          const next = argv[i + 1];
          if (next === undefined || next.startsWith('-')) {
            err(`error: --config requires a config file path`);
            err(`       usage: --config <path/to/raes.config.yaml>`);
            err(`       run 'raes-execute --help' for usage`);
            return { exitCode: 1 };
          }
          configPathOverride = next;
          i += 2;
          continue;
        }
        if (arg === '--dry-run') {
          dryRun = true;
          i++;
          continue;
        }
        if (arg === '--verbosity') {
          const next = argv[i + 1];
          if (next === undefined || next.startsWith('-')) {
            err(`error: --verbosity requires a value`);
            err(`       usage: --verbosity <quiet|progress|debug>`);
            err(`       run 'raes-execute --help' for usage`);
            return { exitCode: 1 };
          }
          if (next !== 'quiet' && next !== 'progress' && next !== 'debug') {
            err(`error: invalid value for --verbosity: ${next}`);
            err(`       expected one of: quiet | progress | debug`);
            err(`       run 'raes-execute --help' for usage`);
            return { exitCode: 1 };
          }
          verbosity = next;
          i += 2;
          continue;
        }
      } else {
        err(`error: unexpected argument: ${arg}`);
        err(`       run 'raes-execute --help' for usage`);
        return { exitCode: 1 };
      }
      i++;
    }
  }

  if (dryRun && !(argv.includes('--execute-next-slice') || argv.includes('-e'))) {
    err(`error: --dry-run is only supported with --execute-next-slice`);
    err(`       usage: --execute-next-slice --dry-run`);
    return { exitCode: 1 };
  }

  if (argv.includes('--check-config') || argv.includes('-c')) {
    const { errors, config } = checkConfig(cwd, configPathOverride);
    if (errors.length === 0 && config) {
      const paths: Array<[string, string]> = [
        ['sources.build_intent', config.sources.build_intent],
        ['sources.system_constraints', config.sources.system_constraints],
        ['sources.next_slice', config.sources.next_slice.path],
        ['sources.durable_decisions', config.sources.durable_decisions],
        ['sources.execution_guidance', config.sources.execution_guidance],
        ['sources.validation', config.sources.validation],
        ['provider.name', config.provider.name],
      ];
      const labelWidth = Math.max(...paths.map(([l]) => l.length));
      for (const [label, path] of paths) {
        out(`  ${label.padEnd(labelWidth)}  ${path}`);
      }
      out('');
      out(`raes.config.yaml OK — 6 artifact paths verified, provider: ${config.provider.name}.`);
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
    const { errors, config, projectRoot } = checkConfig(cwd, configPathOverride);
    if (errors.length > 0 || !config || !projectRoot) {
      for (const e of errors) {
        err(`error: ${e.message}`);
        if (e.fix) err(`  fix:   ${e.fix}`);
      }
      return { exitCode: 2 };
    }
    const pipelinePath = join(projectRoot, config.sources.next_slice.path);
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

  if (argv.includes('--list-slices') || argv.includes('-l')) {
    const { errors, config, projectRoot } = checkConfig(cwd, configPathOverride);
    if (errors.length > 0 || !config || !projectRoot) {
      for (const e of errors) {
        err(`error: ${e.message}`);
        if (e.fix) err(`  fix:   ${e.fix}`);
      }
      return { exitCode: 2 };
    }
    const pipelinePath = join(projectRoot, config.sources.next_slice.path);
    let pipelineContent: string;
    try {
      pipelineContent = readFileSync(pipelinePath, 'utf8');
    } catch {
      err(`error: cannot read pipeline file: ${config.sources.next_slice.path}`);
      return { exitCode: 2 };
    }
    const { slices } = getPipelineStatus(pipelineContent);
    for (const line of formatSliceList(slices)) {
      out(line);
    }
    return { exitCode: 0 };
  }

  if (argv.includes('--show-next-slice') || argv.includes('-n')) {
    const { errors, config, projectRoot } = checkConfig(cwd, configPathOverride);
    if (errors.length > 0 || !config || !projectRoot) {
      for (const e of errors) {
        err(`error: ${e.message}`);
        if (e.fix) err(`  fix:   ${e.fix}`);
      }
      return { exitCode: 2 };
    }
    const pipelinePath = join(projectRoot, config.sources.next_slice.path);
    let pipelineContent: string;
    try {
      pipelineContent = readFileSync(pipelinePath, 'utf8');
    } catch {
      err(`error: cannot read pipeline file: ${config.sources.next_slice.path}`);
      return { exitCode: 2 };
    }
    const { nextSlice } = getPipelineStatus(pipelineContent);
    if (!nextSlice) {
      out('all slices complete');
      return { exitCode: 0 };
    }
    for (const line of formatNextSlice(nextSlice)) {
      out(line);
    }
    return { exitCode: 0 };
  }

  if (argv.includes('--execute-next-slice') || argv.includes('-e')) {
    const { errors, config, projectRoot } = checkConfig(cwd, configPathOverride);
    if (errors.length > 0 || !config || !projectRoot) {
      for (const e of errors) {
        err(`error: ${e.message}`);
        if (e.fix) err(`  fix:   ${e.fix}`);
      }
      return { exitCode: 2 };
    }
    const pipelinePath = join(projectRoot, config.sources.next_slice.path);
    let pipelineContent: string;
    try {
      pipelineContent = readFileSync(pipelinePath, 'utf8');
    } catch {
      err(`error: cannot read pipeline file: ${config.sources.next_slice.path}`);
      return { exitCode: 2 };
    }
    const { nextSlice } = getPipelineStatus(pipelineContent);
    if (!nextSlice) {
      out('all slices complete');
      return { exitCode: 0 };
    }
    const loopType = determineLoopType(nextSlice);
    const loopName = loopType === 'review' ? 'Review Loop' : 'Execution Loop';
    const promptPath = getPromptPath();
    const writeAccess = config.provider.sandbox?.write_access !== false;
    out(`Next:        ${nextSlice.label}`);
    out(`Loop:        ${loopName}`);
    if (dryRun) {
      const preflight = runSlicePreflight(config, projectRoot, io.loadPrompt);
      if (!preflight.ok) {
        for (const line of preflight.errors) {
          err(line);
        }
        return { exitCode: 2 };
      }
      out(`Provider:    ${config.provider.name}`);
      out(`Prompt:      ${promptPath}`);
      out(`Pipeline:    ${pipelinePath}`);
      out(`WriteAccess: ${writeAccess ? 'enabled' : 'disabled'}`);
      out(`Dry run:     provider submission skipped; no artifacts written`);
      return { exitCode: 0 };
    }
    if (loopType === 'execution') {
      return runExecutionLoop(nextSlice, config, projectRoot, { ...io, verbosity }, {
        provider: io.provider,
        loadPrompt: io.loadPrompt,
      });
    }
    return runReviewLoop(nextSlice, config, projectRoot, { ...io, verbosity }, {
      provider: io.provider,
      loadPrompt: io.loadPrompt,
    });
  }

  if (printArtifactName !== undefined) {
    const { errors, config, projectRoot } = checkConfig(cwd, configPathOverride);
    if (errors.length > 0 || !config || !projectRoot) {
      for (const e of errors) {
        err(`error: ${e.message}`);
        if (e.fix) err(`  fix:   ${e.fix}`);
      }
      return { exitCode: 2 };
    }

    const artifactMap: Record<string, string> = {
      prd: config.sources.build_intent,
      system: config.sources.system_constraints,
      system_constraints: config.sources.system_constraints,
      decisions: config.sources.durable_decisions,
      durable_decisions: config.sources.durable_decisions,
      pipeline: config.sources.next_slice.path,
      next_slice: config.sources.next_slice.path,
      'execution-guidance': config.sources.execution_guidance,
      execution_guidance: config.sources.execution_guidance,
      validation: config.sources.validation,
    };

    const resolvedPath = artifactMap[printArtifactName.toLowerCase()];
    if (!resolvedPath) {
      err(`error: unknown artifact: ${printArtifactName}`);
      err(`       known artifacts: prd, system, decisions, pipeline, execution-guidance, validation`);
      err(`       run 'raes-execute --help' for usage`);
      return { exitCode: 1 };
    }

    const absPath = join(projectRoot, resolvedPath);
    let content: string;
    try {
      content = readFileSync(absPath, 'utf8');
    } catch {
      err(`error: cannot read artifact '${printArtifactName}': ${resolvedPath}`);
      return { exitCode: 2 };
    }

    out(`Artifact:  ${printArtifactName}`);
    out(`Path:      ${resolvedPath}`);
    out('');
    out(content);
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
