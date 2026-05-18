import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';

import { parseYaml, extractConfig, validatePaths, checkConfig, extractWorkspace, checkWorkspace, resolveProjectFromWorkspace } from '../src/config.ts';

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
  provider: { name: 'anthropic' },
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
  providerName: 'anthropic' | 'openai' | 'github_copilot';
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
    provider: { name: overrides?.providerName ?? 'anthropic' as 'anthropic' | 'openai' | 'github_copilot' },
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

provider:
  name: anthropic
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

test('checkConfig: explicit config path outside cwd is supported', async () => {
  const monorepoDir = await mkdtemp(join(tmpdir(), 'raes-monorepo-test-'));
  const projectDir = join(monorepoDir, 'projects', 'demo');
  try {
    await mkdir(join(projectDir, 'docs'), { recursive: true });
    for (const file of ALL_ARTIFACT_PATHS) {
      await writeFile(join(projectDir, file), '# stub');
    }
    await writeFile(join(projectDir, 'raes.config.yaml'), VALID_CONFIG_YAML);

    const { errors, config } = checkConfig(monorepoDir, join(projectDir, 'raes.config.yaml'));
    assert.equal(errors.length, 0);
    assert.ok(config, 'expected config with explicit path');
    assert.equal(config.project.name, 'test-project');
  } finally {
    rmSync(monorepoDir, { recursive: true });
  }
});

test('checkConfig: explicit legacy docs/raes.config.yaml resolves artifacts from project root', async () => {
  const monorepoDir = await mkdtemp(join(tmpdir(), 'raes-monorepo-test-'));
  const projectDir = join(monorepoDir, 'projects', 'demo');
  try {
    await mkdir(join(projectDir, 'docs'), { recursive: true });
    for (const file of ALL_ARTIFACT_PATHS) {
      await writeFile(join(projectDir, file), '# stub');
    }
    await writeFile(join(projectDir, 'docs', 'raes.config.yaml'), VALID_CONFIG_YAML);

    const { errors, config, projectRoot } = checkConfig(
      monorepoDir,
      join(projectDir, 'docs', 'raes.config.yaml'),
    );
    assert.equal(errors.length, 0);
    assert.ok(config, 'expected config with explicit legacy path');
    assert.equal(projectRoot, projectDir);
    assert.equal(config.project.name, 'test-project');
  } finally {
    rmSync(monorepoDir, { recursive: true });
  }
});

