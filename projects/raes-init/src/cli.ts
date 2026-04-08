import { generateDocs, GenerationError } from './generate-docs.ts';

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const [prdPath, targetProjectPath, archetype] = argv;

  if (!prdPath || !targetProjectPath || !archetype) {
    console.error('missing required input: <prd-path> <target-project-path> <archetype>');
    console.error('usage: node src/cli.ts <prd-path> <target-project-path> <archetype>');
    return 1;
  }

  try {
    await generateDocs({ prdPath, targetProjectPath, archetype });
    return 0;
  } catch (error) {
    if (error instanceof GenerationError) {
      console.error(error.message);
      return 1;
    }

    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const exitCode = await main();
  process.exit(exitCode);
}
