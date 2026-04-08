import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { GenerationError, generateDocs } from '../src/generate-docs.ts';

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
    join(docsDir, 'PRD.md'),
    join(docsDir, 'system.md'),
    join(docsDir, 'pipeline.md'),
    join(docsDir, 'decisions.md'),
    join(docsDir, 'prd-ux-review.md')
  ]);

  const prdText = await readFile(join(docsDir, 'PRD.md'), 'utf8');
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
      archetype: 'frontend-backend-ai-app'
    }),
    GenerationError
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
    GenerationError
  );

  await assert.rejects(readFile(join(docsDir, 'PRD.md'), 'utf8'));
  await assert.rejects(readFile(join(docsDir, 'pipeline.md'), 'utf8'));
  await assert.rejects(readFile(join(docsDir, 'decisions.md'), 'utf8'));
  await assert.rejects(readFile(join(docsDir, 'prd-ux-review.md'), 'utf8'));
  assert.equal(await readFile(join(docsDir, 'system.md'), 'utf8'), 'existing');
});