test('checkConfig: does not discover config from child directories without explicit path', async () => {
  const monorepoDir = await mkdtemp(join(tmpdir(), 'raes-monorepo-test-'));
  const projectDir = join(monorepoDir, 'projects', 'demo');
  try {
    await mkdir(join(projectDir, 'docs'), { recursive: true });
    for (const file of ALL_ARTIFACT_PATHS) {
      await writeFile(join(projectDir, file), '# stub');
    }
    await writeFile(join(projectDir, 'raes.config.yaml'), VALID_CONFIG_YAML);

    const { errors, config } = checkConfig(monorepoDir);
    assert.equal(config, undefined);
    assert.ok(errors.some((e) => e.message.toLowerCase().includes('raes.config.yaml not found')));
  } finally {
    rmSync(monorepoDir, { recursive: true });
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

// ---------------------------------------------------------------------------
// provider validation
// ---------------------------------------------------------------------------

test('extractConfig: provider.name anthropic returns config with no errors', () => {
  const data = { ...VALID_PARSED, provider: { name: 'anthropic' } };
  const { config, errors } = extractConfig(data);
  assert.equal(errors.length, 0);
  assert.ok(config, 'expected config');
  assert.equal(config.provider.name, 'anthropic');
});

test('extractConfig: provider.name openai returns config with no errors', () => {
  const data = { ...VALID_PARSED, provider: { name: 'openai' } };
  const { config, errors } = extractConfig(data);
  assert.equal(errors.length, 0);
  assert.ok(config, 'expected config');
  assert.equal(config.provider.name, 'openai');
  assert.equal(config.provider.openai?.transport, 'exec');
});

test('extractConfig: openai provider defaults transport to exec when omitted', () => {
  const data = { ...VALID_PARSED, provider: { name: 'openai' } };
  const { config, errors } = extractConfig(data);
  assert.equal(errors.length, 0);
  assert.ok(config, 'expected config');
  assert.equal(config.provider.openai?.transport, 'exec');
});

test('extractConfig: openai provider accepts explicit app_server transport', () => {
  const data = {
    ...VALID_PARSED,
    provider: {
      name: 'openai',
      openai: {
        transport: 'app_server',
      },
    },
  };
  const { config, errors } = extractConfig(data as Record<string, unknown>);
  assert.equal(errors.length, 0);
  assert.ok(config, 'expected config');
  assert.equal(config.provider.openai?.transport, 'app_server');
});

test('extractConfig: provider.name github_copilot returns config with no errors', () => {
  const data = { ...VALID_PARSED, provider: { name: 'github_copilot' } };
  const { config, errors } = extractConfig(data);
  assert.equal(errors.length, 0);
  assert.ok(config, 'expected config');
  assert.equal(config.provider.name, 'github_copilot');
  assert.equal(config.provider.github_copilot?.transport, 'exec');
});

test('extractConfig: github_copilot provider accepts explicit exec transport', () => {
  const data = {
    ...VALID_PARSED,
    provider: {
      name: 'github_copilot',
      github_copilot: {
        transport: 'exec',
      },
    },
  };
  const { config, errors } = extractConfig(data as Record<string, unknown>);
  assert.equal(errors.length, 0);
  assert.ok(config, 'expected config');
  assert.equal(config.provider.github_copilot?.transport, 'exec');
});

test('extractConfig: github_copilot provider rejects app_server transport with fix guidance', () => {
  const data = {
    ...VALID_PARSED,
    provider: {
      name: 'github_copilot',
      github_copilot: {
        transport: 'app_server',
      },
    },
  };
  const { config, errors } = extractConfig(data as Record<string, unknown>);
  assert.equal(config, undefined);
  assert.ok(errors.some((e) => e.field === 'provider.github_copilot.transport'));
  assert.ok(errors.some((e) => /does not support app_server transport/i.test(e.fix ?? '')), 'expected app_server fix guidance');
});

test('extractConfig: missing provider section reports error with fix', () => {
  const { project, sources } = VALID_PARSED;
  const { config, errors } = extractConfig({ project, sources });
  assert.equal(config, undefined);
  assert.ok(errors.some((e) => e.field.includes('provider')));
  assert.ok(errors.some((e) => e.fix && e.fix.length > 0), 'expected fix guidance');
});

test('extractConfig: empty provider.name reports error with fix', () => {
  const data = { ...VALID_PARSED, provider: { name: '' } };
  const { config, errors } = extractConfig(data as Record<string, unknown>);
  assert.equal(config, undefined);
  assert.ok(errors.some((e) => e.field.includes('provider.name')));
  assert.ok(errors.some((e) => e.fix && e.fix.length > 0), 'expected fix guidance');
});

test('extractConfig: unknown provider.name reports error with fix', () => {
  const data = { ...VALID_PARSED, provider: { name: 'bedrock' } };
  const { config, errors } = extractConfig(data as Record<string, unknown>);
  assert.equal(config, undefined);
  assert.ok(errors.some((e) => e.field.includes('provider.name')));
  assert.ok(errors.some((e) => e.fix && e.fix.length > 0), 'expected fix guidance');
});

test('extractConfig: invalid openai transport reports error with fix', () => {
  const data = {
    ...VALID_PARSED,
    provider: {
      name: 'openai',
      openai: {
        transport: 'websocket',
      },
    },
  };
  const { config, errors } = extractConfig(data as Record<string, unknown>);
  assert.equal(config, undefined);
  assert.ok(errors.some((e) => e.field === 'provider.openai.transport'));
  assert.ok(errors.some((e) => e.fix && e.fix.length > 0), 'expected fix guidance');
});

test('extractConfig: invalid github_copilot transport reports error with fix', () => {
  const data = {
    ...VALID_PARSED,
    provider: {
      name: 'github_copilot',
      github_copilot: {
        transport: 'websocket',
      },
    },
  };
  const { config, errors } = extractConfig(data as Record<string, unknown>);
  assert.equal(config, undefined);
  assert.ok(errors.some((e) => e.field === 'provider.github_copilot.transport'));
  assert.ok(errors.some((e) => e.fix && e.fix.length > 0), 'expected fix guidance');
});

test('extractConfig: missing sandbox block must not error', () => {
  const data = { ...VALID_PARSED, provider: { name: 'anthropic' } };
  const { errors } = extractConfig(data);
  assert.equal(errors.length, 0);
});

test('extractConfig: write_access false must not error', () => {
  const data = {
    ...VALID_PARSED,
    provider: { name: 'anthropic', sandbox: { write_access: 'false' } },
  };
  const { config, errors } = extractConfig(data as Record<string, unknown>);
  assert.equal(errors.length, 0);
  assert.ok(config, 'expected config');
  assert.equal(config.provider.sandbox?.write_access, false);
});

test('extractConfig: optional model field does not error', () => {
  const data = {
    ...VALID_PARSED,
    provider: { name: 'anthropic', model: 'claude-opus-4-7' },
  };
  const { config, errors } = extractConfig(data as Record<string, unknown>);
  assert.equal(errors.length, 0);
  assert.ok(config, 'expected config');
  assert.equal(config.provider.model, 'claude-opus-4-7');
});

// ---------------------------------------------------------------------------
// extractWorkspace
// ---------------------------------------------------------------------------

const VALID_WORKSPACE_PARSED = {
  projects: {
    'raes-execute': { config: 'projects/raes-execute/raes.config.yaml' },
    'raes-init': { config: 'projects/raes-init/raes.config.yaml' },
  },
};

test('extractWorkspace: valid projects-only workspace returns no errors', () => {
  const { workspace, errors } = extractWorkspace(VALID_WORKSPACE_PARSED as Record<string, unknown>);
  assert.equal(errors.length, 0);
  assert.ok(workspace, 'expected workspace');
  assert.deepEqual(workspace.projects['raes-execute'], { config: 'projects/raes-execute/raes.config.yaml' });
  assert.deepEqual(workspace.shared_sources, {});
});

test('extractWorkspace: valid workspace with shared_sources returns them', () => {
  const data = {
    ...VALID_WORKSPACE_PARSED,
    shared_sources: { raes_reference: 'docs/raes-reference.md' },
  };
  const { workspace, errors } = extractWorkspace(data as Record<string, unknown>);
  assert.equal(errors.length, 0);
  assert.ok(workspace, 'expected workspace');
  assert.equal(workspace.shared_sources['raes_reference'], 'docs/raes-reference.md');
});

test('extractWorkspace: missing projects section reports error', () => {
  const { workspace, errors } = extractWorkspace({});
  assert.equal(errors.length, 1);
  assert.ok(!workspace);
  assert.ok(errors[0].message.includes("missing required section 'projects'"));
  assert.ok(errors[0].fix);
});

test('extractWorkspace: project with non-object entry reports error', () => {
  const data = { projects: { 'bad-project': 'not-an-object' } };
  const { errors } = extractWorkspace(data as Record<string, unknown>);
  assert.ok(errors.some((e) => e.field === 'projects.bad-project'));
});

test('extractWorkspace: project with empty config reports error', () => {
  const data = { projects: { 'bad-project': { config: '' } } };
  const { errors } = extractWorkspace(data as Record<string, unknown>);
  assert.ok(errors.some((e) => e.field === 'projects.bad-project.config'));
  assert.ok(errors[0].fix);
});

test('extractWorkspace: empty projects object reports error', () => {
  const { errors } = extractWorkspace({ projects: {} });
  assert.equal(errors.length, 1);
  assert.ok(errors[0].message.includes('no projects defined'));
});

test('extractWorkspace: invalid shared_sources type reports error', () => {
  const data = { ...VALID_WORKSPACE_PARSED, shared_sources: 'not-an-object' };
  const { errors } = extractWorkspace(data as Record<string, unknown>);
  assert.ok(errors.some((e) => e.field === 'shared_sources'));
});

test('extractWorkspace: shared_sources entry with empty path reports error', () => {
  const data = { ...VALID_WORKSPACE_PARSED, shared_sources: { raes_reference: '' } };
  const { errors } = extractWorkspace(data as Record<string, unknown>);
  assert.ok(errors.some((e) => e.field === 'shared_sources.raes_reference'));
  assert.ok(errors[0].fix);
});

// ---------------------------------------------------------------------------
// checkWorkspace
// ---------------------------------------------------------------------------

const VALID_WORKSPACE_YAML = `
projects:
  raes-execute:
    config: raes-execute/raes.config.yaml
  raes-init:
    config: raes-init/raes.config.yaml
`;

const VALID_PROJECT_CONFIG_YAML = `
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
provider:
  name: anthropic
`;

async function makeWorkspaceDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'raes-ws-test-'));
  await writeFile(join(dir, 'raes.workspace.yaml'), VALID_WORKSPACE_YAML);
  for (const proj of ['raes-execute', 'raes-init']) {
    await mkdir(join(dir, proj), { recursive: true });
    await writeFile(join(dir, proj, 'raes.config.yaml'), VALID_PROJECT_CONFIG_YAML);
  }
  return dir;
}

