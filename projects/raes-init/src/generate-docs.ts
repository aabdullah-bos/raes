import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import type { Provider } from './provider.ts';

export const SUPPORTED_ARCHETYPES = ['cli-doc-generator', 'frontend-backend-ai-app', 'cli'] as const;
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
  const targetPrdPath = join(docsDirectory, 'prd.md');
  const prdIsAlreadyAtTarget =
    prdPath !== undefined && resolve(prdPath) === resolve(targetPrdPath);

  const outputPaths = REQUIRED_DOC_NAMES.map((name) => join(docsDirectory, name));

  const pathsToCheckForConflict = prdIsAlreadyAtTarget
    ? outputPaths.filter((p) => basename(p) !== 'prd.md')
    : outputPaths;

  await failIfOutputsExist(pathsToCheckForConflict);

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
    const todayDate = new Date().toISOString().slice(0, 10);
    const prompt = buildDecisionsPrompt(prdText, todayDate);
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

  await mkdir(docsDirectory, { recursive: true });

  for (const outputPath of outputPaths) {
    const fileName = basename(outputPath);
    if (prdIsAlreadyAtTarget && fileName === 'prd.md') {
      continue;
    }
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
  if (archetype === 'cli') {
    return renderSystemDocCli(projectName, prdTitle, prdSections);
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
    'Generated files: `prd.md`, `system.md`, `pipeline.md`, `decisions.md`, `prd-ux-review.md`, `execution-guidance.md`, `validation.md`, and `raes.config.yaml`.'
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

function renderSystemDocCli(
  projectName: string,
  prdTitle: string,
  prdSections: PrdSections
): string {
  const productInvariants = renderBullets(prdSections.constraints, [
    'The tool must behave predictably given the same configuration and state.',
    'Configuration validation must complete before any side effects begin.',
    'The tool must exit with a non-zero code on any failure.',
    'Partial state mutations must be detectable or must not occur.'
  ]);
  const knownContracts = renderBullets(prdSections.coreFunctionality, [
    'Configuration file path and schema must be explicit before any reads are implemented.',
    'Exit code assignments must be recorded in `decisions.md` when introduced.',
    'External system interactions must go through an explicit adapter or service boundary.',
    'State files written or modified by the tool must have an explicit format and write behavior.'
  ]);
  const unknowns = renderBullets(prdSections.openQuestions, [
    'Exact configuration schema and required vs optional keys.',
    'Retry and timeout behavior for external calls.',
    'How partial failures are surfaced and recovered from.',
    'Whether the tool maintains local state between invocations.',
    'Logging verbosity and output format.'
  ]);

  return [
    `# ${projectName} — system.md`,
    '',
    '## Purpose',
    '',
    `This document defines the execution rules for \`${projectName}\`.`,
    '',
    `The project is initialized from the PRD \`${prdTitle}\` using the \`cli\` archetype.`,
    '',
    '## Product Invariants',
    '',
    productInvariants,
    '',
    '## Drift Guards',
    '',
    '- Command parsing, business logic, and I/O are separate layers. Do not conflate them.',
    '- Configuration is read once at startup and validated before any side effects begin.',
    '- Do not widen the command surface beyond what the current slice requires.',
    '- One slice per session. Stop after completing the slice.',
    '- Exit codes are a contract. Do not change them once established without an explicit decision.',
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
    '- Do not mix command parsing with business logic.',
    '- Do not read configuration after side effects have begun.',
    '- Do not introduce external adapters or providers speculatively.',
    '- Do not let exit code assignments become implicit — always record them explicitly.',
    '- Do not blur temporary scaffold code and durable command contracts.',
    '',
    '## Definition of Done',
    '',
    '1. The exact slice was named explicitly.',
    '2. Failing tests were written or updated first.',
    '3. The minimum implementation required for the slice was completed.',
    '4. Relevant tests and typecheck passed.',
    '5. Exit codes and config schema decisions are recorded in `decisions.md`.',
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

function buildDecisionsPrompt(prdText: string, todayDate: string): string {
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
    `Use ${todayDate} as the date for all decision entries.`,
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
  if (archetype === 'cli') {
    return renderPipelineDocCli(projectName, prdTitle, prdSections);
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

function renderPipelineDocCli(
  projectName: string,
  prdTitle: string,
  prdSections: PrdSections
): string {
  const knownContracts = renderBullets(prdSections.coreFunctionality, [
    'Configuration file path and schema must be explicit before execution begins.',
    'Exit code assignments are a contract — record them when introduced.',
    'External system adapter boundary must be explicit.',
    'State file write behavior must be defined before implementation.'
  ]);
  const unknowns = renderBullets(prdSections.openQuestions, [
    'Exact configuration schema and required keys.',
    'Retry and timeout behavior for external calls.',
    'Partial failure detection and recovery strategy.',
    'Logging verbosity and output format.'
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
    '- The tool must behave predictably given the same configuration and state.',
    '- Configuration validation must complete before any side effects begin.',
    '- The tool must exit with a non-zero code on any failure.',
    '- Partial state mutations must be detectable and recoverable.',
    '',
    '### Drift Guards',
    '',
    '- One slice per session.',
    '- Tests before implementation.',
    '- Command parsing, business logic, and I/O remain separate layers.',
    '- Exit codes are a contract — record them in `decisions.md` when introduced.',
    '- Do not use live external calls in deterministic tests by default.',
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
    '### Milestone 1 — Configuration and Entry Point',
    '',
    '- [ ] Slice 1: Establish the CLI entry point with command parsing.',
    '- [ ] Slice 2: Define and load the configuration file schema.',
    '- [ ] Slice 3: Validate configuration and fail fast on missing or invalid keys.',
    '',
    '### Milestone 2 — Happy Path Without Live External Calls',
    '',
    '- [ ] Slice 4: Implement the core command flow against deterministic stubbed dependencies.',
    '- [ ] Slice 5: Establish the adapter boundary for each external system.',
    '- [ ] Slice 6: Verify state reads and writes against the defined schema.',
    '- [ ] Slice 7: Confirm exit code behavior on success and known failure cases.',
    '',
    '### Milestone 3 — Core Execution Loop',
    '',
    '- [ ] Slice 8: Implement the primary business logic loop from the PRD.',
    '- [ ] Slice 9: Add validation for major state transitions.',
    '',
    '### Milestone 4 — Real External Integration',
    '',
    '- [ ] Slice 10: Connect the adapter layer to the real external system.',
    '- [ ] Slice 11: Handle timeout, retry, and failure behavior.',
    '',
    '### Milestone 5 — Polish and Hardening',
    '',
    '- [ ] Slice 12: Resolve major Unknowns that surfaced during execution.',
    '- [ ] Slice 13: Tighten exit code contracts and error messages.',
    '- [ ] Slice 14: Review PRD, operator experience notes, and decisions for drift.',
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
    '_Project-specific invariants go here._',
    '',
    '## Workflow Rules',
    '',
    '### Constraint Promotion',
    '',
    'When a decision during execution produces a durable constraint:',
    '1. Add the constraint to `system.md` (under Invariants, Drift Guards, or Contracts).',
    '2. Record the rationale in `decisions.md` with a reference to the `system.md` section where the constraint lives.',
    '',
    'The agent reads `system.md` for constraints; `decisions.md` only for rationale. This keeps the constraint surface small and stable.',
    '',
    '### Emergent Work',
    '',
    'When work is discovered during a slice that was not in the plan, classify it immediately:',
    '',
    '| Classification | Criteria | Action |',
    '|----------------|----------|--------|',
    '| **Inline Fix** | <5 lines, no interface touched | Do it now; note in handoff. No Parking Lot entry. |',
    '| **New Slice** | More lines or touches a contract; fits current milestone | Add Parking Lot entry. Promote at REVIEW. |',
    '| **New Milestone** | Out of scope; 3–8 slices to complete | Add Parking Lot entry. Stub a new milestone at REVIEW. |',
    '| **Sub-Project** | 5+ slices, own constraints and unknowns | Add Parking Lot entry. Create a subdirectory with its own `pipeline.md`. |',
    '',
    'If Blocking = Yes: stop the current slice and raise at REVIEW. The next slice does not start until the item is promoted or dismissed.',
    '',
    'Add all non-inline items to the `## Parking Lot` table in `pipeline.md`.',
    '',
    '## Anti-Patterns',
    '',
    '_Project-specific anti-patterns go here._',
    '',
    '## Definition of Done',
    '',
    '_Project-specific definition of done goes here._',
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
  if (archetype === 'cli') {
    return renderPrdUxReviewCli(projectName, prdTitle, prdSections);
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

function renderPrdUxReviewCli(
  projectName: string,
  prdTitle: string,
  prdSections: PrdSections
): string {
  const observedRequirements = renderBullets(prdSections.coreFunctionality, [
    'The PRD should remain the source of truth for operator-facing behavior.'
  ]);
  const uxRisks = renderBullets(deriveCliToolUxRisks(prdSections), [
    'Operators need a clear failure message when configuration is invalid or missing.',
    'Exit codes must be documented and consistent across all failure modes.',
    'Partial state mutations must be detectable — the operator must know whether to retry or recover.'
  ]);
  const openQuestions = renderBullets(prdSections.openQuestions, [
    'Should the tool support a dry-run mode before performing side effects?',
    'What is the expected output format for success and failure (structured JSON vs human-readable)?',
    'How should the operator be informed when the tool is waiting on a slow external call?'
  ]);

  return [
    `# ${projectName} — prd-ux-review.md`,
    '',
    '## Purpose',
    '',
    `This review captures operator experience ambiguity and risk for \`${projectName}\` based on \`${prdTitle}\`.`,
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

function deriveCliToolUxRisks(prdSections: PrdSections): string[] {
  const sourceBullets = [...prdSections.coreFunctionality, ...prdSections.constraints];
  const normalized = sourceBullets.map((b) => b.toLowerCase());
  const risks: string[] = [];

  if (normalized.some((b) => b.includes('config') || b.includes('yaml') || b.includes('setting'))) {
    risks.push('Operators need a clear error when required configuration keys are missing or have invalid values.');
  }

  if (normalized.some((b) => b.includes('exit') || b.includes('code') || b.includes('error'))) {
    risks.push('Operators need a consistent, documented exit code for each known failure mode.');
  }

  if (normalized.some((b) => b.includes('state') || b.includes('pipeline') || b.includes('checkpoint'))) {
    risks.push('Operators need to know whether a partial execution left state in an inconsistent condition.');
  }

  if (normalized.some((b) => b.includes('ai') || b.includes('provider') || b.includes('model') || b.includes('api'))) {
    risks.push('Operators need a clear error when the external provider is unreachable or returns an unexpected response.');
  }

  if (normalized.some((b) => b.includes('file') || b.includes('path') || b.includes('read') || b.includes('write'))) {
    risks.push('Operators need a clear failure message when a required file cannot be read or written.');
  }

  return risks;
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
