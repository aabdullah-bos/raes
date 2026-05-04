import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';

import { parseYaml, extractConfig, validatePaths, checkConfig } from '../src/config.ts';

// ---------------------------------------------------------------------------
// parseYaml
// ---------------------------------------------------------------------------

test('parseYaml: simple key-value', () => {
  const result = parseYaml('key: value\nother: thing');
  assert.deepEqual(result, { key: 'value', other: 'thing' });
});

test('parseYaml: nested sections', () => {
  const yaml = `
project:
  name: my-project
`;
  const result = parseYaml(yaml);
  assert.deepEqual(result, { project: { name: 'my-project' } });
});

test('parseYaml: two-level nesting', () => {
  const yaml = `
sources:
  next_slice:
    path: docs/pipeline.md
    selection_rule: first_unchecked_slice
  build_intent: docs/prd.md
`;
  const result = parseYaml(yaml);
  assert.deepEqual(result, {
    sources: {
      next_slice: {
        path: 'docs/pipeline.md',
        selection_rule: 'first_unchecked_slice',
      },
      build_intent: 'docs/prd.md',
    },
  });
});

test('parseYaml: skips empty lines and comments', () => {
  const yaml = `
# This is a comment
key: value

# another comment
other: thing
`;
  const result = parseYaml(yaml);
  assert.deepEqual(result, { key: 'value', other: 'thing' });
});

test('parseYaml: value containing colon', () => {
  const result = parseYaml('message: error: bad thing');
  assert.deepEqual(result, { message: 'error: bad thing' });
});

test('parseYaml: full raes.config.yaml shape', () => {
  const yaml = `
project:
  name: raes-execute

sources:
  build_intent: docs/prd.md
  system_constraints: docs/system.md
  next_slice:
    path: docs/pipeline.md
    selection_rule: first_unchecked_slice
  durable_decisions: docs/decisions.md
  execution_guidance: docs/execution-guidance.md
  validation: docs/validation.md
`;
  const result = parseYaml(yaml);
  assert.deepEqual(result, {
    project: { name: 'raes-execute' },
    sources: {
      build_intent: 'docs/prd.md',
      system_constraints: 'docs/system.md',
      next_slice: {
        path: 'docs/pipeline.md',
        selection_rule: 'first_unchecked_slice',
      },
      durable_decisions: 'docs/decisions.md',
      execution_guidance: 'docs/execution-guidance.md',
      validation: 'docs/validation.md',
    },
  });
});

// ---------------------------------------------------------------------------
// extractConfig
// ---------------------------------------------------------------------------

const VALID_PARSED = {
  project: { name: 'my-project' },
  sources: {
    build_intent: 'docs/prd.md',
    system_constraints: 'docs/system.md',
    next_slice: {
      path: 'docs/pipeline.md',
      selection_rule: 'first_unchecked_slice',
    },
    durable_decisions: 'docs/decisions.md',
    execution_guidance: 'docs/execution-guidance.md',
    validation: 'docs/validation.md',
  },
};

test('extractConfig: valid parsed data returns config with no errors', () => {
  const { config, errors } = extractConfig(VALID_PARSED);
  assert.ok(config, 'expected config to be defined');
  assert.equal(errors.length, 0);
  assert.equal(config.project.name, 'my-project');
});

test('extractConfig: missing project section reports error with fix', () => {
  const { config, errors } = extractConfig({ sources: VALID_PARSED.sources });
  assert.equal(config, undefined);
  assert.ok(errors.some((e) => e.field.includes('project')));
  assert.ok(errors.some((e) => e.fix && e.fix.length > 0), 'expected fix guidance');
});

test('extractConfig: empty project.name reports error with fix', () => {
  const data = { ...VALID_PARSED, project: { name: '' } };
  const { errors } = extractConfig(data);
  assert.ok(errors.some((e) => e.field.includes('project.name')));
  assert.ok(errors.some((e) => e.fix && e.fix.length > 0), 'expected fix guidance');
});