test('checkWorkspace: valid workspace file returns workspace and workspaceRoot', async () => {
  const dir = await makeWorkspaceDir();
  try {
    const { workspace, workspaceRoot, errors } = checkWorkspace(dir);
    assert.equal(errors.length, 0);
    assert.ok(workspace, 'expected workspace');
    assert.equal(workspaceRoot, dir);
    assert.ok('raes-execute' in workspace.projects);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('checkWorkspace: missing workspace file reports error with fix', () => {
  const { errors } = checkWorkspace('/tmp/nonexistent-ws-dir-' + Date.now());
  assert.equal(errors.length, 1);
  assert.ok(errors[0].message.includes('raes.workspace.yaml not found'));
  assert.ok(errors[0].fix);
});

test('checkWorkspace: explicit workspace path resolves correctly', async () => {
  const dir = await makeWorkspaceDir();
  try {
    const wsPath = join(dir, 'raes.workspace.yaml');
    const { workspace, errors } = checkWorkspace('/tmp', wsPath);
    assert.equal(errors.length, 0);
    assert.ok(workspace, 'expected workspace');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('checkWorkspace: workspace with missing project config file reports error with fix', async () => {
  const dir = await makeWorkspaceDir();
  try {
    rmSync(join(dir, 'raes-execute', 'raes.config.yaml'));
    const { errors } = checkWorkspace(dir);
    assert.equal(errors.length, 1);
    assert.ok(errors[0].message.includes('raes-execute/raes.config.yaml'));
    assert.ok(errors[0].fix);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('checkWorkspace: workspace with missing shared_source file reports error with fix', async () => {
  const dir = await makeWorkspaceDir();
  try {
    const wsWithShared = VALID_WORKSPACE_YAML + `\nshared_sources:\n  raes_reference: docs/raes-reference.md\n`;
    await writeFile(join(dir, 'raes.workspace.yaml'), wsWithShared);
    const { errors } = checkWorkspace(dir);
    assert.equal(errors.length, 1);
    assert.ok(errors[0].field === 'shared_sources.raes_reference');
    assert.ok(errors[0].fix);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('checkWorkspace: shared_source that exists passes validation', async () => {
  const dir = await makeWorkspaceDir();
  try {
    await writeFile(join(dir, 'shared.md'), '# shared');
    const wsWithShared = VALID_WORKSPACE_YAML + `\nshared_sources:\n  shared_doc: shared.md\n`;
    await writeFile(join(dir, 'raes.workspace.yaml'), wsWithShared);
    const { workspace, errors } = checkWorkspace(dir);
    assert.equal(errors.length, 0);
    assert.equal(workspace!.shared_sources['shared_doc'], 'shared.md');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// resolveProjectFromWorkspace
// ---------------------------------------------------------------------------

test('resolveProjectFromWorkspace: known project returns absolute config path', () => {
  const workspace = {
    projects: { 'raes-execute': { config: 'projects/raes-execute/raes.config.yaml' } },
    shared_sources: {},
  };
  const { configPath, error } = resolveProjectFromWorkspace(workspace, '/repo', 'raes-execute');
  assert.ok(!error);
  assert.equal(configPath, '/repo/projects/raes-execute/raes.config.yaml');
});

test('resolveProjectFromWorkspace: unknown project returns error with known project list', () => {
  const workspace = {
    projects: { 'raes-execute': { config: 'projects/raes-execute/raes.config.yaml' } },
    shared_sources: {},
  };
  const { configPath, error } = resolveProjectFromWorkspace(workspace, '/repo', 'unknown-project');
  assert.ok(!configPath);
  assert.ok(error);
  assert.ok(error.message.includes('unknown-project'));
  assert.ok(error.message.includes('raes-execute'));
  assert.ok(error.fix);
});
