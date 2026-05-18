#!/usr/bin/env -S node --experimental-strip-types
import { generateDocs, GenerationError, WorkspaceRegistrationError, SUPPORTED_ARCHETYPES } from './generate-docs.ts';
import { loadProvider, ProviderError, type Provider } from './provider.ts';
import { realpathSync } from 'fs';
import { fileURLToPath } from 'url';

const HELP = `\
Usage:
  raes-init <target-project-path> <archetype>
  raes-init --from-prd <prd-path> <target-project-path> <archetype>

Initialize a RAES docs set for a new project.

Modes:
  (bare)              Generates stub docs with section structure and no content.
  --from-prd <path>   Generates docs adapted from an existing PRD file.

Arguments:
  target-project-path   Path to the target project directory
  archetype             Execution shape (supported: ${SUPPORTED_ARCHETYPES.join(', ')})

Options:
  --from-prd <path>    Path to a readable PRD markdown file
  --workspace <path>   Register the project in raes.workspace.yaml at the given workspace root path
  --help               Show this help message

Output:
  <target-project-path>/raes.config.yaml
  <target-project-path>/docs/prd.md, system.md, pipeline.md, decisions.md,
    prd-ux-review.md, execution-guidance.md, validation.md

Fails before writing if any required output file already exists.`;

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  if (argv.includes('--help')) {
    console.log(HELP);
    return 0;
  }

  const fromPrdIdx = argv.indexOf('--from-prd');
  const isFromPrd = fromPrdIdx !== -1;

  const workspaceIdx = argv.indexOf('--workspace');
  const workspaceRootPath = workspaceIdx !== -1 ? argv[workspaceIdx + 1] : undefined;
  if (workspaceIdx !== -1 && (workspaceRootPath === undefined || workspaceRootPath.startsWith('-'))) {
    console.error('error: --workspace requires a workspace root path');
    console.error('       usage: --workspace <path/to/workspace/root>');
    return 1;
  }

  let prdPath: string | undefined;
  let positional: string[];

  // Strip --workspace <value> from argv before extracting positionals
  const argvWithoutWorkspace = workspaceIdx !== -1
    ? [...argv.slice(0, workspaceIdx), ...argv.slice(workspaceIdx + 2)]
    : argv;

  const fromPrdIdxClean = argvWithoutWorkspace.indexOf('--from-prd');
  const isFromPrdClean = fromPrdIdxClean !== -1;

  if (isFromPrdClean) {
    prdPath = argvWithoutWorkspace[fromPrdIdxClean + 1];
    positional = [...argvWithoutWorkspace.slice(0, fromPrdIdxClean), ...argvWithoutWorkspace.slice(fromPrdIdxClean + 2)];
  } else {
    positional = argvWithoutWorkspace;
  }

  const [targetProjectPath, archetype] = positional;

  if (!targetProjectPath || !archetype || (isFromPrdClean && !prdPath)) {
    console.error('missing required arguments');
    console.error('usage: raes-init <target-project-path> <archetype>');
    console.error('       raes-init --from-prd <prd-path> <target-project-path> <archetype>');
    return 1;
  }

  let provider: Provider | undefined;
  if (isFromPrdClean) {
    try {
      provider = loadProvider();
    } catch (error) {
      if (error instanceof ProviderError) {
        console.error(error.message);
        return 1;
      }
      throw error;
    }
  }

  try {
    await generateDocs({
      prdPath,
      targetProjectPath,
      archetype,
      provider,
      workspaceRootPath,
      log: (msg: string) => process.stdout.write(msg + '\n')
    });
    return 0;
  } catch (error) {
    if (error instanceof GenerationError || error instanceof WorkspaceRegistrationError) {
      console.error(error.message);
      return 1;
    }

    throw error;
  }
}

const currentFile = realpathSync(fileURLToPath(import.meta.url));
const scriptFile = realpathSync(process.argv[1]);
if (currentFile === scriptFile) {
  const exitCode = await main();
  process.exit(exitCode);
}
