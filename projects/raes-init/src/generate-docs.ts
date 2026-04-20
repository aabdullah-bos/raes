import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

export const SUPPORTED_ARCHETYPE = 'cli-doc-generator';

const REQUIRED_DOC_NAMES = [
  'prd.md',
  'system.md',
  'pipeline.md',
  'decisions.md',
  'prd-ux-review.md',
  'execution-guidance.md',
  'validation.md',
  'raes.config.yaml'
] as const;

const REQUIRED_DOC_HEADINGS: Record<string, string[]> = {
  'prd.md': [],
  'system.md': [
    '## Purpose',
    '## Product Invariants',
    '## Drift Guards',
    '## Known Contracts',
    '## Unknowns',
    '## Anti-Patterns',
    '## Definition of Done'
  ],
  'pipeline.md': [
    '## Purpose',
    '## Invariants',
    '## Known Contracts',
    '## Unknowns',
    '## Slice Backlog',
    '## Handoff Notes'
  ],
  'decisions.md': ['## Durable Decisions'],
  'prd-ux-review.md': ['## Purpose', '## Observed Requirements', '## UX Risks', '## Open Questions'],
  'execution-guidance.md': [
    '## Invariants',
    '## Workflow Rules',
    '## Anti-Patterns',
    '## Definition of Done'
  ],
  'validation.md': ['## Testing Approach', '## Validation Commands', '## Known Constraints'],
  'raes.config.yaml': []
};

export class GenerationError extends Error {}

export type GenerateDocsInput = {
  prdPath?: string;
  targetProjectPath: string;
  archetype: string;
};

type PrdSections = {
  coreFunctionality: string[];
  constraints: string[];
  openQuestions: string[];
};

export async function generateDocs({
  prdPath,
  targetProjectPath,
  archetype
}: GenerateDocsInput): Promise<string[]> {
  validateRequiredInput('target project path', targetProjectPath);
  validateRequiredInput('archetype', archetype);
  if (prdPath !== undefined) {
    validateRequiredInput('prd path', prdPath);
  }

  if (archetype !== SUPPORTED_ARCHETYPE) {
    throw new GenerationError(
      `unsupported archetype: ${archetype} (supported: ${SUPPORTED_ARCHETYPE})`
    );
  }

  const docsDirectory = join(targetProjectPath, 'docs');
  const outputPaths = REQUIRED_DOC_NAMES.map((name) => join(docsDirectory, name));

  await failIfOutputsExist(outputPaths);

  await mkdir(docsDirectory, { recursive: true });

  const projectName = basename(targetProjectPath) || 'project';

  let prdText: string;
  if (prdPath !== undefined) {
    try {
      prdText = await readFile(prdPath, 'utf8');
    } catch (error) {
      throw new GenerationError(`unable to read PRD file: ${prdPath}`, { cause: error });
    }
  } else {
    prdText = renderPrdStub(projectName);
  }

  const prdTitle = extractPrdTitle(prdText, projectName);
  const prdBullets = extractPrdBullets(prdText);
  const prdSections = extractPrdSections(prdText);

  const generatedContent = new Map<string, string>([
    ['prd.md', prdText],
    ['system.md', renderSystemDoc(projectName, prdTitle, prdBullets, prdSections)],
    ['pipeline.md', renderPipelineDoc(projectName, prdTitle, prdBullets, prdSections)],
    ['decisions.md', renderDecisionsDoc(projectName)],
    ['prd-ux-review.md', renderPrdUxReview(projectName, prdTitle, prdBullets, prdSections)],
    ['execution-guidance.md', renderExecutionGuidanceDoc(projectName)],
    ['validation.md', renderValidationDoc(projectName)],
    ['raes.config.yaml', renderRaesConfig(projectName)]
  ]);

  for (const outputPath of outputPaths) {
    const fileName = basename(outputPath);
    const content = generatedContent.get(fileName);
    if (!content) {
      throw new GenerationError(`missing generated content for ${fileName}`);
    }
    validateGeneratedDocShape(fileName, REQUIRED_DOC_HEADINGS[fileName] ?? [], content);
    await writeFile(outputPath, content, 'utf8');
  }

  return outputPaths;
}

async function failIfOutputsExist(outputPaths: string[]): Promise<void> {
  for (const outputPath of outputPaths) {
    try {
      await readFile(outputPath, 'utf8');
      throw new GenerationError(`conflicting target file: ${outputPath}`);
    } catch (error) {
      if (error instanceof GenerationError) {
        throw error;
      }
    }
  }
}

