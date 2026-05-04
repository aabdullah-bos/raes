import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';

import {
  loadArtifact,
  loadAllArtifacts,
  validateBoundaries,
  type ArtifactRole,
  type Artifact,
} from '../src/artifacts.ts';
import type { RaesConfig } from '../src/config.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'raes-artifacts-test-'));
  await mkdir(join(dir, 'docs'), { recursive: true });
  return dir;
}

function makeConfig(projectRoot: string): RaesConfig {
  return {
    project: { name: 'test-project' },
    sources: {
      build_intent: 'docs/prd.md',
      system_constraints: 'docs/system.md',
      next_slice: { path: 'docs/pipeline.md', selection_rule: 'first_unchecked_slice' },
      durable_decisions: 'docs/decisions.md',
      execution_guidance: 'docs/execution-guidance.md',
      validation: 'docs/validation.md',
    },
  };
}

const MINIMAL_PRD = `# PRD\n\n## Business Goals\n\nBuild something useful.\n\n## User Stories\n\n* As a user, I want to do things.\n`;
const MINIMAL_SYSTEM = `# System\n\n## Product Invariants\n\n- Must behave predictably.\n\n## Drift Guards\n\n- Do not mix layers.\n\n## Known Contracts\n\n- Exit codes are a contract.\n`;
const MINIMAL_PIPELINE = `# Pipeline\n\n## Slice Backlog\n\n- [ ] Slice 1: Do the thing.\n`;
const MINIMAL_DECISIONS = `# Decisions\n\n## Durable Decisions\n\n| Decision | Rationale | Date |\n|----------|-----------|------|\n| Use TS | Consistency | 2026-05-03 |\n`;
const MINIMAL_GUIDANCE = `# Execution Guidance\n\n## Invariants\n\n1. One slice per invocation.\n\n## Anti-Patterns\n\n1. Do not batch slices.\n`;
const MINIMAL_VALIDATION = `# Validation\n\n## Testing Approach\n\nUse the node test runner.\n`;

async function writeAllArtifacts(dir: string): Promise<void> {
  await writeFile(join(dir, 'docs/prd.md'), MINIMAL_PRD);
  await writeFile(join(dir, 'docs/system.md'), MINIMAL_SYSTEM);
  await writeFile(join(dir, 'docs/pipeline.md'), MINIMAL_PIPELINE);
  await writeFile(join(dir, 'docs/decisions.md'), MINIMAL_DECISIONS);
  await writeFile(join(dir, 'docs/execution-guidance.md'), MINIMAL_GUIDANCE);
  await writeFile(join(dir, 'docs/validation.md'), MINIMAL_VALIDATION);
}

// ---------------------------------------------------------------------------
// loadArtifact
// ---------------------------------------------------------------------------

