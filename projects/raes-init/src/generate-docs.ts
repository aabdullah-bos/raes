import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { Provider } from './provider.ts';

export const SUPPORTED_ARCHETYPES = ['cli-doc-generator', 'frontend-backend-ai-app'] as const;
export type SupportedArchetype = (typeof SUPPORTED_ARCHETYPES)[number];

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
  provider?: Provider;
};

type PrdSections = {
  coreFunctionality: string[];
  constraints: string[];
  openQuestions: string[];
};

export async function generateDocs({
  prdPath,
  targetProjectPath,
  archetype,
  provider
}: GenerateDocsInput): Promise<string[]> {
  validateRequiredInput('target project path', targetProjectPath);
  validateRequiredInput('archetype', archetype);
  if (prdPath !== undefined) {
    validateRequiredInput('prd path', prdPath);
  }

  if (!SUPPORTED_ARCHETYPES.includes(archetype as SupportedArchetype)) {
    throw new GenerationError(
      `unsupported archetype: ${archetype} (supported: ${SUPPORTED_ARCHETYPES.join(', ')})`
    );
  }

  const resolvedArchetype = archetype as SupportedArchetype;

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

  // Derive pipeline.md via AI when provider and prdPath are both present.
  // Shape guard runs here so validation fails before any writes.
  let pipelineMdContent: string;
  if (provider !== undefined && prdPath !== undefined) {
    const prompt = buildPipelinePrompt(prdText, resolvedArchetype);
    pipelineMdContent = await provider.complete(prompt);
    validateGeneratedDocShape('pipeline.md', REQUIRED_DOC_HEADINGS['pipeline.md'] ?? [], pipelineMdContent);
  } else {
    pipelineMdContent = renderPipelineDoc(resolvedArchetype, projectName, prdTitle, prdSections);
  }

  // Derive decisions.md via AI when provider and prdPath are both present.
  // Shape guard runs here so validation fails before any writes.
  let decisionsMdContent: string;
  if (provider !== undefined && prdPath !== undefined) {
    const prompt = buildDecisionsPrompt(prdText);
    decisionsMdContent = await provider.complete(prompt);
    validateGeneratedDocShape('decisions.md', REQUIRED_DOC_HEADINGS['decisions.md'] ?? [], decisionsMdContent);
  } else {
    decisionsMdContent = renderDecisionsDoc(projectName);
  }

  // Derive execution-guidance.md via AI when provider and prdPath are both present.
  // Shape guard runs here so validation fails before any writes.
  let executionGuidanceMdContent: string;
  if (provider !== undefined && prdPath !== undefined) {
    const prompt = buildExecutionGuidancePrompt(prdText);
    executionGuidanceMdContent = await provider.complete(prompt);
    validateGeneratedDocShape('execution-guidance.md', REQUIRED_DOC_HEADINGS['execution-guidance.md'] ?? [], executionGuidanceMdContent);
  } else {
    executionGuidanceMdContent = renderExecutionGuidanceDoc(projectName);
  }

  const generatedContent = new Map<string, string>([
    ['prd.md', prdText],
    ['system.md', renderSystemDoc(resolvedArchetype, projectName, prdTitle, prdSections)],
    ['pipeline.md', pipelineMdContent],
    ['decisions.md', decisionsMdContent],
    ['prd-ux-review.md', renderPrdUxReview(resolvedArchetype, projectName, prdTitle, prdSections)],
    ['execution-guidance.md', executionGuidanceMdContent],
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
  archetype: SupportedArchetype,
  projectName: string,
  prdTitle: string,
  prdSections: PrdSections
): string {
  if (archetype === 'frontend-backend-ai-app') {
    return renderSystemDocFrontendBackendAiApp(projectName, prdTitle, prdSections);
  }
  return renderSystemDocCliDocGenerator(projectName, prdTitle, prdSections);
}

function renderSystemDocCliDocGenerator(
  projectName: string,
  prdTitle: string,
  prdSections: PrdSections
): string {
  const productInvariants = renderBullets(prdSections.constraints, [
    'The generated docs should preserve the source PRD intent.',
    'Output must remain readable and editable markdown.'
  ]);
  const knownContracts = renderBullets(prdSections.coreFunctionality, [
    'Input mode: one readable PRD markdown file path.',
    'Target location: `<target>/docs/`.',
    `Supported archetypes: \`${SUPPORTED_ARCHETYPES.join('`, `')}\`.`,
    'Generated files: `prd.md`, `system.md`, `pipeline.md`, `decisions.md`, and `prd-ux-review.md`.'
  ]);
  const unknowns = renderBullets(prdSections.openQuestions, [
    'How much PRD normalization should be applied beyond copying `prd.md`.',
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
    `The project is initialized from the PRD \`${prdTitle}\` using the \`cli-doc-generator\` archetype.`,
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

function renderSystemDocFrontendBackendAiApp(
  projectName: string,
  prdTitle: string,
  prdSections: PrdSections
): string {
  const productInvariants = renderBullets(prdSections.constraints, [
    'The core user flow described in the PRD must remain intact unless explicitly changed.',
    'The frontend experience should remain understandable even when AI behavior is variable.',
    'AI behavior should support the product flow, not replace the product flow.',
    'The user should receive a legible response even when AI output is delayed, partial, or fails.'
  ]);
  const knownContracts = renderBullets(prdSections.coreFunctionality, [
    'Frontend ↔ backend boundary should be explicit.',
    'AI platform interaction should occur through a backend route, service, or adapter layer.',
    'Request and response shapes used by the frontend should be stable once introduced.',
    'Error states visible to the user should have predictable shapes and messages.'
  ]);
  const unknowns = renderBullets(prdSections.openQuestions, [
    'Exact provider or model selection.',
    'Prompt structure and prompt ownership.',
    'Streaming vs non-streaming response behavior.',
    'Latency handling and loading states.',
    'Fallback behavior when AI output is invalid or empty.',
    'Conversation or session memory behavior.'
  ]);

  return [
    `# ${projectName} — system.md`,
    '',
    '## Purpose',
    '',
    `This document defines the execution rules for \`${projectName}\`.`,
    '',
    `The project is initialized from the PRD \`${prdTitle}\` using the \`frontend-backend-ai-app\` archetype.`,
    '',
    '## Product Invariants',
    '',
    productInvariants,
    '',
    '## Drift Guards',
    '',
    '- Shared types are the source of truth for data exchanged across boundaries.',
    '- Do not couple frontend components directly to provider-specific AI payloads.',
    '- Do not rename or reshape known request/response contracts without explicit decision.',
    '- Mock or stub AI behavior in tests unless the slice explicitly concerns live integration.',
    '- One slice per session. Stop after completing the slice.',
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
    '- Do not put provider-specific response logic directly into UI components.',
    '- Do not make live AI calls part of default deterministic test runs.',
    '- Do not introduce multiple AI providers without an explicit decision.',
    '- Do not blur temporary scaffolding and durable contracts.',
    '- Do not let prompt structure become the only place where product logic lives.',
    '',
    '## Definition of Done',
    '',
    '1. The exact slice was named explicitly.',
    '2. Failing tests were written or updated first.',
    '3. The minimum implementation required for the slice was completed.',
    '4. Relevant tests and typecheck passed.',
    '5. Known contracts remain aligned.',
    '6. Any durable decision was recorded in `decisions.md`.',
    ''
  ].join('\n');
}

function buildPipelinePrompt(prdText: string, archetype: SupportedArchetype): string {
  return [
    `You are generating a RAES pipeline.md for a software project.`,
    ``,
    `Archetype: ${archetype}`,
    ``,
    `PRD:`,
    prdText,
    ``,
    `Generate a complete RAES pipeline.md document containing ALL of the following headings in order:`,
    `## Purpose`,
    `## Invariants`,
    `## Known Contracts`,
    `## Unknowns`,
    `## Slice Backlog`,
    `## Handoff Notes`,
    ``,
    `Under ## Slice Backlog, include at least one unchecked slice entry in the format:`,
    `- [ ] Slice N: <description>`,
    ``,
    `Under ## Invariants, include ### Product Invariants and ### Drift Guards subsections.`,
    ``,
    `Do not fabricate requirements not present in the PRD. Base all content on the PRD above.`,
    `Start the document with a # heading using the project name derived from the PRD title.`,
    `Output only the markdown document with no preamble or explanation.`
  ].join('\n');
}

function buildDecisionsPrompt(prdText: string): string {
  return [
    `You are generating a RAES decisions.md for a software project.`,
    ``,
    `PRD:`,
    prdText,
    ``,
    `Extract non-negotiable constraints, technology choices, and durable rules from the PRD as RAES decision entries.`,
    `Generate a complete RAES decisions.md document containing the following heading:`,
    `## Durable Decisions`,
    ``,
    `Under ## Durable Decisions, include a markdown table with columns: Decision | Rationale | Date.`,
    `Each row should capture one durable decision grounded in the PRD.`,
    ``,
    `Do not fabricate decisions not supported by the PRD. Base all content on the PRD above.`,
    `Start the document with a # heading using the project name derived from the PRD title.`,
    `Output only the markdown document with no preamble or explanation.`
  ].join('\n');
}

function buildExecutionGuidancePrompt(prdText: string): string {
  return [
    `You are generating a RAES execution-guidance.md for a software project.`,
    ``,
    `PRD:`,
    prdText,
    ``,
    `Derive invariants, workflow rules, anti-patterns, and definition of done grounded in the PRD constraints.`,
    `Generate a complete RAES execution-guidance.md document containing ALL of the following headings in order:`,
    `## Invariants`,
    `## Workflow Rules`,
    `## Anti-Patterns`,
    `## Definition of Done`,
    ``,
    `Do not fabricate guidance not supported by the PRD. Base all content on the PRD above.`,
    `Start the document with a # heading using the project name derived from the PRD title.`,
    `Output only the markdown document with no preamble or explanation.`
  ].join('\n');
}

function renderPipelineDoc(
  archetype: SupportedArchetype,
  projectName: string,
  prdTitle: string,
  prdSections: PrdSections
): string {
  if (archetype === 'frontend-backend-ai-app') {
    return renderPipelineDocFrontendBackendAiApp(projectName, prdTitle, prdSections);
  }
  return renderPipelineDocCliDocGenerator(projectName, prdTitle, prdSections);
}

function renderPipelineDocCliDocGenerator(
  projectName: string,
  prdTitle: string,
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

function renderPipelineDocFrontendBackendAiApp(
  projectName: string,
  prdTitle: string,
  prdSections: PrdSections
): string {
  const knownContracts = renderBullets(prdSections.coreFunctionality, [
    'Frontend ↔ backend boundary must be explicit.',
    'AI interaction occurs through a backend adapter layer.',
    'Request and response shapes are stable once introduced.'
  ]);
  const unknowns = renderBullets(prdSections.openQuestions, [
    'Model and provider selection.',
    'Streaming vs non-streaming response behavior.',
    'Retry and fallback behavior.',
    'UX around loading, partial output, and failure states.'
  ]);

  return [
    `# ${projectName} — pipeline.md`,
    '',
    '## Purpose',
    '',
    `This pipeline defines the execution path for \`${projectName}\` based on the PRD \`${prdTitle}\`.`,
    '',
    '## Invariants',
    '',
    '### Product Invariants',
    '',
    '- The core user flow must remain intact unless explicitly changed.',
    '- The frontend should remain legible even when AI behavior is variable.',
    '- AI interaction should support the product loop rather than redefine it.',
    '',
    '### Drift Guards',
    '',
    '- One slice per session.',
    '- Tests before implementation.',
    '- Shared types are the source of truth for data exchanged across boundaries.',
    '- Do not couple the UI directly to provider-specific payloads.',
    '- Do not use live AI calls in deterministic tests by default.',
    '- Stop after slice completion.',
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
    '### Milestone 1 — Product Skeleton',
    '',
    '- [ ] Slice 1: Establish minimal frontend shell for the core user flow.',
    '- [ ] Slice 2: Establish minimal backend or service entry point.',
    '- [ ] Slice 3: Establish shared types or boundary models where needed.',
    '',
    '### Milestone 2 — Happy Path Without Live AI',
    '',
    '- [ ] Slice 4: Implement frontend input/output flow against deterministic stubbed behavior.',
    '- [ ] Slice 5: Implement backend route or service with mockable AI dependency.',
    '',
    '### Milestone 3 — Real AI Integration',
    '',
    '- [ ] Slice 6: Connect backend layer to the chosen AI platform.',
    '- [ ] Slice 7: Handle loading, timeout, and failure behavior.',
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
  archetype: SupportedArchetype,
  projectName: string,
  prdTitle: string,
  prdSections: PrdSections
): string {
  if (archetype === 'frontend-backend-ai-app') {
    return renderPrdUxReviewFrontendBackendAiApp(projectName, prdTitle, prdSections);
  }
  return renderPrdUxReviewCliDocGenerator(projectName, prdTitle, prdSections);
}

function renderPrdUxReviewCliDocGenerator(
  projectName: string,
  prdTitle: string,
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

function renderPrdUxReviewFrontendBackendAiApp(
  projectName: string,
  prdTitle: string,
  prdSections: PrdSections
): string {
  const observedRequirements = renderBullets(prdSections.coreFunctionality, [
    'The PRD should remain the source of truth for user-facing behavior.'
  ]);
  const uxRisks = renderBullets(deriveProductUxRisks(prdSections), [
    'Users need legible feedback when AI output is delayed, partial, or absent.',
    'Transitions between loading, success, and failure states must be predictable.',
    'Variable AI output may violate user expectations if not constrained by the product flow.'
  ]);
  const openQuestions = renderBullets(prdSections.openQuestions, [
    'How should the UI behave when the AI provider is unavailable?',
    'What should the user see during streaming or long-running AI responses?',
    'Are there content or safety boundaries the UI must enforce?'
  ]);

  return [
    `# ${projectName} — prd-ux-review.md`,
    '',
    '## Purpose',
    '',
    `This review captures ambiguity and user-facing risk for \`${projectName}\` based on \`${prdTitle}\`.`,
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

function deriveProductUxRisks(prdSections: PrdSections): string[] {
  const sourceBullets = [...prdSections.coreFunctionality, ...prdSections.constraints];
  const normalized = sourceBullets.map((b) => b.toLowerCase());
  const risks: string[] = [];

  if (normalized.some((b) => b.includes('ai') || b.includes('model') || b.includes('generat'))) {
    risks.push('Users need legible feedback when AI output is delayed, partial, or absent.');
  }

  if (normalized.some((b) => b.includes('stream'))) {
    risks.push('Streaming responses require visible incremental progress to avoid perceived hangs.');
  }

  if (normalized.some((b) => b.includes('error') || b.includes('fail') || b.includes('invalid'))) {
    risks.push('Error states must be distinguishable from loading states in the UI.');
  }

  if (normalized.some((b) => b.includes('auth') || b.includes('login') || b.includes('session'))) {
    risks.push('Session expiry or auth failure during an AI interaction must produce a clear recovery path.');
  }

  return risks;
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
      (bullet) => bullet.includes('archetype') || bullet.includes('cli-doc-generator')
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