function validateRequiredInput(label: string, value: string): void {
  if (value.trim().length === 0) {
    throw new GenerationError(`missing required input: ${label}`);
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

function extractPrdSections(prdText: string): PrdSections {
  const sections: PrdSections = {
    coreFunctionality: [],
    constraints: [],
    openQuestions: []
  };

  let activeSection: keyof PrdSections | null = null;

  for (const line of prdText.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.startsWith('## ')) {
      activeSection = identifySection(trimmed.slice(3).trim());
      continue;
    }

    if (!activeSection || !trimmed.startsWith('- ')) {
      continue;
    }

    sections[activeSection].push(trimmed.slice(2).trim());
  }

  return sections;
}

export function validateGeneratedDocShape(
  fileName: string,
  requiredHeadings: string[],
  documentText: string
): void {
  const missingHeadings = requiredHeadings.filter((heading) => !documentText.includes(heading));

  if (missingHeadings.length > 0) {
    throw new GenerationError(
      `generated ${fileName} is missing required sections: ${missingHeadings.join(', ')}`
    );
  }
}

function identifySection(heading: string): keyof PrdSections | null {
  const normalized = heading.trim().toLowerCase();

  if (normalized === 'core functionality') {
    return 'coreFunctionality';
  }

  if (normalized === 'constraints') {
    return 'constraints';
  }

  if (normalized === 'open questions') {
    return 'openQuestions';
  }

  return null;
}

function renderPrdStub(projectName: string): string {
  return [
    `# ${projectName}`,
    '',
    '## Overview',
    '',
    '## Goals',
    '',
    '## Non-Goals',
    '',
    '## Constraints',
    '',
    '## Open Questions',
    ''
  ].join('\n');
}

function renderSystemDoc(
  projectName: string,
  prdTitle: string,
  prdBullets: string[],
  prdSections: PrdSections
): string {
  const productInvariants = renderBullets(prdSections.constraints, [
    'The generated docs should preserve the source PRD intent.',
    'Output must remain readable and editable markdown.'
  ]);
  const knownContracts = renderBullets(prdSections.coreFunctionality, [
    'Input mode: one readable PRD markdown file path.',
    'Target location: `<target>/docs/`.',
    `Supported archetype: \`${SUPPORTED_ARCHETYPE}\`.`,
    'Generated files: `PRD.md`, `system.md`, `pipeline.md`, `decisions.md`, and `prd-ux-review.md`.'
  ]);
  const unknowns = renderBullets(prdSections.openQuestions, [
    'How much PRD normalization should be applied beyond copying `PRD.md`.',
    'How future archetypes should adapt the output set.',
    'What validation is needed beyond the narrow happy path.'
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
    knownContracts,
    '',
    '## Unknowns',
    '',
    unknowns,
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

function renderPipelineDoc(
  projectName: string,
  prdTitle: string,
  prdBullets: string[],
  prdSections: PrdSections
): string {
  const knownContracts = renderBullets(prdSections.coreFunctionality, [
    'The project should use the PRD as the source of truth for generated docs.'
  ]);
  const unknowns = renderBullets(prdSections.openQuestions, [
    'How much validation should happen before generation.',
    'How far PRD adaptation should go in later slices.'
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
    unknowns,
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
  return [
    `# ${projectName} — decisions.md`,
    '',
    '## Durable Decisions',
    '',
    '| Decision | Rationale | Date |',
    '|---|---|---|',
    ''
  ].join('\n');
}

function renderExecutionGuidanceDoc(projectName: string): string {
  return [
    `# ${projectName} — execution-guidance.md`,
    '',
    '## Invariants',
    '',
    '## Workflow Rules',
    '',
    '## Anti-Patterns',
    '',
    '## Definition of Done',
    ''
  ].join('\n');
}

function renderValidationDoc(projectName: string): string {
  return [
    `# ${projectName} — validation.md`,
    '',
    '## Testing Approach',
    '',
    '## Validation Commands',
    '',
    '## Known Constraints',
    ''
  ].join('\n');
}

function renderRaesConfig(projectName: string): string {
  return [
    `project:`,
    `  name: ${projectName}`,
    ``,
    `sources:`,
    `  build_intent: docs/prd.md`,
    `  next_slice:`,
    `    path: docs/pipeline.md`,
    `    selection_rule: first_unchecked_slice`,
    `  durable_decisions: docs/decisions.md`,
    `  execution_guidance: docs/execution-guidance.md`,
    `  validation: docs/validation.md`,
    ``
  ].join('\n');
}

function renderPrdUxReview(
  projectName: string,
  prdTitle: string,
  prdBullets: string[],
  prdSections: PrdSections
): string {
  const observedRequirements = renderBullets(prdSections.coreFunctionality, [
    'The PRD should remain the source of truth for operator expectations.'
  ]);
  const uxRisks = renderBullets(deriveCliUxRisks(prdSections), [
    'Users may not know what happens when docs already exist at the target path.',
    'The scope of supported input modes may be unclear if the CLI surface expands early.'
  ]);
  const openQuestions = renderBullets(prdSections.openQuestions, [
    'Should future versions support inline PRD input?',
    'What level of normalization is appropriate for copied PRD content?'
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
    uxRisks,
    '',
    '## Open Questions',
    '',
    openQuestions,
    ''
  ].join('\n');
}

function deriveCliUxRisks(prdSections: PrdSections): string[] {
  const sourceBullets = [...prdSections.coreFunctionality, ...prdSections.constraints];
  const normalizedBullets = sourceBullets.map((bullet) => bullet.toLowerCase());
  const risks: string[] = [];

  if (normalizedBullets.some((bullet) => bullet.includes('path') || bullet.includes('file'))) {
    risks.push('Operators need a clear failure moment when the provided file path cannot be read.');
  }

  if (normalizedBullets.some((bullet) => bullet.includes('validate'))) {
    risks.push('Operators need immediate feedback when validation blocks generation.');
  }

  if (normalizedBullets.some((bullet) => bullet.includes('existing docs'))) {
    risks.push('Operators need a clear explanation when existing docs already exist at the target path.');
  }

  if (
    normalizedBullets.some(
      (bullet) => bullet.includes('archetype') || bullet.includes(SUPPORTED_ARCHETYPE)
    )
  ) {
    risks.push('Operators need to understand the accepted archetype before generation starts.');
  }

  return risks;
}

function renderBullets(items: string[], fallbackItems: string[]): string {
  const values = items.length > 0 ? items : fallbackItems;
  return values.map((item) => `- ${item}`).join('\n');
}