test('extractConfig: missing sources section reports error with fix', () => {
  const { config, errors } = extractConfig({ project: { name: 'x' } });
  assert.equal(config, undefined);
  assert.ok(errors.some((e) => e.field.includes('sources')));
  assert.ok(errors.some((e) => e.fix && e.fix.length > 0), 'expected fix guidance');
});

test('extractConfig: missing sources.system_constraints reports error with fix', () => {
  const data = {
    project: { name: 'x' },
    sources: {
      ...VALID_PARSED.sources,
      system_constraints: undefined,
    },
  };
  const { errors } = extractConfig(data as Record<string, unknown>);
  assert.ok(errors.some((e) => e.field.includes('sources.system_constraints')));
  assert.ok(errors.some((e) => e.fix && e.fix.length > 0), 'expected fix guidance');
});

test('extractConfig: missing sources.build_intent reports error with fix', () => {
  const data = {
    project: { name: 'x' },
    sources: {
      ...VALID_PARSED.sources,
      build_intent: undefined,
    },
  };
  const { errors } = extractConfig(data as Record<string, unknown>);
  assert.ok(errors.some((e) => e.field.includes('sources.build_intent')));
  assert.ok(errors.some((e) => e.fix && e.fix.length > 0), 'expected fix guidance');
});

test('extractConfig: missing sources.next_slice.path reports error with fix', () => {
  const data = {
    project: { name: 'x' },
    sources: {
      ...VALID_PARSED.sources,
      next_slice: { selection_rule: 'first_unchecked_slice' },
    },
  };
  const { errors } = extractConfig(data as Record<string, unknown>);
  assert.ok(errors.some((e) => e.field.includes('sources.next_slice.path')));
  assert.ok(errors.some((e) => e.fix && e.fix.length > 0), 'expected fix guidance');
});

test('extractConfig: missing sources.next_slice.selection_rule reports error with fix', () => {
  const data = {
    project: { name: 'x' },
    sources: {
      ...VALID_PARSED.sources,
      next_slice: { path: 'docs/pipeline.md' },
    },
  };
  const { errors } = extractConfig(data as Record<string, unknown>);
  assert.ok(errors.some((e) => e.field.includes('sources.next_slice.selection_rule')));
  assert.ok(errors.some((e) => e.fix && e.fix.length > 0), 'expected fix guidance');
});

test('extractConfig: multiple missing fields reports all errors', () => {
  const { errors } = extractConfig({});
  assert.ok(errors.length >= 2, 'expected at least project and sources errors');
});

// ---------------------------------------------------------------------------
// validatePaths
// ---------------------------------------------------------------------------

async function makeTempProject(files: string[]): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'raes-test-'));
  await mkdir(join(dir, 'docs'), { recursive: true });
  for (const f of files) {
    await writeFile(join(dir, f), '# stub');
  }
  return dir;
}

const ALL_ARTIFACT_PATHS = [
  'docs/prd.md',
  'docs/system.md',
  'docs/pipeline.md',
  'docs/decisions.md',
  'docs/execution-guidance.md',
  'docs/validation.md',
];

function makeValidConfig(overrides?: Partial<{
  build_intent: string;
  system_constraints: string;
  nextPath: string;
  durable_decisions: string;
  execution_guidance: string;
  validation: string;
}>) {
  return {
    project: { name: 'test-project' },
    sources: {
      build_intent: overrides?.build_intent ?? 'docs/prd.md',
      system_constraints: overrides?.system_constraints ?? 'docs/system.md',
      next_slice: {
        path: overrides?.nextPath ?? 'docs/pipeline.md',
        selection_rule: 'first_unchecked_slice',
      },
      durable_decisions: overrides?.durable_decisions ?? 'docs/decisions.md',
      execution_guidance: overrides?.execution_guidance ?? 'docs/execution-guidance.md',
      validation: overrides?.validation ?? 'docs/validation.md',
    },
  };
}

