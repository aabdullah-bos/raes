import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  GenerationError,
  generateDocs,
  validateGeneratedDocShape
} from '../src/generate-docs.ts';
import { main } from '../src/cli.ts';

function sectionBody(documentText: string, heading: string): string {
  const parts = documentText.split(`## ${heading}\n\n`);
  assert.equal(parts.length >= 2, true, `missing section: ${heading}`);
  return parts[1].split('\n## ')[0];
}

test('generates the RAES docs set for the narrow happy path', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const sourcePrd = join(tempRoot, 'source-prd.md');
  const targetProject = join(tempRoot, 'sample-widget');

  await writeFile(
    sourcePrd,
    [
      '# Sample Widget CLI',
      '',
      '## Purpose',
      '',
      'Create a widget management CLI for operators.',
      '',
      '## Core Functionality',
      '',
      '- Operators can create a widget definition from a template.',
      '- Operators can validate required widget fields before saving.'
    ].join('\n'),
    'utf8'
  );

  const generated = await generateDocs({
    prdPath: sourcePrd,
    targetProjectPath: targetProject,
    archetype: 'cli-doc-generator'
  });

  const docsDir = join(targetProject, 'docs');
  assert.deepEqual(generated, [
    join(docsDir, 'prd.md'),
    join(docsDir, 'system.md'),
    join(docsDir, 'pipeline.md'),
    join(docsDir, 'decisions.md'),
    join(docsDir, 'prd-ux-review.md'),
    join(docsDir, 'execution-guidance.md'),
    join(docsDir, 'validation.md'),
    join(docsDir, 'raes.config.yaml')
  ]);

  const prdText = await readFile(join(docsDir, 'prd.md'), 'utf8');
  assert.equal(prdText, await readFile(sourcePrd, 'utf8'));

  const systemText = await readFile(join(docsDir, 'system.md'), 'utf8');
  assert.match(systemText, /# sample-widget/);
  assert.match(systemText, /Sample Widget CLI/);
  assert.match(systemText, /## Product Invariants/);
  assert.match(systemText, /## Unknowns/);

  const pipelineText = await readFile(join(docsDir, 'pipeline.md'), 'utf8');
  assert.match(pipelineText, /# sample-widget/);
  assert.match(pipelineText, /## Slice Backlog/);
  assert.match(pipelineText, /\[ \] Slice 1/);

  const decisionsText = await readFile(join(docsDir, 'decisions.md'), 'utf8');
  assert.match(decisionsText, /# sample-widget/);
  assert.match(decisionsText, /## Durable Decisions/);

  const reviewText = await readFile(join(docsDir, 'prd-ux-review.md'), 'utf8');
  assert.match(reviewText, /# sample-widget/);
  assert.match(reviewText, /## Open Questions/);
});

test('rejects unsupported archetypes without writing files', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const sourcePrd = join(tempRoot, 'source-prd.md');
  const targetProject = join(tempRoot, 'target-project');

  await writeFile(sourcePrd, '# Product\n', 'utf8');

  await assert.rejects(
    generateDocs({
      prdPath: sourcePrd,
      targetProjectPath: targetProject,
      archetype: 'unknown-archetype'
    }),
    {
      name: 'Error',
      message: 'unsupported archetype: unknown-archetype (supported: cli-doc-generator, frontend-backend-ai-app, cli)'
    }
  );
});

test('fails before partial generation when any target file already exists', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const sourcePrd = join(tempRoot, 'source-prd.md');
  const targetProject = join(tempRoot, 'target-project');
  const docsDir = join(targetProject, 'docs');

  await writeFile(sourcePrd, '# Product\n', 'utf8');
  await mkdir(docsDir, { recursive: true });
  await writeFile(join(docsDir, 'system.md'), 'existing', 'utf8');

  await assert.rejects(
    generateDocs({
      prdPath: sourcePrd,
      targetProjectPath: targetProject,
      archetype: 'cli-doc-generator'
    }),
    {
      name: 'Error',
      message: `conflicting target file: ${join(docsDir, 'system.md')}`
    }
  );

  await assert.rejects(readFile(join(docsDir, 'PRD.md'), 'utf8'));
  await assert.rejects(readFile(join(docsDir, 'pipeline.md'), 'utf8'));
  await assert.rejects(readFile(join(docsDir, 'decisions.md'), 'utf8'));
  await assert.rejects(readFile(join(docsDir, 'prd-ux-review.md'), 'utf8'));
  assert.equal(await readFile(join(docsDir, 'system.md'), 'utf8'), 'existing');
});

test('returns an explicit error for missing CLI input', async () => {
  const messages: string[] = [];
  const originalConsoleError = console.error;
  console.error = (message?: unknown) => {
    messages.push(String(message ?? ''));
  };

  try {
    const exitCode = await main([]);
    assert.equal(exitCode, 1);
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(messages, [
    'missing required arguments',
    'usage: raes-init <target-project-path> <archetype>',
    '       raes-init --from-prd <prd-path> <target-project-path> <archetype>'
  ]);
});

test('rejects an unreadable PRD path with an explicit message', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const missingPrd = join(tempRoot, 'missing-prd.md');
  const targetProject = join(tempRoot, 'target-project');

  await assert.rejects(
    generateDocs({
      prdPath: missingPrd,
      targetProjectPath: targetProject,
      archetype: 'cli-doc-generator'
    }),
    {
      name: 'Error',
      message: `unable to read PRD file: ${missingPrd}`
    }
  );
});

test('adapts PRD sections into project-specific constraints, known contracts, and unknowns', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const sourcePrd = join(tempRoot, 'source-prd.md');
  const targetProject = join(tempRoot, 'manifest-tool');

  await writeFile(
    sourcePrd,
    [
      '# Widget Manifest Tool',
      '',
      '## Core Functionality',
      '',
      '- Import a widget manifest from a markdown file path.',
      '- Validate required manifest fields before generation.',
      '',
      '## Constraints',
      '',
      '- The tool must only support the cli-doc-generator archetype in V1.',
      '- Existing docs must cause the run to fail before any writes.',
      '',
      '## Open Questions',
      '',
      '- Should future versions accept inline PRD text?',
      '- How much normalization should PRD.md apply?'
    ].join('\n'),
    'utf8'
  );

  await generateDocs({
    prdPath: sourcePrd,
    targetProjectPath: targetProject,
    archetype: 'cli-doc-generator'
  });

  const docsDir = join(targetProject, 'docs');
  const systemText = await readFile(join(docsDir, 'system.md'), 'utf8');
  const pipelineText = await readFile(join(docsDir, 'pipeline.md'), 'utf8');
  const reviewText = await readFile(join(docsDir, 'prd-ux-review.md'), 'utf8');
  const systemProductInvariants = sectionBody(systemText, 'Product Invariants');
  const systemKnownContracts = sectionBody(systemText, 'Known Contracts');
  const systemUnknowns = sectionBody(systemText, 'Unknowns');
  const pipelineKnownContracts = sectionBody(pipelineText, 'Known Contracts');
  const pipelineUnknowns = sectionBody(pipelineText, 'Unknowns');
  const reviewOpenQuestions = sectionBody(reviewText, 'Open Questions');

  assert.match(systemProductInvariants, /must only support the cli-doc-generator archetype in V1/);
  assert.match(systemKnownContracts, /Import a widget manifest from a markdown file path/);
  assert.match(systemUnknowns, /Should future versions accept inline PRD text/);
  assert.doesNotMatch(systemKnownContracts, /Should future versions accept inline PRD text/);

  assert.match(pipelineKnownContracts, /Validate required manifest fields before generation/);
  assert.match(pipelineUnknowns, /How much normalization should PRD.md apply/);
  assert.doesNotMatch(pipelineKnownContracts, /How much normalization should PRD.md apply/);

  assert.match(reviewOpenQuestions, /Should future versions accept inline PRD text/);
});

test('fallback system known contracts names all 8 generated files', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const sourcePrd = join(tempRoot, 'source-prd.md');
  const targetProject = join(tempRoot, 'fallback-contracts-tool');

  await writeFile(sourcePrd, '# Fallback Contracts Tool\n', 'utf8');

  await generateDocs({
    prdPath: sourcePrd,
    targetProjectPath: targetProject,
    archetype: 'cli-doc-generator'
  });

  const systemText = await readFile(join(targetProject, 'docs', 'system.md'), 'utf8');
  const knownContracts = sectionBody(systemText, 'Known Contracts');

  assert.match(
    knownContracts,
    /Generated files: `prd\.md`, `system\.md`, `pipeline\.md`, `decisions\.md`, `prd-ux-review\.md`, `execution-guidance\.md`, `validation\.md`, and `raes\.config\.yaml`\./
  );
});

test('fails clearly when a generated doc shape omits required sections', () => {
  assert.throws(
    () =>
      validateGeneratedDocShape(
        'pipeline.md',
        ['## Purpose', '## Invariants', '## Known Contracts'],
        ['# sample-project — pipeline.md', '', '## Purpose', '', 'narrow pipeline'].join('\n')
      ),
    {
      name: 'Error',
      message:
        'generated pipeline.md is missing required sections: ## Invariants, ## Known Contracts'
    }
  );
});

test('generates raes.config.yaml with required source keys pointing to correct paths', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const sourcePrd = join(tempRoot, 'source-prd.md');
  const targetProject = join(tempRoot, 'config-check-tool');

  await writeFile(sourcePrd, '# Config Check Tool\n', 'utf8');

  await generateDocs({
    prdPath: sourcePrd,
    targetProjectPath: targetProject,
    archetype: 'cli-doc-generator'
  });

  const configText = await readFile(join(targetProject, 'docs', 'raes.config.yaml'), 'utf8');
  assert.match(configText, /name: config-check-tool/);
  assert.match(configText, /build_intent: docs\/prd\.md/);
  assert.match(configText, /path: docs\/pipeline\.md/);
  assert.match(configText, /selection_rule: first_unchecked_slice/);
  assert.match(configText, /durable_decisions: docs\/decisions\.md/);
  assert.match(configText, /execution_guidance: docs\/execution-guidance\.md/);
  assert.match(configText, /validation: docs\/validation\.md/);
});

test('generates execution-guidance.md with required sections', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const sourcePrd = join(tempRoot, 'source-prd.md');
  const targetProject = join(tempRoot, 'guidance-check-tool');

  await writeFile(sourcePrd, '# Guidance Check Tool\n', 'utf8');

  await generateDocs({
    prdPath: sourcePrd,
    targetProjectPath: targetProject,
    archetype: 'cli-doc-generator'
  });

  const guidanceText = await readFile(join(targetProject, 'docs', 'execution-guidance.md'), 'utf8');
  assert.match(guidanceText, /# guidance-check-tool/);
  assert.match(guidanceText, /## Invariants/);
  assert.match(guidanceText, /## Workflow Rules/);
  assert.match(guidanceText, /## Anti-Patterns/);
  assert.match(guidanceText, /## Definition of Done/);
  assert.match(guidanceText, /### Constraint Promotion/);
  assert.match(guidanceText, /### Emergent Work/);
  assert.match(guidanceText, /system\.md/);
  assert.match(guidanceText, /decisions\.md/);
  assert.match(guidanceText, /Parking Lot/);
  assert.match(guidanceText, /Inline Fix/);
  assert.match(guidanceText, /Blocking = Yes/);
});

test('generates validation.md with required sections', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const sourcePrd = join(tempRoot, 'source-prd.md');
  const targetProject = join(tempRoot, 'validation-check-tool');

  await writeFile(sourcePrd, '# Validation Check Tool\n', 'utf8');

  await generateDocs({
    prdPath: sourcePrd,
    targetProjectPath: targetProject,
    archetype: 'cli-doc-generator'
  });

  const validationText = await readFile(join(targetProject, 'docs', 'validation.md'), 'utf8');
  assert.match(validationText, /# validation-check-tool/);
  assert.match(validationText, /## Testing Approach/);
  assert.match(validationText, /## Validation Commands/);
  assert.match(validationText, /## Known Constraints/);
});

test('generates decisions.md with a Decision Log table stub', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const sourcePrd = join(tempRoot, 'source-prd.md');
  const targetProject = join(tempRoot, 'decisions-check-tool');

  await writeFile(sourcePrd, '# Decisions Check Tool\n', 'utf8');

  await generateDocs({
    prdPath: sourcePrd,
    targetProjectPath: targetProject,
    archetype: 'cli-doc-generator'
  });

  const decisionsText = await readFile(join(targetProject, 'docs', 'decisions.md'), 'utf8');
  assert.match(decisionsText, /\| Decision \|/);
  assert.match(decisionsText, /\| Rationale \|/);
  assert.match(decisionsText, /\| Date \|/);
});

test('generates all 8 files in bare greenfield mode when no prdPath is provided', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const targetProject = join(tempRoot, 'greenfield-tool');

  const generated = await generateDocs({
    targetProjectPath: targetProject,
    archetype: 'cli-doc-generator'
  });

  const docsDir = join(targetProject, 'docs');
  assert.deepEqual(generated, [
    join(docsDir, 'prd.md'),
    join(docsDir, 'system.md'),
    join(docsDir, 'pipeline.md'),
    join(docsDir, 'decisions.md'),
    join(docsDir, 'prd-ux-review.md'),
    join(docsDir, 'execution-guidance.md'),
    join(docsDir, 'validation.md'),
    join(docsDir, 'raes.config.yaml')
  ]);
});

test('bare greenfield prd.md is a stub with expected section headers', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const targetProject = join(tempRoot, 'stub-check-tool');

  await generateDocs({
    targetProjectPath: targetProject,
    archetype: 'cli-doc-generator'
  });

  const prdText = await readFile(join(targetProject, 'docs', 'prd.md'), 'utf8');
  assert.match(prdText, /## Overview/);
  assert.match(prdText, /## Goals/);
  assert.match(prdText, /## Non-Goals/);
  assert.match(prdText, /## Constraints/);
  assert.match(prdText, /## Open Questions/);
});

test('bare greenfield raes.config.yaml has all required source keys', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const targetProject = join(tempRoot, 'greenfield-config-tool');

  await generateDocs({
    targetProjectPath: targetProject,
    archetype: 'cli-doc-generator'
  });

  const configText = await readFile(join(targetProject, 'docs', 'raes.config.yaml'), 'utf8');
  assert.match(configText, /name: greenfield-config-tool/);
  assert.match(configText, /build_intent: docs\/prd\.md/);
  assert.match(configText, /path: docs\/pipeline\.md/);
  assert.match(configText, /selection_rule: first_unchecked_slice/);
  assert.match(configText, /durable_decisions: docs\/decisions\.md/);
  assert.match(configText, /execution_guidance: docs\/execution-guidance\.md/);
  assert.match(configText, /validation: docs\/validation\.md/);
});

test('bare greenfield all paths referenced in config exist after init', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const targetProject = join(tempRoot, 'path-check-tool');

  await generateDocs({
    targetProjectPath: targetProject,
    archetype: 'cli-doc-generator'
  });

  const docsDir = join(targetProject, 'docs');
  for (const path of [
    join(docsDir, 'prd.md'),
    join(docsDir, 'pipeline.md'),
    join(docsDir, 'decisions.md'),
    join(docsDir, 'execution-guidance.md'),
    join(docsDir, 'validation.md')
  ]) {
    await assert.doesNotReject(readFile(path, 'utf8'), `expected ${path} to exist`);
  }
});

test('derives CLI-oriented UX risks and open questions from PRD workflow failure moments', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const sourcePrd = join(tempRoot, 'source-prd.md');
  const targetProject = join(tempRoot, 'review-tool');

  await writeFile(
    sourcePrd,
    [
      '# Review Tool',
      '',
      '## Core Functionality',
      '',
      '- Accept a source PRD markdown file path from the operator.',
      '- Validate required inputs before generation starts.',
      '',
      '## Constraints',
      '',
      '- Existing docs must cause the run to fail before any writes.',
      '- The tool must only support the cli-doc-generator archetype in V1.',
      '',
      '## Open Questions',
      '',
      '- Should PRD headings be normalized before copying?'
    ].join('\n'),
    'utf8'
  );

  await generateDocs({
    prdPath: sourcePrd,
    targetProjectPath: targetProject,
    archetype: 'cli-doc-generator'
  });

  const reviewText = await readFile(join(targetProject, 'docs', 'prd-ux-review.md'), 'utf8');
  const uxRisks = sectionBody(reviewText, 'UX Risks');
  const openQuestions = sectionBody(reviewText, 'Open Questions');

  assert.match(uxRisks, /provided file path cannot be read/);
  assert.match(uxRisks, /validation blocks generation/);
  assert.match(uxRisks, /existing docs already exist at the target path/);
  assert.match(openQuestions, /Should PRD headings be normalized before copying/);
});

test('generates all 8 files for the frontend-backend-ai-app archetype', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const sourcePrd = join(tempRoot, 'source-prd.md');
  const targetProject = join(tempRoot, 'my-ai-app');

  await writeFile(sourcePrd, '# My AI App\n', 'utf8');

  const generated = await generateDocs({
    prdPath: sourcePrd,
    targetProjectPath: targetProject,
    archetype: 'frontend-backend-ai-app'
  });

  const docsDir = join(targetProject, 'docs');
  assert.deepEqual(generated, [
    join(docsDir, 'prd.md'),
    join(docsDir, 'system.md'),
    join(docsDir, 'pipeline.md'),
    join(docsDir, 'decisions.md'),
    join(docsDir, 'prd-ux-review.md'),
    join(docsDir, 'execution-guidance.md'),
    join(docsDir, 'validation.md'),
    join(docsDir, 'raes.config.yaml')
  ]);
});

test('uses provider output for pipeline.md when provider and prdPath are both set', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const sourcePrd = join(tempRoot, 'source-prd.md');
  const targetProject = join(tempRoot, 'ai-pipeline-tool');

  await writeFile(
    sourcePrd,
    ['# AI Pipeline Tool', '', '## Core Functionality', '', '- Do a thing.'].join('\n'),
    'utf8'
  );

  const mockPipelineContent = [
    '# AI Pipeline Tool — pipeline.md',
    '',
    '## Purpose',
    '',
    'AI-derived purpose from PRD.',
    '',
    '## Invariants',
    '',
    '### Product Invariants',
    '',
    '- AI-derived invariant.',
    '',
    '### Drift Guards',
    '',
    '- One slice per session.',
    '',
    '## Known Contracts',
    '',
    '- Do a thing.',
    '',
    '## Unknowns',
    '',
    '- TBD.',
    '',
    '## Slice Backlog',
    '',
    '### Milestone 1',
    '',
    '- [ ] Slice 1: Initial implementation.',
    '',
    '## Handoff Notes',
    ''
  ].join('\n');

  const mockDecisionsContent = [
    '# AI Pipeline Tool — decisions.md',
    '',
    '## Durable Decisions',
    '',
    '| Decision | Rationale | Date |',
    '|---|---|---|',
    '| Use markdown output | Keeps docs human-readable | 2026-04-24 |',
    ''
  ].join('\n');

  const mockExecutionGuidanceContent = [
    '# AI Pipeline Tool — execution-guidance.md',
    '',
    '## Invariants',
    '',
    '- Output must be readable markdown.',
    '',
    '## Workflow Rules',
    '',
    '- One slice per session.',
    '',
    '## Anti-Patterns',
    '',
    '- Do not overwrite existing docs.',
    '',
    '## Definition of Done',
    '',
    '- All required docs generated.',
    ''
  ].join('\n');

  let callCount = 0;
  let capturedPipelinePrompt = '';
  const mockProvider = {
    async complete(prompt: string): Promise<string> {
      callCount += 1;
      if (callCount === 1) {
        capturedPipelinePrompt = prompt;
        return mockPipelineContent;
      }
      if (callCount === 2) {
        return mockDecisionsContent;
      }
      return mockExecutionGuidanceContent;
    }
  };

  await generateDocs({
    prdPath: sourcePrd,
    targetProjectPath: targetProject,
    archetype: 'cli-doc-generator',
    provider: mockProvider
  });

  const pipelineText = await readFile(join(targetProject, 'docs', 'pipeline.md'), 'utf8');
  assert.equal(pipelineText, mockPipelineContent);
  assert.match(capturedPipelinePrompt, /AI Pipeline Tool/);
  assert.match(capturedPipelinePrompt, /cli-doc-generator/);
  assert.equal(callCount, 3);
});

test('rejects AI pipeline.md missing required headings before any writes', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const sourcePrd = join(tempRoot, 'source-prd.md');
  const targetProject = join(tempRoot, 'bad-ai-pipeline-tool');

  await writeFile(sourcePrd, '# Bad AI Pipeline Tool\n', 'utf8');

  const mockProvider = {
    async complete(_prompt: string): Promise<string> {
      return '# Bad Output\n\nMissing required headings.\n';
    }
  };

  await assert.rejects(
    generateDocs({
      prdPath: sourcePrd,
      targetProjectPath: targetProject,
      archetype: 'cli-doc-generator',
      provider: mockProvider
    }),
    (err: unknown) => {
      assert(err instanceof GenerationError);
      assert.match(err.message, /generated pipeline\.md is missing required sections/);
      return true;
    }
  );

  const docsDir = join(targetProject, 'docs');
  await assert.rejects(readFile(join(docsDir, 'prd.md'), 'utf8'), 'no files should be written');
  await assert.rejects(access(docsDir), 'docs directory should not be created before validation passes');
});

test('bare greenfield mode does not call provider even when provider is present', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const targetProject = join(tempRoot, 'greenfield-with-provider');

  let providerCalled = false;
  const mockProvider = {
    async complete(_prompt: string): Promise<string> {
      providerCalled = true;
      return 'should not be called';
    }
  };

  await generateDocs({
    targetProjectPath: targetProject,
    archetype: 'cli-doc-generator',
    provider: mockProvider
  });

  assert.equal(providerCalled, false);
  const pipelineText = await readFile(join(targetProject, 'docs', 'pipeline.md'), 'utf8');
  assert.match(pipelineText, /\[ \] Slice 1/);
});

test('frontend-backend-ai-app system.md reflects AI and frontend/backend concerns', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const sourcePrd = join(tempRoot, 'source-prd.md');
  const targetProject = join(tempRoot, 'chat-app');

  await writeFile(
    sourcePrd,
    [
      '# Chat App',
      '',
      '## Core Functionality',
      '',
      '- Users submit a message and receive an AI-generated reply.',
      '- The backend routes requests to the AI model provider.',
      '',
      '## Open Questions',
      '',
      '- Should responses be streamed to the client?'
    ].join('\n'),
    'utf8'
  );

  await generateDocs({
    prdPath: sourcePrd,
    targetProjectPath: targetProject,
    archetype: 'frontend-backend-ai-app'
  });

  const docsDir = join(targetProject, 'docs');
  const systemText = await readFile(join(docsDir, 'system.md'), 'utf8');
  const pipelineText = await readFile(join(docsDir, 'pipeline.md'), 'utf8');
  const reviewText = await readFile(join(docsDir, 'prd-ux-review.md'), 'utf8');

  assert.match(systemText, /frontend-backend-ai-app/);
  assert.match(systemText, /AI behavior should support the product flow/);
  assert.match(systemText, /provider-specific AI payloads/);
  assert.match(systemText, /The backend routes requests to the AI model provider/);

  assert.match(pipelineText, /Product Skeleton/);
  assert.match(pipelineText, /Happy Path Without Live AI/);
  assert.match(pipelineText, /Real AI Integration/);

  assert.match(reviewText, /Should responses be streamed/);
});

test('uses provider output for decisions.md and execution-guidance.md when provider and prdPath are set', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const sourcePrd = join(tempRoot, 'source-prd.md');
  const targetProject = join(tempRoot, 'ai-decisions-tool');

  await writeFile(
    sourcePrd,
    ['# AI Decisions Tool', '', '## Core Functionality', '', '- Process user input.'].join('\n'),
    'utf8'
  );

  const mockPipelineContent = [
    '# AI Decisions Tool — pipeline.md',
    '',
    '## Purpose',
    '',
    'Pipeline purpose.',
    '',
    '## Invariants',
    '',
    '- Invariant.',
    '',
    '## Known Contracts',
    '',
    '- Process user input.',
    '',
    '## Unknowns',
    '',
    '- TBD.',
    '',
    '## Slice Backlog',
    '',
    '- [ ] Slice 1: Initial implementation.',
    '',
    '## Handoff Notes',
    ''
  ].join('\n');

  const mockDecisionsContent = [
    '# AI Decisions Tool — decisions.md',
    '',
    '## Durable Decisions',
    '',
    '| Decision | Rationale | Date |',
    '|---|---|---|',
    '| Use markdown output | Human-readable | 2026-04-24 |',
    ''
  ].join('\n');

  const mockExecutionGuidanceContent = [
    '# AI Decisions Tool — execution-guidance.md',
    '',
    '## Invariants',
    '',
    '- Output must be valid markdown.',
    '',
    '## Workflow Rules',
    '',
    '- One slice per session.',
    '',
    '## Anti-Patterns',
    '',
    '- Do not overwrite existing docs.',
    '',
    '## Definition of Done',
    '',
    '- All required docs generated.',
    ''
  ].join('\n');

  let callCount = 0;
  let capturedDecisionsPrompt = '';
  let capturedGuidancePrompt = '';
  const mockProvider = {
    async complete(prompt: string): Promise<string> {
      callCount += 1;
      if (callCount === 1) return mockPipelineContent;
      if (callCount === 2) {
        capturedDecisionsPrompt = prompt;
        return mockDecisionsContent;
      }
      capturedGuidancePrompt = prompt;
      return mockExecutionGuidanceContent;
    }
  };

  await generateDocs({
    prdPath: sourcePrd,
    targetProjectPath: targetProject,
    archetype: 'cli-doc-generator',
    provider: mockProvider
  });

  const docsDir = join(targetProject, 'docs');
  const decisionsText = await readFile(join(docsDir, 'decisions.md'), 'utf8');
  const guidanceText = await readFile(join(docsDir, 'execution-guidance.md'), 'utf8');

  assert.equal(decisionsText, mockDecisionsContent);
  assert.equal(guidanceText, mockExecutionGuidanceContent);
  assert.match(capturedDecisionsPrompt, /AI Decisions Tool/);
  assert.match(capturedDecisionsPrompt, /\d{4}-\d{2}-\d{2}/);
  assert.match(capturedGuidancePrompt, /AI Decisions Tool/);
  assert.equal(callCount, 3);

  // validation.md is still a stub
  const validationText = await readFile(join(docsDir, 'validation.md'), 'utf8');
  assert.match(validationText, /## Testing Approach/);
  assert.match(validationText, /## Validation Commands/);
});

test('rejects AI decisions.md missing required headings before any writes', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const sourcePrd = join(tempRoot, 'source-prd.md');
  const targetProject = join(tempRoot, 'bad-ai-decisions-tool');

  await writeFile(sourcePrd, '# Bad AI Decisions Tool\n', 'utf8');

  const validPipelineContent = [
    '# Bad AI Decisions Tool — pipeline.md',
    '',
    '## Purpose',
    '',
    'Purpose.',
    '',
    '## Invariants',
    '',
    '- Invariant.',
    '',
    '## Known Contracts',
    '',
    '- Contract.',
    '',
    '## Unknowns',
    '',
    '- TBD.',
    '',
    '## Slice Backlog',
    '',
    '- [ ] Slice 1: Implementation.',
    '',
    '## Handoff Notes',
    ''
  ].join('\n');

  let callCount = 0;
  const mockProvider = {
    async complete(_prompt: string): Promise<string> {
      callCount += 1;
      if (callCount === 1) return validPipelineContent;
      return '# Bad Output\n\nMissing required headings.\n';
    }
  };

  await assert.rejects(
    generateDocs({
      prdPath: sourcePrd,
      targetProjectPath: targetProject,
      archetype: 'cli-doc-generator',
      provider: mockProvider
    }),
    (err: unknown) => {
      assert(err instanceof GenerationError);
      assert.match(err.message, /generated decisions\.md is missing required sections/);
      return true;
    }
  );

  const docsDir = join(targetProject, 'docs');
  await assert.rejects(readFile(join(docsDir, 'prd.md'), 'utf8'), 'no files should be written');
});

test('rejects AI execution-guidance.md missing required headings before any writes', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const sourcePrd = join(tempRoot, 'source-prd.md');
  const targetProject = join(tempRoot, 'bad-ai-guidance-tool');

  await writeFile(sourcePrd, '# Bad AI Guidance Tool\n', 'utf8');

  const validPipelineContent = [
    '# Bad AI Guidance Tool — pipeline.md',
    '',
    '## Purpose',
    '',
    'Purpose.',
    '',
    '## Invariants',
    '',
    '- Invariant.',
    '',
    '## Known Contracts',
    '',
    '- Contract.',
    '',
    '## Unknowns',
    '',
    '- TBD.',
    '',
    '## Slice Backlog',
    '',
    '- [ ] Slice 1: Implementation.',
    '',
    '## Handoff Notes',
    ''
  ].join('\n');

  const validDecisionsContent = [
    '# Bad AI Guidance Tool — decisions.md',
    '',
    '## Durable Decisions',
    '',
    '| Decision | Rationale | Date |',
    '|---|---|---|',
    ''
  ].join('\n');

  let callCount = 0;
  const mockProvider = {
    async complete(_prompt: string): Promise<string> {
      callCount += 1;
      if (callCount === 1) return validPipelineContent;
      if (callCount === 2) return validDecisionsContent;
      return '# Bad Output\n\nMissing required headings.\n';
    }
  };

  await assert.rejects(
    generateDocs({
      prdPath: sourcePrd,
      targetProjectPath: targetProject,
      archetype: 'cli-doc-generator',
      provider: mockProvider
    }),
    (err: unknown) => {
      assert(err instanceof GenerationError);
      assert.match(err.message, /generated execution-guidance\.md is missing required sections/);
      return true;
    }
  );

  const docsDir = join(targetProject, 'docs');
  await assert.rejects(readFile(join(docsDir, 'prd.md'), 'utf8'), 'no files should be written');
});

test('when prdPath is already the target docs/prd.md, it leaves it unchanged and generates all other files', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const targetProject = join(tempRoot, 'raes-execute');
  const docsDir = join(targetProject, 'docs');
  const targetPrdPath = join(docsDir, 'prd.md');

  await mkdir(docsDir, { recursive: true });
  const originalPrdContent = [
    '# raes-execute',
    '',
    '## Core Functionality',
    '',
    '- Execute RAES slices.',
    ''
  ].join('\n');
  await writeFile(targetPrdPath, originalPrdContent, 'utf8');

  const generated = await generateDocs({
    prdPath: targetPrdPath,
    targetProjectPath: targetProject,
    archetype: 'cli'
  });

  assert.deepEqual(generated, [
    join(docsDir, 'prd.md'),
    join(docsDir, 'system.md'),
    join(docsDir, 'pipeline.md'),
    join(docsDir, 'decisions.md'),
    join(docsDir, 'prd-ux-review.md'),
    join(docsDir, 'execution-guidance.md'),
    join(docsDir, 'validation.md'),
    join(docsDir, 'raes.config.yaml')
  ]);

  const prdText = await readFile(targetPrdPath, 'utf8');
  assert.equal(prdText, originalPrdContent, 'prd.md must remain unchanged');

  const systemText = await readFile(join(docsDir, 'system.md'), 'utf8');
  assert.match(systemText, /# raes-execute/);

  const configText = await readFile(join(docsDir, 'raes.config.yaml'), 'utf8');
  assert.match(configText, /build_intent: docs\/prd\.md/);
});

test('when prdPath is the target docs/prd.md, conflict check still rejects other pre-existing files', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const targetProject = join(tempRoot, 'raes-execute-conflict');
  const docsDir = join(targetProject, 'docs');
  const targetPrdPath = join(docsDir, 'prd.md');

  await mkdir(docsDir, { recursive: true });
  await writeFile(targetPrdPath, '# raes-execute-conflict\n', 'utf8');
  await writeFile(join(docsDir, 'system.md'), 'existing system', 'utf8');

  await assert.rejects(
    generateDocs({
      prdPath: targetPrdPath,
      targetProjectPath: targetProject,
      archetype: 'cli'
    }),
    {
      name: 'Error',
      message: `conflicting target file: ${join(docsDir, 'system.md')}`
    }
  );

  assert.equal(await readFile(targetPrdPath, 'utf8'), '# raes-execute-conflict\n');
});

test('generates the RAES docs set for the cli archetype', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'raes-init-'));
  const sourcePrd = join(tempRoot, 'source-prd.md');
  const targetProject = join(tempRoot, 'raes-execute');

  await writeFile(
    sourcePrd,
    [
      '# raes-execute',
      '',
      '## Core Functionality',
      '',
      '- Read raes.config.yaml to locate project artifacts.',
      '- Select the next unchecked slice from pipeline.md.',
      '- Call an AI provider to execute the slice.',
      '- Write updated state back to pipeline.md.',
      '',
      '## Constraints',
      '',
      '- Configuration must be validated before any execution begins.',
      '- The tool must exit with a non-zero code on any failure.',
      '',
      '## Open Questions',
      '',
      '- Should the tool support a dry-run mode?',
      '- What logging format is expected?'
    ].join('\n'),
    'utf8'
  );

  const generated = await generateDocs({
    prdPath: sourcePrd,
    targetProjectPath: targetProject,
    archetype: 'cli'
  });

  const docsDir = join(targetProject, 'docs');
  assert.deepEqual(generated, [
    join(docsDir, 'prd.md'),
    join(docsDir, 'system.md'),
    join(docsDir, 'pipeline.md'),
    join(docsDir, 'decisions.md'),
    join(docsDir, 'prd-ux-review.md'),
    join(docsDir, 'execution-guidance.md'),
    join(docsDir, 'validation.md'),
    join(docsDir, 'raes.config.yaml')
  ]);

  const systemText = await readFile(join(docsDir, 'system.md'), 'utf8');
  assert.match(systemText, /# raes-execute/);
  assert.match(systemText, /## Product Invariants/);
  assert.match(systemText, /## Known Contracts/);
  assert.match(systemText, /## Unknowns/);
  assert.match(systemText, /using the `?cli`? archetype/i);
  assert.doesNotMatch(systemText, /cli-doc-generator/);

  const pipelineText = await readFile(join(docsDir, 'pipeline.md'), 'utf8');
  assert.match(pipelineText, /# raes-execute/);
  assert.match(pipelineText, /## Slice Backlog/);
  assert.match(pipelineText, /\[ \] Slice 1/);
  assert.match(pipelineText, /Milestone 1/);
  assert.match(pipelineText, /Milestone 5/);

  const reviewText = await readFile(join(docsDir, 'prd-ux-review.md'), 'utf8');
  assert.match(reviewText, /# raes-execute/);
  assert.match(reviewText, /## Open Questions/);
  assert.match(reviewText, /Should the tool support a dry-run mode/);
});
