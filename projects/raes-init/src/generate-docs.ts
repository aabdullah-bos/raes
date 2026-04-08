import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

export const SUPPORTED_ARCHETYPE = 'cli-doc-generator';

const REQUIRED_DOC_NAMES = [
  'PRD.md',
  'system.md',
  'pipeline.md',
  'decisions.md',
  'prd-ux-review.md'
] as const;

export class GenerationError extends Error {}

export type GenerateDocsInput = {
  prdPath: string;
  targetProjectPath: string;
  archetype: string;
};

export async function generateDocs({
  prdPath,
  targetProjectPath,
  archetype
}: GenerateDocsInput): Promise<string[]> {
  if (archetype !== SUPPORTED_ARCHETYPE) {
    throw new GenerationError(`unsupported archetype: ${archetype}`);
  }

  const docsDirectory = join(targetProjectPath, 'docs');
  const outputPaths = REQUIRED_DOC_NAMES.map((name) => join(docsDirectory, name));

  await failIfOutputsExist(outputPaths);

  let prdText: string;
  try {
    prdText = await readFile(prdPath, 'utf8');
  } catch (error) {
    throw new GenerationError(`unable to read PRD: ${prdPath}`, { cause: error });
  }

  await mkdir(docsDirectory, { recursive: true });

  const projectName = basename(targetProjectPath) || 'project';
  const prdTitle = extractPrdTitle(prdText, projectName);
  const prdBullets = extractPrdBullets(prdText);

  const generatedContent = new Map<string, string>([
    ['PRD.md', prdText],
    ['system.md', renderSystemDoc(projectName, prdTitle, prdBullets)],
    ['pipeline.md', renderPipelineDoc(projectName, prdTitle, prdBullets)],
    ['decisions.md', renderDecisionsDoc(projectName)],
    ['prd-ux-review.md', renderPrdUxReview(projectName, prdTitle, prdBullets)]
  ]);

  for (const outputPath of outputPaths) {
    const fileName = basename(outputPath);
    const content = generatedContent.get(fileName);
    if (!content) {
      throw new GenerationError(`missing generated content for ${fileName}`);
    }
    await writeFile(outputPath, content, 'utf8');
  }

  return outputPaths;
}

async function failIfOutputsExist(outputPaths: string[]): Promise<void> {
  for (const outputPath of outputPaths) {
    try {
      await readFile(outputPath, 'utf8');
      throw new GenerationError(`target docs already exist: ${outputPath}`);
    } catch (error) {
      if (error instanceof GenerationError) {
        throw error;
      }
    }
  }
}

function extractPrdTitle(prdText: string, fallback: string): string {
  for (const line of prdText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      return trimmed.slice(2).trim();
    }
  }
  return fallback;
}

function extractPrdBullets(prdText: string): string[] {
  const bullets: string[] = [];
  for (const line of prdText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      bullets.push(trimmed.slice(2).trim());
    }
    if (bullets.length === 3) {
      break;
    }
  }
  return bullets;
}

function renderSystemDoc(projectName: string, prdTitle: string, prdBullets: string[]): string {
  const productInvariants = renderBullets(prdBullets, [
    'The generated docs should preserve the source PRD intent.',
    'Output must remain readable and editable markdown.'
  ]);

  return [
    `# ${projectName} — system.md`,
    '',
    '## Purpose',
    '',
    `This document defines the V1 execution rules for \`${projectName}\`.`,
    '',
    `The project is initialized from the PRD \`${prdTitle}\` using the \`${SUPPORTED_ARCHETYPE}\` archetype.`,
    '',
    '## Product Invariants',
    '',
    productInvariants,
    '',
    '## Drift Guards',
    '',
    '- Do not fabricate requirements that are not present in the PRD.',
    '- Do not widen the V1 happy path beyond one PRD file, one target path, and one archetype.',
    '- Do not overwrite existing generated docs.',
    '',
    '## Known Contracts',
    '',
    '- Input mode: one readable PRD markdown file path.',
    '- Target location: `<target>/docs/`.',
    `- Supported archetype: \`${SUPPORTED_ARCHETYPE}\`.`,
    '- Generated files: `PRD.md`, `system.md`, `pipeline.md`, `decisions.md`, and `prd-ux-review.md`.',
    '',
    '## Unknowns',
    '',
    '- How much PRD normalization should be applied beyond copying `PRD.md`.',
    '- How future archetypes should adapt the output set.',
    '- What validation is needed beyond the narrow happy path.',
    '',
    '## Anti-Patterns',
    '',
    '- Do not treat archetype defaults as final project truth.',
    '- Do not hide ambiguous requirements.',
    '- Do not add code scaffolding or runtime assumptions in V1.',
    '',
    '## Definition of Done',
    '',
    '1. The narrow happy path generates the full docs set.',
    '2. Existing target docs cause generation to fail before writes.',
    '3. Generated markdown remains project-specific and editable.',
    ''
  ].join('\n');
}

function renderPipelineDoc(projectName: string, prdTitle: string, prdBullets: string[]): string {
  const knownContracts = renderBullets(prdBullets, [
    'The project should use the PRD as the source of truth for generated docs.'
  ]);

  return [
    `# ${projectName} — pipeline.md`,
    '',
    '## Purpose',
    '',
    `This pipeline defines the initial execution path for \`${projectName}\` based on the PRD \`${prdTitle}\`.`,
    '',
    '## Invariants',
    '',
    '### Product Invariants',
    '',
    '- Output must be readable markdown.',
    '- Output must stay editable by humans.',
    '- Unknowns remain visible instead of being fabricated.',
    '',
    '### Drift Guards',
    '',
    '- One slice per session.',
    '- Tests first.',
    '- Minimum implementation only.',
    '- No overwrite behavior in V1.',
    '',
    '## Known Contracts',
    '',
    knownContracts,
    '',
    '## Unknowns',
    '',
    '- How much validation should happen before generation.',
    '- How far PRD adaptation should go in later slices.',
    '',
    '## Slice Backlog',
    '',
    '### Milestone 1 — Narrow Happy Path',
    '',
    '- [ ] Slice 1: Generate the RAES docs set from one PRD file into `<target>/docs/`.',
    '',
    '### Milestone 2 — Validation',
    '',
    '- [ ] Slice 2: Add explicit error messages for invalid inputs and target conflicts.',
    '',
    '## Handoff Notes',
    ''
  ].join('\n');
}

function renderDecisionsDoc(projectName: string): string {
  return [`# ${projectName} — decisions.md`, '', '## Durable Decisions', ''].join('\n');
}

function renderPrdUxReview(projectName: string, prdTitle: string, prdBullets: string[]): string {
  const observedRequirements = renderBullets(prdBullets, [
    'The PRD should remain the source of truth for operator expectations.'
  ]);

  return [
    `# ${projectName} — prd-ux-review.md`,
    '',
    '## Purpose',
    '',
    `This review captures ambiguity and operator risk for \`${projectName}\` based on \`${prdTitle}\`.`,
    '',
    '## Observed Requirements',
    '',
    observedRequirements,
    '',
    '## UX Risks',
    '',
    '- Users may not know what happens when docs already exist at the target path.',
    '- The scope of supported input modes may be unclear if the CLI surface expands early.',
    '',
    '## Open Questions',
    '',
    '- Should future versions support inline PRD input?',
    '- What level of normalization is appropriate for copied PRD content?',
    ''
  ].join('\n');
}

function renderBullets(items: string[], fallbackItems: string[]): string {
  const values = items.length > 0 ? items : fallbackItems;
  return values.map((item) => `- ${item}`).join('\n');
}