test('loadArtifact: returns artifact with role, path, content for existing file', async () => {
  const dir = await makeTempDir();
  try {
    await writeFile(join(dir, 'docs/prd.md'), MINIMAL_PRD);
    const { artifact, error } = loadArtifact('build_intent', 'docs/prd.md', dir);
    assert.equal(error, undefined);
    assert.ok(artifact, 'expected artifact to be defined');
    assert.equal(artifact.role, 'build_intent');
    assert.equal(artifact.path, 'docs/prd.md');
    assert.ok(artifact.content.includes('Business Goals'), 'expected file content to be read');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('loadArtifact: returns error when file does not exist', async () => {
  const dir = await makeTempDir();
  try {
    const { artifact, error } = loadArtifact('build_intent', 'docs/missing.md', dir);
    assert.equal(artifact, undefined);
    assert.ok(error, 'expected error to be defined');
    assert.ok(error.includes('docs/missing.md'), 'expected path in error message');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('loadArtifact: returns artifact for empty file', async () => {
  const dir = await makeTempDir();
  try {
    await writeFile(join(dir, 'docs/validation.md'), '');
    const { artifact, error } = loadArtifact('validation', 'docs/validation.md', dir);
    assert.equal(error, undefined);
    assert.ok(artifact);
    assert.equal(artifact.content, '');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('loadArtifact: assigns the provided role to the artifact', async () => {
  const dir = await makeTempDir();
  try {
    await writeFile(join(dir, 'docs/decisions.md'), MINIMAL_DECISIONS);
    const roles: ArtifactRole[] = ['build_intent', 'system_constraints', 'next_slice', 'durable_decisions', 'execution_guidance', 'validation'];
    for (const role of roles) {
      const { artifact } = loadArtifact(role, 'docs/decisions.md', dir);
      assert.equal(artifact?.role, role, `expected role ${role}`);
    }
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// loadAllArtifacts
// ---------------------------------------------------------------------------

test('loadAllArtifacts: returns all six artifacts for valid project', async () => {
  const dir = await makeTempDir();
  try {
    await writeAllArtifacts(dir);
    const config = makeConfig(dir);
    const { artifacts, errors } = loadAllArtifacts(config, dir);
    assert.equal(errors.length, 0, 'expected no errors');
    assert.ok(artifacts, 'expected artifacts map');
    assert.ok(artifacts.build_intent, 'expected build_intent artifact');
    assert.ok(artifacts.system_constraints, 'expected system_constraints artifact');
    assert.ok(artifacts.next_slice, 'expected next_slice artifact');
    assert.ok(artifacts.durable_decisions, 'expected durable_decisions artifact');
    assert.ok(artifacts.execution_guidance, 'expected execution_guidance artifact');
    assert.ok(artifacts.validation, 'expected validation artifact');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('loadAllArtifacts: each artifact has correct role assigned from config', async () => {
  const dir = await makeTempDir();
  try {
    await writeAllArtifacts(dir);
    const config = makeConfig(dir);
    const { artifacts } = loadAllArtifacts(config, dir);
    assert.ok(artifacts);
    assert.equal(artifacts.build_intent.role, 'build_intent');
    assert.equal(artifacts.build_intent.path, 'docs/prd.md');
    assert.equal(artifacts.system_constraints.role, 'system_constraints');
    assert.equal(artifacts.system_constraints.path, 'docs/system.md');
    assert.equal(artifacts.next_slice.role, 'next_slice');
    assert.equal(artifacts.next_slice.path, 'docs/pipeline.md');
    assert.equal(artifacts.durable_decisions.role, 'durable_decisions');
    assert.equal(artifacts.execution_guidance.role, 'execution_guidance');
    assert.equal(artifacts.validation.role, 'validation');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('loadAllArtifacts: returns errors for each missing file', async () => {
  const dir = await makeTempDir();
  try {
    // write no files — all six should error
    const config = makeConfig(dir);
    const { artifacts, errors } = loadAllArtifacts(config, dir);
    assert.equal(artifacts, undefined, 'expected no artifacts when files are missing');
    assert.equal(errors.length, 6, 'expected one error per missing artifact');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('loadAllArtifacts: returns errors only for missing files, not present ones', async () => {
  const dir = await makeTempDir();
  try {
    await writeFile(join(dir, 'docs/prd.md'), MINIMAL_PRD);
    // leave the other five missing
    const config = makeConfig(dir);
    const { artifacts, errors } = loadAllArtifacts(config, dir);
    assert.equal(artifacts, undefined);
    assert.equal(errors.length, 5, 'expected errors for the 5 missing files only');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// validateBoundaries — clean artifacts
// ---------------------------------------------------------------------------

test('validateBoundaries: clean artifacts return no violations', async () => {
  const dir = await makeTempDir();
  try {
    await writeAllArtifacts(dir);
    const config = makeConfig(dir);
    const { artifacts } = loadAllArtifacts(config, dir);
    assert.ok(artifacts);
    const violations = validateBoundaries(artifacts);
    assert.equal(violations.length, 0, `expected no violations, got: ${JSON.stringify(violations)}`);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// validateBoundaries — build_intent (prd) boundary violations
// ---------------------------------------------------------------------------

test('validateBoundaries: build_intent with Durable Decisions section reports violation', () => {
  const artifacts = makeCleanArtifacts();
  artifacts.build_intent = {
    role: 'build_intent',
    path: 'docs/prd.md',
    content: `# PRD\n\n## Business Goals\n\nBuild things.\n\n## Durable Decisions\n\n| Decision | Rationale | Date |\n`,
  };
  const violations = validateBoundaries(artifacts);
  const v = violations.find((v) => v.role === 'build_intent');
  assert.ok(v, 'expected violation for build_intent');
  assert.ok(v.issue.length > 0, 'expected issue description');
  assert.ok(v.evidence.includes('Durable Decisions'), 'expected evidence to contain offending content');
});

test('validateBoundaries: build_intent with Invariants section reports violation', () => {
  const artifacts = makeCleanArtifacts();
  artifacts.build_intent = {
    role: 'build_intent',
    path: 'docs/prd.md',
    content: `# PRD\n\n## Business Goals\n\nBuild things.\n\n## Invariants\n\n1. Must be fast.\n`,
  };
  const violations = validateBoundaries(artifacts);
  assert.ok(violations.some((v) => v.role === 'build_intent' && v.evidence.includes('Invariants')));
});

test('validateBoundaries: build_intent with Handoff Notes section reports violation', () => {
  const artifacts = makeCleanArtifacts();
  artifacts.build_intent = {
    role: 'build_intent',
    path: 'docs/prd.md',
    content: `# PRD\n\n## Business Goals\n\nBuild things.\n\n## Handoff Notes\n\nSome operational note.\n`,
  };
  const violations = validateBoundaries(artifacts);
  assert.ok(violations.some((v) => v.role === 'build_intent' && v.evidence.includes('Handoff Notes')));
});

// ---------------------------------------------------------------------------
// validateBoundaries — durable_decisions boundary violations
// ---------------------------------------------------------------------------

test('validateBoundaries: durable_decisions with User Stories section reports violation', () => {
  const artifacts = makeCleanArtifacts();
  artifacts.durable_decisions = {
    role: 'durable_decisions',
    path: 'docs/decisions.md',
    content: `# Decisions\n\n## Durable Decisions\n\n| Decision | Rationale | Date |\n\n## User Stories\n\n* As a user...\n`,
  };
  const violations = validateBoundaries(artifacts);
  assert.ok(violations.some((v) => v.role === 'durable_decisions' && v.evidence.includes('User Stories')));
});

test('validateBoundaries: durable_decisions with Business Goals section reports violation', () => {
  const artifacts = makeCleanArtifacts();
  artifacts.durable_decisions = {
    role: 'durable_decisions',
    path: 'docs/decisions.md',
    content: `# Decisions\n\n## Durable Decisions\n\n| Decision | Rationale | Date |\n\n## Business Goals\n\nMake money.\n`,
  };
  const violations = validateBoundaries(artifacts);
  assert.ok(violations.some((v) => v.role === 'durable_decisions' && v.evidence.includes('Business Goals')));
});

test('validateBoundaries: durable_decisions with Slice Backlog section reports violation', () => {
  const artifacts = makeCleanArtifacts();
  artifacts.durable_decisions = {
    role: 'durable_decisions',
    path: 'docs/decisions.md',
    content: `# Decisions\n\n## Durable Decisions\n\n| Decision | Rationale | Date |\n\n## Slice Backlog\n\n- [ ] Slice 1: do stuff\n`,
  };
  const violations = validateBoundaries(artifacts);
  assert.ok(violations.some((v) => v.role === 'durable_decisions' && v.evidence.includes('Slice Backlog')));
});

// ---------------------------------------------------------------------------
// validateBoundaries — execution_guidance boundary violations
// ---------------------------------------------------------------------------

test('validateBoundaries: execution_guidance with User Stories section reports violation', () => {
  const artifacts = makeCleanArtifacts();
  artifacts.execution_guidance = {
    role: 'execution_guidance',
    path: 'docs/execution-guidance.md',
    content: `# Guidance\n\n## Invariants\n\n1. One slice.\n\n## User Stories\n\n* As an operator...\n`,
  };
  const violations = validateBoundaries(artifacts);
  assert.ok(violations.some((v) => v.role === 'execution_guidance' && v.evidence.includes('User Stories')));
});

test('validateBoundaries: execution_guidance with Durable Decisions section reports violation', () => {
  const artifacts = makeCleanArtifacts();
  artifacts.execution_guidance = {
    role: 'execution_guidance',
    path: 'docs/execution-guidance.md',
    content: `# Guidance\n\n## Invariants\n\n1. One slice.\n\n## Durable Decisions\n\n| Decision | Rationale | Date |\n`,
  };
  const violations = validateBoundaries(artifacts);
  assert.ok(violations.some((v) => v.role === 'execution_guidance' && v.evidence.includes('Durable Decisions')));
});

// ---------------------------------------------------------------------------
// validateBoundaries — validation boundary violations
// ---------------------------------------------------------------------------

test('validateBoundaries: validation with User Stories section reports violation', () => {
  const artifacts = makeCleanArtifacts();
  artifacts.validation = {
    role: 'validation',
    path: 'docs/validation.md',
    content: `# Validation\n\n## Testing Approach\n\nRun tests.\n\n## User Stories\n\n* As a tester...\n`,
  };
  const violations = validateBoundaries(artifacts);
  assert.ok(violations.some((v) => v.role === 'validation' && v.evidence.includes('User Stories')));
});

test('validateBoundaries: validation with Durable Decisions section reports violation', () => {
  const artifacts = makeCleanArtifacts();
  artifacts.validation = {
    role: 'validation',
    path: 'docs/validation.md',
    content: `# Validation\n\n## Testing Approach\n\nRun tests.\n\n## Durable Decisions\n\n| Decision | Rationale | Date |\n`,
  };
  const violations = validateBoundaries(artifacts);
  assert.ok(violations.some((v) => v.role === 'validation' && v.evidence.includes('Durable Decisions')));
});

// ---------------------------------------------------------------------------
// validateBoundaries — next_slice boundary violations
// ---------------------------------------------------------------------------

test('validateBoundaries: next_slice with Business Goals section reports violation', () => {
  const artifacts = makeCleanArtifacts();
  artifacts.next_slice = {
    role: 'next_slice',
    path: 'docs/pipeline.md',
    content: `# Pipeline\n\n## Slice Backlog\n\n- [ ] Slice 1: do stuff\n\n## Business Goals\n\nMake money.\n`,
  };
  const violations = validateBoundaries(artifacts);
  assert.ok(violations.some((v) => v.role === 'next_slice' && v.evidence.includes('Business Goals')));
});

test('validateBoundaries: next_slice with Durable Decisions section reports violation', () => {
  const artifacts = makeCleanArtifacts();
  artifacts.next_slice = {
    role: 'next_slice',
    path: 'docs/pipeline.md',
    content: `# Pipeline\n\n## Slice Backlog\n\n- [ ] Slice 1: do stuff\n\n## Durable Decisions\n\n| Decision | Rationale | Date |\n`,
  };
  const violations = validateBoundaries(artifacts);
  assert.ok(violations.some((v) => v.role === 'next_slice' && v.evidence.includes('Durable Decisions')));
});

// ---------------------------------------------------------------------------
// validateBoundaries — violation structure
// ---------------------------------------------------------------------------

test('validateBoundaries: violation includes role, path, issue, and evidence', () => {
  const artifacts = makeCleanArtifacts();
  artifacts.build_intent = {
    role: 'build_intent',
    path: 'docs/prd.md',
    content: `# PRD\n\n## Durable Decisions\n\n| Decision | Rationale | Date |\n`,
  };
  const violations = validateBoundaries(artifacts);
  assert.ok(violations.length > 0);
  const v = violations[0];
  assert.ok(typeof v.role === 'string' && v.role.length > 0, 'expected non-empty role');
  assert.ok(typeof v.path === 'string' && v.path.length > 0, 'expected non-empty path');
  assert.ok(typeof v.issue === 'string' && v.issue.length > 0, 'expected non-empty issue');
  assert.ok(typeof v.evidence === 'string' && v.evidence.length > 0, 'expected non-empty evidence');
});

test('validateBoundaries: multiple violations in one artifact are all reported', () => {
  const artifacts = makeCleanArtifacts();
  artifacts.build_intent = {
    role: 'build_intent',
    path: 'docs/prd.md',
    content: `# PRD\n\n## Business Goals\n\nBuild things.\n\n## Durable Decisions\n\n| Decision | Rationale | Date |\n\n## Invariants\n\n1. Must be fast.\n`,
  };
  const violations = validateBoundaries(artifacts);
  const prdViolations = violations.filter((v) => v.role === 'build_intent');
  assert.ok(prdViolations.length >= 2, `expected at least 2 violations, got ${prdViolations.length}`);
});

// ---------------------------------------------------------------------------
// Utility for in-memory artifact map
// ---------------------------------------------------------------------------

function makeCleanArtifacts(): Record<ArtifactRole, Artifact> {
  return {
    build_intent: { role: 'build_intent', path: 'docs/prd.md', content: MINIMAL_PRD },
    system_constraints: { role: 'system_constraints', path: 'docs/system.md', content: MINIMAL_SYSTEM },
    next_slice: { role: 'next_slice', path: 'docs/pipeline.md', content: MINIMAL_PIPELINE },
    durable_decisions: { role: 'durable_decisions', path: 'docs/decisions.md', content: MINIMAL_DECISIONS },
    execution_guidance: { role: 'execution_guidance', path: 'docs/execution-guidance.md', content: MINIMAL_GUIDANCE },
    validation: { role: 'validation', path: 'docs/validation.md', content: MINIMAL_VALIDATION },
  };
}

// ---------------------------------------------------------------------------
// validateBoundaries — system_constraints boundary violations
// ---------------------------------------------------------------------------

test('validateBoundaries: system_constraints with Business Goals section reports violation', () => {
  const artifacts = makeCleanArtifacts();
  artifacts.system_constraints = {
    role: 'system_constraints',
    path: 'docs/system.md',
    content: `# System\n\n## Product Invariants\n\n- Behave predictably.\n\n## Business Goals\n\nMake money.\n`,
  };
  const violations = validateBoundaries(artifacts);
  assert.ok(violations.some((v) => v.role === 'system_constraints' && v.evidence.includes('Business Goals')));
});

test('validateBoundaries: system_constraints with Durable Decisions section reports violation', () => {
  const artifacts = makeCleanArtifacts();
  artifacts.system_constraints = {
    role: 'system_constraints',
    path: 'docs/system.md',
    content: `# System\n\n## Product Invariants\n\n- Behave predictably.\n\n## Durable Decisions\n\n| Decision | Rationale | Date |\n`,
  };
  const violations = validateBoundaries(artifacts);
  assert.ok(violations.some((v) => v.role === 'system_constraints' && v.evidence.includes('Durable Decisions')));
});

test('validateBoundaries: system_constraints with Slice Backlog section reports violation', () => {
  const artifacts = makeCleanArtifacts();
  artifacts.system_constraints = {
    role: 'system_constraints',
    path: 'docs/system.md',
    content: `# System\n\n## Product Invariants\n\n- Behave predictably.\n\n## Slice Backlog\n\n- [ ] Slice 1: do stuff\n`,
  };
  const violations = validateBoundaries(artifacts);
  assert.ok(violations.some((v) => v.role === 'system_constraints' && v.evidence.includes('Slice Backlog')));
});

test('validateBoundaries: build_intent with Product Invariants section reports violation', () => {
  const artifacts = makeCleanArtifacts();
  artifacts.build_intent = {
    role: 'build_intent',
    path: 'docs/prd.md',
    content: `# PRD\n\n## Business Goals\n\nBuild things.\n\n## Product Invariants\n\n- Must be fast.\n`,
  };
  const violations = validateBoundaries(artifacts);
  assert.ok(violations.some((v) => v.role === 'build_intent' && v.evidence.includes('Product Invariants')));
});

test('validateBoundaries: execution_guidance with Drift Guards section reports violation', () => {
  const artifacts = makeCleanArtifacts();
  artifacts.execution_guidance = {
    role: 'execution_guidance',
    path: 'docs/execution-guidance.md',
    content: `# Guidance\n\n## Invariants\n\n1. One slice.\n\n## Drift Guards\n\n- No mixing layers.\n`,
  };
  const violations = validateBoundaries(artifacts);
  assert.ok(violations.some((v) => v.role === 'execution_guidance' && v.evidence.includes('Drift Guards')));
});