test('validatePaths: all paths exist returns no errors', async () => {
  const dir = await makeTempProject(ALL_ARTIFACT_PATHS);
  try {
    const errors = validatePaths(makeValidConfig(), dir);
    assert.equal(errors.length, 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('validatePaths: missing build_intent file reports error with fix', async () => {
  const dir = await makeTempProject(ALL_ARTIFACT_PATHS.filter((p) => p !== 'docs/prd.md'));
  try {
    const errors = validatePaths(makeValidConfig(), dir);
    assert.ok(errors.some((e) => e.field.includes('sources.build_intent')));
    assert.ok(errors.some((e) => e.message.includes('docs/prd.md')));
    assert.ok(errors.some((e) => e.fix && e.fix.length > 0), 'expected fix guidance');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('validatePaths: missing next_slice path file reports error with fix', async () => {
  const dir = await makeTempProject(ALL_ARTIFACT_PATHS.filter((p) => p !== 'docs/pipeline.md'));
  try {
    const errors = validatePaths(makeValidConfig(), dir);
    assert.ok(errors.some((e) => e.field.includes('sources.next_slice.path')));
    assert.ok(errors.some((e) => e.fix && e.fix.length > 0), 'expected fix guidance');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('validatePaths: multiple missing files reports all of them with fix guidance', async () => {
  const dir = await makeTempProject([]);
  try {
    const errors = validatePaths(makeValidConfig(), dir);
    assert.ok(errors.length >= 6, 'expected error for each missing artifact');
    assert.ok(errors.every((e) => e.fix && e.fix.length > 0), 'every error should have fix guidance');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// checkConfig (end-to-end) — return type is { errors, config? }
// ---------------------------------------------------------------------------

const VALID_CONFIG_YAML = `
project:
  name: test-project

sources:
  build_intent: docs/prd.md
  system_constraints: docs/system.md
  next_slice:
    path: docs/pipeline.md
    selection_rule: first_unchecked_slice
  durable_decisions: docs/decisions.md
  execution_guidance: docs/execution-guidance.md
  validation: docs/validation.md
`;

test('checkConfig: valid project root returns no errors and a config', async () => {
  const dir = await makeTempProject(ALL_ARTIFACT_PATHS);
  try {
    await writeFile(join(dir, 'raes.config.yaml'), VALID_CONFIG_YAML);
    const { errors, config } = checkConfig(dir);
    assert.equal(errors.length, 0);
    assert.ok(config, 'expected config to be returned on success');
    assert.equal(config.project.name, 'test-project');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('checkConfig: missing raes.config.yaml reports error with fix', async () => {
  const dir = await makeTempProject([]);
  try {
    const { errors } = checkConfig(dir);
    assert.ok(errors.some((e) => e.message.toLowerCase().includes('raes.config.yaml')));
    assert.ok(errors.some((e) => e.fix && e.fix.length > 0), 'expected fix guidance');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('checkConfig: invalid YAML schema reports schema error with fix', async () => {
  const dir = await makeTempProject(ALL_ARTIFACT_PATHS);
  try {
    await writeFile(join(dir, 'raes.config.yaml'), 'project:\n  name:\n');
    const { errors } = checkConfig(dir);
    assert.ok(errors.length > 0, 'expected schema errors');
    assert.ok(errors.some((e) => e.fix && e.fix.length > 0), 'expected fix guidance');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('checkConfig: config with missing artifact path reports path error with fix', async () => {
  const dir = await makeTempProject(ALL_ARTIFACT_PATHS.filter((p) => p !== 'docs/prd.md'));
  try {
    await writeFile(join(dir, 'raes.config.yaml'), VALID_CONFIG_YAML);
    const { errors } = checkConfig(dir);
    assert.ok(errors.some((e) => e.message.includes('docs/prd.md')));
    assert.ok(errors.some((e) => e.fix && e.fix.length > 0), 'expected fix guidance');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('checkConfig: no config field on error result', async () => {
  const dir = await makeTempProject([]);
  try {
    const { config } = checkConfig(dir);
    assert.equal(config, undefined, 'config should be undefined when errors exist');
  } finally {
    rmSync(dir, { recursive: true });
  }
});
