#!/usr/bin/env -S node --experimental-strip-types
import { generateDocs, GenerationError, SUPPORTED_ARCHETYPES } from './generate-docs.ts';
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
  --from-prd <path>   Path to a readable PRD markdown file
  --help              Show this help message

Output (written to <target-project-path>/docs/):
  prd.md, system.md, pipeline.md, decisions.md,
  prd-ux-review.md, execution-guidance.md, validation.md, raes.config.yaml

Fails before writing if any required output file already exists.`;

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  if (argv.includes('--help')) {
    console.log(HELP);
    return 0;
  }

  const fromPrdIdx = argv.indexOf('--from-prd');
  const isFromPrd = fromPrdIdx !== -1;

  let prdPath: string | undefined;
  let positional: string[];

  if (isFromPrd) {
    prdPath = argv[fromPrdIdx + 1];
    positional = [...argv.slice(0, fromPrdIdx), ...argv.slice(fromPrdIdx + 2)];
  } else {
    positional = argv;
  }

  const [targetProjectPath, archetype] = positional;

  if (!targetProjectPath || !archetype || (isFromPrd && !prdPath)) {
    console.error('missing required arguments');
    console.error('usage: raes-init <target-project-path> <archetype>');
    console.error('       raes-init --from-prd <prd-path> <target-project-path> <archetype>');
    return 1;
  }

  let provider: Provider | undefined;
  if (isFromPrd) {
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
    await generateDocs({ prdPath, targetProjectPath, archetype, provider });
    return 0;
  } catch (error) {
    if (error instanceof GenerationError) {
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
