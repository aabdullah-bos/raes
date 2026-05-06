import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync, readFileSync } from 'node:fs';
import { main } from '../src/cli.ts';
import type { Provider } from '../src/provider.ts';
import { getPromptPath } from '../src/prompt.ts';

const ALL_ARTIFACT_PATHS = [
  'docs/prd.md',
  'docs/system.md',
  'docs/pipeline.md',
  'docs/decisions.md',
  'docs/execution-guidance.md',
  'docs/validation.md',
];

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

async function makeTempProject(withConfig: boolean): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'raes-cli-test-'));
  await mkdir(join(dir, 'docs'), { recursive: true });
  for (const f of ALL_ARTIFACT_PATHS) {
    await writeFile(join(dir, f), '# stub');
  }
  if (withConfig) {
    await writeFile(join(dir, 'raes.config.yaml'), VALID_CONFIG_YAML);
  }
  return dir;
}

function testProvider(output = 'agent output'): Provider {
  return {
    submit: async () => ({ output }),
  };
}

function testProviderSpy(output = 'agent output') {
  let calls = 0;
  const provider: Provider = {
    submit: async () => {
      calls += 1;
      return { output };
    },
  };
  return {
    provider,
    getCalls: () => calls,
  };
}

test('--help exits 0 and prints usage', async () => {
  const lines: string[] = [];
  const { exitCode } = await main(['--help'], { out: (l) => lines.push(l) });
  assert.equal(exitCode, 0);
  assert.ok(lines.some((l) => l.includes('Usage:')), 'expected Usage: in output');
});

test('-h exits 0 and prints usage', async () => {
  const lines: string[] = [];
  const { exitCode } = await main(['-h'], { out: (l) => lines.push(l) });
  assert.equal(exitCode, 0);
  assert.ok(lines.some((l) => l.includes('Usage:')), 'expected Usage: in output');
});

test('bare invocation exits 0 and prints usage', async () => {
  const lines: string[] = [];
  const { exitCode } = await main([], { out: (l) => lines.push(l) });
  assert.equal(exitCode, 0);
  assert.ok(lines.some((l) => l.includes('Usage:')), 'expected Usage: in output');
});

test('--version exits 0 and prints version', async () => {
  const lines: string[] = [];
  const { exitCode } = await main(['--version'], { out: (l) => lines.push(l) });
  assert.equal(exitCode, 0);
  assert.ok(lines.some((l) => /\d+\.\d+\.\d+/.test(l)), 'expected semver in output');
});

test('unknown long option exits 1 and names the bad option', async () => {
  const lines: string[] = [];
  const { exitCode } = await main(['--bogus-flag'], { err: (l) => lines.push(l) });
  assert.equal(exitCode, 1);
  assert.ok(lines.some((l) => l.includes('--bogus-flag')), 'expected bad option named in error');
});

test('unknown short option exits 1 and names the bad option', async () => {
  const lines: string[] = [];
  const { exitCode } = await main(['-z'], { err: (l) => lines.push(l) });
  assert.equal(exitCode, 1);
  assert.ok(lines.some((l) => l.includes('-z')), 'expected bad option named in error');
});

test('extra positional argument exits 1 with actionable message', async () => {
  const lines: string[] = [];
  const { exitCode } = await main(['unexpected'], { err: (l) => lines.push(l) });
  assert.equal(exitCode, 1);
  assert.ok(lines.some((l) => l.includes('unexpected')), 'expected extra arg named in error');
});

test('help output lists known options', async () => {
  const lines: string[] = [];
  await main(['--help'], { out: (l) => lines.push(l) });
  const full = lines.join('\n');
  assert.ok(full.includes('--help'), 'expected --help in output');
  assert.ok(full.includes('--version'), 'expected --version in output');
});

// ---------------------------------------------------------------------------
// --check-config / -c
// ---------------------------------------------------------------------------

test('--check-config exits 0 and lists each verified path', async () => {
  const dir = await makeTempProject(true);
  try {
    const out: string[] = [];
    const { exitCode } = await main(['--check-config'], { out: (l) => out.push(l), cwd: dir });
    assert.equal(exitCode, 0, 'expected exit 0 on valid config');
    const full = out.join('\n');
    assert.ok(full.includes('sources.build_intent'), 'expected path label in success output');
    assert.ok(full.includes('sources.system_constraints'), 'expected system_constraints label in success output');
    assert.ok(full.includes('docs/prd.md'), 'expected artifact path in success output');
    assert.ok(full.includes('provider.name'), 'expected provider.name in success output');
    assert.ok(full.includes('anthropic'), 'expected provider name value in success output');
    assert.ok(full.includes('OK'), 'expected OK in success summary');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('-c is alias for --check-config', async () => {
  const dir = await makeTempProject(true);
  try {
    const { exitCode } = await main(['-c'], { out: () => {}, cwd: dir });
    assert.equal(exitCode, 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--check-config exits 2 when raes.config.yaml is missing, includes fix guidance', async () => {
  const dir = await makeTempProject(false);
  try {
    const errs: string[] = [];
    const { exitCode } = await main(['--check-config'], { err: (l) => errs.push(l), cwd: dir });
    assert.equal(exitCode, 2, 'expected exit 2 on config error');
    const full = errs.join('\n');
    assert.ok(full.includes('raes.config.yaml'), 'expected config filename in error');
    assert.ok(full.includes('fix:'), 'expected fix guidance in output');
    assert.ok(full.includes('error found') || full.includes('errors found'), 'expected error count summary');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--check-config exits 2 and names missing artifact with fix guidance', async () => {
  const dir = await makeTempProject(false);
  try {
    await writeFile(join(dir, 'raes.config.yaml'), VALID_CONFIG_YAML);
    rmSync(join(dir, 'docs/prd.md'));
    const errs: string[] = [];
    const { exitCode } = await main(['--check-config'], { err: (l) => errs.push(l), cwd: dir });
    assert.equal(exitCode, 2);
    const full = errs.join('\n');
    assert.ok(full.includes('docs/prd.md'), 'expected artifact path in error');
    assert.ok(full.includes('field:'), 'expected field label in error block');
    assert.ok(full.includes('fix:'), 'expected fix guidance in error block');
    assert.ok(full.includes('error found') || full.includes('errors found'), 'expected error count summary');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--check-config supports --config <path> from outside the target project', async () => {
  const monorepoDir = await mkdtemp(join(tmpdir(), 'raes-cli-monorepo-'));
  const projectDir = join(monorepoDir, 'projects', 'demo');
  try {
    await mkdir(join(projectDir, 'docs'), { recursive: true });
    for (const file of ALL_ARTIFACT_PATHS) {
      await writeFile(join(projectDir, file), '# stub');
    }
    await writeFile(join(projectDir, 'raes.config.yaml'), VALID_CONFIG_YAML);

    const out: string[] = [];
    const { exitCode } = await main(
      ['--check-config', '--config', join(projectDir, 'raes.config.yaml')],
      { out: (line) => out.push(line), cwd: monorepoDir },
    );
    assert.equal(exitCode, 0);
    assert.ok(out.join('\n').includes('OK'), 'expected explicit config path to validate');
  } finally {
    rmSync(monorepoDir, { recursive: true });
  }
});

test('--status supports --config <path> from outside the target project', async () => {
  const monorepoDir = await mkdtemp(join(tmpdir(), 'raes-cli-monorepo-'));
  const projectDir = join(monorepoDir, 'projects', 'demo');
  try {
    await mkdir(join(projectDir, 'docs'), { recursive: true });
    for (const file of ALL_ARTIFACT_PATHS) {
      await writeFile(join(projectDir, file), '# stub');
    }
    await writeFile(join(projectDir, 'raes.config.yaml'), VALID_CONFIG_YAML);
    await writeFile(join(projectDir, 'docs/pipeline.md'), PIPELINE_WITH_MIXED_SLICES);

    const out: string[] = [];
    const { exitCode } = await main(
      ['--status', '--config', join(projectDir, 'raes.config.yaml')],
      { out: (line) => out.push(line), cwd: monorepoDir },
    );
    assert.equal(exitCode, 0);
    const full = out.join('\n');
    assert.ok(full.includes('test-project'), 'expected explicit config status output');
    assert.ok(full.includes('Next unchecked slice to run'), 'expected pipeline to resolve from target project');
  } finally {
    rmSync(monorepoDir, { recursive: true });
  }
});

test('--status supports explicit legacy docs/raes.config.yaml from outside the target project', async () => {
  const monorepoDir = await mkdtemp(join(tmpdir(), 'raes-cli-monorepo-'));
  const projectDir = join(monorepoDir, 'projects', 'demo');
  try {
    await mkdir(join(projectDir, 'docs'), { recursive: true });
    for (const file of ALL_ARTIFACT_PATHS) {
      await writeFile(join(projectDir, file), '# stub');
    }
    await writeFile(join(projectDir, 'docs', 'raes.config.yaml'), VALID_CONFIG_YAML);
    await writeFile(join(projectDir, 'docs/pipeline.md'), PIPELINE_WITH_MIXED_SLICES);

    const out: string[] = [];
    const { exitCode } = await main(
      ['--status', '--config', join(projectDir, 'docs', 'raes.config.yaml')],
      { out: (line) => out.push(line), cwd: monorepoDir },
    );
    assert.equal(exitCode, 0);
    const full = out.join('\n');
    assert.ok(full.includes('test-project'), 'expected legacy explicit config status output');
    assert.ok(full.includes('Next unchecked slice to run'), 'expected pipeline to resolve from project root');
  } finally {
    rmSync(monorepoDir, { recursive: true });
  }
});

test('--status from a parent directory does not discover nested project configs implicitly', async () => {
  const monorepoDir = await mkdtemp(join(tmpdir(), 'raes-cli-monorepo-'));
  const projectDir = join(monorepoDir, 'projects', 'demo');
  try {
    await mkdir(join(projectDir, 'docs'), { recursive: true });
    for (const file of ALL_ARTIFACT_PATHS) {
      await writeFile(join(projectDir, file), '# stub');
    }
    await writeFile(join(projectDir, 'raes.config.yaml'), VALID_CONFIG_YAML);

    const errs: string[] = [];
    const { exitCode } = await main(['--status'], { err: (line) => errs.push(line), cwd: monorepoDir });
    assert.equal(exitCode, 2);
    assert.ok(errs.join('\n').includes('raes.config.yaml not found'), 'expected no implicit discovery');
  } finally {
    rmSync(monorepoDir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// --status / -s
// ---------------------------------------------------------------------------

const PIPELINE_WITH_MIXED_SLICES = `
## Slice Backlog

- [x] Slice 1: First completed slice
- [x] Slice 2: Second completed slice
- [ ] Slice 3: Next unchecked slice to run
- [ ] Slice 4: Another pending slice
`;

async function makeTempProjectWithPipeline(pipelineContent: string): Promise<string> {
  const dir = await makeTempProject(true);
  await writeFile(join(dir, 'docs/pipeline.md'), pipelineContent);
  return dir;
}

test('--status exits 0 and prints project name', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_MIXED_SLICES);
  try {
    const out: string[] = [];
    const { exitCode } = await main(['--status'], { out: (l) => out.push(l), cwd: dir });
    assert.equal(exitCode, 0);
    const full = out.join('\n');
    assert.ok(full.includes('test-project'), 'expected project name in output');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--status prints slice counts (complete, remaining, total)', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_MIXED_SLICES);
  try {
    const out: string[] = [];
    const { exitCode } = await main(['--status'], { out: (l) => out.push(l), cwd: dir });
    assert.equal(exitCode, 0);
    const full = out.join('\n');
    assert.ok(full.includes('2 complete'), 'expected complete count in output');
    assert.ok(full.includes('2 remaining'), 'expected remaining count in output');
    assert.ok(full.includes('4 total') || full.match(/\(4\s/), 'expected total count in output');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--status prints the label of the next unchecked slice', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_MIXED_SLICES);
  try {
    const out: string[] = [];
    const { exitCode } = await main(['--status'], { out: (l) => out.push(l), cwd: dir });
    assert.equal(exitCode, 0);
    const full = out.join('\n');
    assert.ok(full.includes('Next unchecked slice to run'), 'expected next slice label in output');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--status prints "none" for flags', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_MIXED_SLICES);
  try {
    const out: string[] = [];
    const { exitCode } = await main(['--status'], { out: (l) => out.push(l), cwd: dir });
    assert.equal(exitCode, 0);
    const full = out.join('\n');
    assert.ok(full.includes('none'), 'expected "none" for flags in output');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--status prints "all slices complete" when pipeline is fully checked', async () => {
  const allComplete = `
## Slice Backlog

- [x] Slice 1: First
- [x] Slice 2: Second
`;
  const dir = await makeTempProjectWithPipeline(allComplete);
  try {
    const out: string[] = [];
    const { exitCode } = await main(['--status'], { out: (l) => out.push(l), cwd: dir });
    assert.equal(exitCode, 0);
    const full = out.join('\n');
    assert.ok(full.includes('all slices complete'), 'expected completion message when no next slice');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('-s is alias for --status', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_MIXED_SLICES);
  try {
    const out: string[] = [];
    const { exitCode } = await main(['-s'], { out: (l) => out.push(l), cwd: dir });
    assert.equal(exitCode, 0);
    assert.ok(out.some((l) => l.includes('test-project')));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--status exits 2 when config is missing', async () => {
  const dir = await makeTempProject(false);
  try {
    const errs: string[] = [];
    const { exitCode } = await main(['--status'], { err: (l) => errs.push(l), cwd: dir });
    assert.equal(exitCode, 2);
    const full = errs.join('\n');
    assert.ok(full.includes('raes.config.yaml'), 'expected config error message');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// --list-slices / -l
// ---------------------------------------------------------------------------

test('--list-slices exits 0 with valid config and pipeline', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_MIXED_SLICES);
  try {
    const out: string[] = [];
    const { exitCode } = await main(['--list-slices'], { out: (l) => out.push(l), cwd: dir });
    assert.equal(exitCode, 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('-l is alias for --list-slices', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_MIXED_SLICES);
  try {
    const { exitCode } = await main(['-l'], { out: () => {}, cwd: dir });
    assert.equal(exitCode, 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--list-slices outputs one line per slice', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_MIXED_SLICES);
  try {
    const out: string[] = [];
    const { exitCode } = await main(['--list-slices'], { out: (l) => out.push(l), cwd: dir });
    assert.equal(exitCode, 0);
    assert.equal(out.length, 4, 'expected one output line per slice');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--list-slices shows ✓ for complete slices', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_MIXED_SLICES);
  try {
    const out: string[] = [];
    await main(['--list-slices'], { out: (l) => out.push(l), cwd: dir });
    assert.ok(out[0].includes('✓'), 'first slice (complete) should show ✓');
    assert.ok(out[1].includes('✓'), 'second slice (complete) should show ✓');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--list-slices shows ○ for pending slices', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_MIXED_SLICES);
  try {
    const out: string[] = [];
    await main(['--list-slices'], { out: (l) => out.push(l), cwd: dir });
    assert.ok(out[2].includes('○'), 'third slice (pending) should show ○');
    assert.ok(out[3].includes('○'), 'fourth slice (pending) should show ○');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--list-slices includes slice labels in output', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_MIXED_SLICES);
  try {
    const out: string[] = [];
    await main(['--list-slices'], { out: (l) => out.push(l), cwd: dir });
    const full = out.join('\n');
    assert.ok(full.includes('First completed slice'), 'expected first slice label in output');
    assert.ok(full.includes('Next unchecked slice to run'), 'expected pending slice label in output');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--list-slices with empty pipeline exits 0 with no output lines', async () => {
  const emptyPipeline = `\n## Slice Backlog\n\n`;
  const dir = await makeTempProjectWithPipeline(emptyPipeline);
  try {
    const out: string[] = [];
    const { exitCode } = await main(['--list-slices'], { out: (l) => out.push(l), cwd: dir });
    assert.equal(exitCode, 0);
    assert.equal(out.length, 0, 'expected no output lines for empty pipeline');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--list-slices exits 2 when config is missing', async () => {
  const dir = await makeTempProject(false);
  try {
    const errs: string[] = [];
    const { exitCode } = await main(['--list-slices'], { err: (l) => errs.push(l), cwd: dir });
    assert.equal(exitCode, 2);
    assert.ok(errs.join('\n').includes('raes.config.yaml'), 'expected config error message');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// --show-next-slice / -n
// ---------------------------------------------------------------------------

test('--show-next-slice exits 0 with valid config and pipeline', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_MIXED_SLICES);
  try {
    const out: string[] = [];
    const { exitCode } = await main(['--show-next-slice'], { out: (l) => out.push(l), cwd: dir });
    assert.equal(exitCode, 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('-n is alias for --show-next-slice', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_MIXED_SLICES);
  try {
    const out: string[] = [];
    const { exitCode } = await main(['-n'], { out: (l) => out.push(l), cwd: dir });
    assert.equal(exitCode, 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--show-next-slice prints slice position in output', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_MIXED_SLICES);
  try {
    const out: string[] = [];
    await main(['--show-next-slice'], { out: (l) => out.push(l), cwd: dir });
    const full = out.join('\n');
    assert.ok(full.includes('3'), 'expected position 3 (first unchecked slice) in output');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--show-next-slice prints "pending" status in output', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_MIXED_SLICES);
  try {
    const out: string[] = [];
    await main(['--show-next-slice'], { out: (l) => out.push(l), cwd: dir });
    assert.ok(out.join('\n').includes('pending'), 'expected pending status in output');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--show-next-slice prints slice label in output', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_MIXED_SLICES);
  try {
    const out: string[] = [];
    await main(['--show-next-slice'], { out: (l) => out.push(l), cwd: dir });
    assert.ok(out.join('\n').includes('Next unchecked slice to run'), 'expected label of next unchecked slice in output');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--show-next-slice prints "all slices complete" when no unchecked slice', async () => {
  const allComplete = `\n## Slice Backlog\n\n- [x] Slice 1: First\n- [x] Slice 2: Second\n`;
  const dir = await makeTempProjectWithPipeline(allComplete);
  try {
    const out: string[] = [];
    const { exitCode } = await main(['--show-next-slice'], { out: (l) => out.push(l), cwd: dir });
    assert.equal(exitCode, 0);
    assert.ok(out.join('\n').includes('all slices complete'), 'expected completion message');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--show-next-slice exits 2 when config is missing', async () => {
  const dir = await makeTempProject(false);
  try {
    const errs: string[] = [];
    const { exitCode } = await main(['--show-next-slice'], { err: (l) => errs.push(l), cwd: dir });
    assert.equal(exitCode, 2);
    assert.ok(errs.join('\n').includes('raes.config.yaml'), 'expected config error message');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--show-next-slice exits 2 when pipeline file is unreadable', async () => {
  const dir = await makeTempProject(true);
  try {
    rmSync(join(dir, 'docs/pipeline.md'));
    const errs: string[] = [];
    const { exitCode } = await main(['--show-next-slice'], { err: (l) => errs.push(l), cwd: dir });
    assert.equal(exitCode, 2);
    assert.ok(errs.join('\n').includes('pipeline'), 'expected pipeline error message');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// --print-artifact / -p
// ---------------------------------------------------------------------------

test('--print-artifact exits 0 and prints file content', async () => {
  const dir = await makeTempProject(true);
  try {
    await writeFile(join(dir, 'docs/prd.md'), '# PRD content\nsome text');
    const out: string[] = [];
    const { exitCode } = await main(['--print-artifact', 'prd'], { out: (l) => out.push(l), cwd: dir });
    assert.equal(exitCode, 0);
    const full = out.join('\n');
    assert.ok(full.includes('PRD content'), 'expected file content in output');
    assert.ok(full.includes('some text'), 'expected file content in output');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('-p is alias for --print-artifact', async () => {
  const dir = await makeTempProject(true);
  try {
    const out: string[] = [];
    const { exitCode } = await main(['-p', 'prd'], { out: (l) => out.push(l), cwd: dir });
    assert.equal(exitCode, 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--print-artifact output includes artifact name and path in header', async () => {
  const dir = await makeTempProject(true);
  try {
    const out: string[] = [];
    await main(['--print-artifact', 'prd'], { out: (l) => out.push(l), cwd: dir });
    const full = out.join('\n');
    assert.ok(full.includes('prd'), 'expected artifact name in header');
    assert.ok(full.includes('docs/prd.md'), 'expected artifact path in header');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--print-artifact resolves "system" to system_constraints artifact', async () => {
  const dir = await makeTempProject(true);
  try {
    await writeFile(join(dir, 'docs/system.md'), '# system content');
    const out: string[] = [];
    const { exitCode } = await main(['--print-artifact', 'system'], { out: (l) => out.push(l), cwd: dir });
    assert.equal(exitCode, 0);
    assert.ok(out.join('\n').includes('system content'), 'expected system.md content in output');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--print-artifact resolves "decisions" to durable_decisions artifact', async () => {
  const dir = await makeTempProject(true);
  try {
    await writeFile(join(dir, 'docs/decisions.md'), '# decisions content');
    const out: string[] = [];
    const { exitCode } = await main(['--print-artifact', 'decisions'], { out: (l) => out.push(l), cwd: dir });
    assert.equal(exitCode, 0);
    assert.ok(out.join('\n').includes('decisions content'), 'expected decisions.md content in output');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--print-artifact exits 1 for unknown artifact name with actionable message', async () => {
  const dir = await makeTempProject(true);
  try {
    const errs: string[] = [];
    const { exitCode } = await main(['--print-artifact', 'bogus'], { err: (l) => errs.push(l), cwd: dir });
    assert.equal(exitCode, 1);
    const full = errs.join('\n');
    assert.ok(full.includes('bogus'), 'expected unknown name in error message');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--print-artifact without value exits 1 with usage message', async () => {
  const dir = await makeTempProject(true);
  try {
    const errs: string[] = [];
    const { exitCode } = await main(['--print-artifact'], { err: (l) => errs.push(l), cwd: dir });
    assert.equal(exitCode, 1);
    assert.ok(errs.join('\n').includes('--print-artifact'), 'expected option name in error message');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--print-artifact exits 2 when config is missing', async () => {
  const dir = await makeTempProject(false);
  try {
    const errs: string[] = [];
    const { exitCode } = await main(['--print-artifact', 'prd'], { err: (l) => errs.push(l), cwd: dir });
    assert.equal(exitCode, 2);
    assert.ok(errs.join('\n').includes('raes.config.yaml'), 'expected config error message');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--print-artifact exits 2 when artifact file is unreadable', async () => {
  const dir = await makeTempProject(true);
  try {
    rmSync(join(dir, 'docs/prd.md'));
    const errs: string[] = [];
    const { exitCode } = await main(['--print-artifact', 'prd'], { err: (l) => errs.push(l), cwd: dir });
    assert.equal(exitCode, 2);
    assert.ok(errs.join('\n').includes('prd'), 'expected artifact name in error message');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// --execute-next-slice / -e
// ---------------------------------------------------------------------------

const PIPELINE_WITH_EXECUTION_SLICE = `
## Slice Backlog

- [x] Slice 1: First completed slice
- [ ] Slice 2: Implement the next feature
`;

const PIPELINE_WITH_REVIEW_SLICE = `
## Slice Backlog

- [x] Slice 1: First completed slice
- [ ] Slice 2: Implement Review Loop for --execute-next-slice
`;

const PIPELINE_ALL_COMPLETE = `
## Slice Backlog

- [x] Slice 1: First
- [x] Slice 2: Second
`;

test('--execute-next-slice exits 0 and prints "all slices complete" when no unchecked slice', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_ALL_COMPLETE);
  try {
    const out: string[] = [];
    const { exitCode } = await main(['--execute-next-slice'], { out: (l) => out.push(l), cwd: dir });
    assert.equal(exitCode, 0);
    assert.ok(out.join('\n').includes('all slices complete'), 'expected completion message');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('-e is alias for --execute-next-slice', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_ALL_COMPLETE);
  try {
    const out: string[] = [];
    const { exitCode } = await main(['-e'], { out: (l) => out.push(l), cwd: dir });
    assert.equal(exitCode, 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice shows next slice label in output', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_EXECUTION_SLICE);
  try {
    const out: string[] = [];
    await main(['--execute-next-slice'], {
      out: (l) => out.push(l),
      err: () => {},
      in: async () => 'n',
      cwd: dir,
      provider: testProvider(),
      loadPrompt: () => 'prompt text',
    });
    assert.ok(out.join('\n').includes('Implement the next feature'), 'expected slice label in output');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice shows "Execution Loop" for an execution-type slice', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_EXECUTION_SLICE);
  try {
    const out: string[] = [];
    await main(['--execute-next-slice'], {
      out: (l) => out.push(l),
      err: () => {},
      in: async () => 'n',
      cwd: dir,
      provider: testProvider(),
      loadPrompt: () => 'prompt text',
    });
    assert.ok(out.join('\n').includes('Execution Loop'), 'expected Execution Loop in output');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice shows "Review Loop" for a review-type slice', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_REVIEW_SLICE);
  try {
    const out: string[] = [];
    await main(['--execute-next-slice'], {
      out: (l) => out.push(l),
      err: () => {},
      in: async () => null,
      cwd: dir,
      provider: testProvider(),
      loadPrompt: () => 'prompt text',
    });
    assert.ok(out.join('\n').includes('Review Loop'), 'expected Review Loop in output');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice Execution Loop: exits 0 and marks slice complete when user confirms', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_EXECUTION_SLICE);
  try {
    const out: string[] = [];
    const { exitCode } = await main(
      ['--execute-next-slice'],
      {
        out: (l) => out.push(l),
        err: () => {},
        in: async () => 'y',
        cwd: dir,
        provider: testProvider(),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(exitCode, 0);
    assert.ok(out.join('\n').includes('Slice complete'), 'expected completion confirmation in output');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice Execution Loop: marks slice as [x] in pipeline file on confirm', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_EXECUTION_SLICE);
  try {
    await main(
      ['--execute-next-slice'],
      {
        out: () => {},
        err: () => {},
        in: async () => 'y',
        cwd: dir,
        provider: testProvider(),
        loadPrompt: () => 'prompt text',
      },
    );
    const pipelineContent = readFileSync(join(dir, 'docs/pipeline.md'), 'utf8');
    assert.ok(
      pipelineContent.includes('- [x] Slice 2: Implement the next feature'),
      'expected next slice to be marked complete in pipeline',
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice Execution Loop: exits 0 without modifying pipeline when user declines', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_EXECUTION_SLICE);
  try {
    const out: string[] = [];
    const { exitCode } = await main(
      ['--execute-next-slice'],
      {
        out: (l) => out.push(l),
        err: () => {},
        in: async () => 'n',
        cwd: dir,
        provider: testProvider(),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(exitCode, 0);
    assert.ok(out.join('\n').includes('Slice not recorded'), 'expected not-recorded message in output');
    const pipelineContent = readFileSync(join(dir, 'docs/pipeline.md'), 'utf8');
    assert.ok(
      pipelineContent.includes('- [ ] Slice 2: Implement the next feature'),
      'expected next slice to remain unchecked after cancellation',
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice Execution Loop: exits 0 without modifying pipeline on empty input', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_EXECUTION_SLICE);
  try {
    const { exitCode } = await main(
      ['--execute-next-slice'],
      {
        out: () => {},
        err: () => {},
        in: async () => null,
        cwd: dir,
        provider: testProvider(),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(exitCode, 0);
    const pipelineContent = readFileSync(join(dir, 'docs/pipeline.md'), 'utf8');
    assert.ok(
      pipelineContent.includes('- [ ] Slice 2: Implement the next feature'),
      'expected next slice to remain unchecked when input is empty',
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice Execution Loop: exits 2 and reports artifact boundary violations', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_EXECUTION_SLICE);
  try {
    // Inject a product-intent header into system.md to create a boundary violation
    await writeFile(join(dir, 'docs/system.md'), '# System\n\n## Business Goals\n\nThis is a violation.\n');
    const errs: string[] = [];
    const { exitCode } = await main(
      ['--execute-next-slice'],
      { out: () => {}, err: (l) => errs.push(l), in: async () => 'y', cwd: dir },
    );
    assert.equal(exitCode, 2);
    const full = errs.join('\n');
    assert.ok(full.includes('boundary violations'), 'expected boundary violation message');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice Execution Loop: shows artifact path in violation report', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_EXECUTION_SLICE);
  try {
    await writeFile(join(dir, 'docs/system.md'), '# System\n\n## Business Goals\n\nThis is a violation.\n');
    const errs: string[] = [];
    await main(
      ['--execute-next-slice'],
      { out: () => {}, err: (l) => errs.push(l), in: async () => 'y', cwd: dir },
    );
    assert.ok(errs.join('\n').includes('docs/system.md'), 'expected artifact path in violation report');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice Review Loop: exits 0 and marks slice complete when user confirms', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_REVIEW_SLICE);
  try {
    const out: string[] = [];
    const { exitCode } = await main(
      ['--execute-next-slice'],
      {
        out: (l) => out.push(l),
        err: () => {},
        in: async () => 'y',
        cwd: dir,
        provider: testProvider(),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(exitCode, 0);
    assert.ok(out.join('\n').includes('Review complete'), 'expected review completion message in output');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice Review Loop: marks slice as [x] in pipeline file on confirm', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_REVIEW_SLICE);
  try {
    await main(
      ['--execute-next-slice'],
      {
        out: () => {},
        err: () => {},
        in: async () => 'y',
        cwd: dir,
        provider: testProvider(),
        loadPrompt: () => 'prompt text',
      },
    );
    const pipelineContent = readFileSync(join(dir, 'docs/pipeline.md'), 'utf8');
    assert.ok(
      pipelineContent.includes('- [x] Slice 2: Implement Review Loop for --execute-next-slice'),
      'expected next slice to be marked complete in pipeline',
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice Review Loop: exits 0 without modifying pipeline when user declines', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_REVIEW_SLICE);
  try {
    const out: string[] = [];
    const { exitCode } = await main(
      ['--execute-next-slice'],
      {
        out: (l) => out.push(l),
        err: () => {},
        in: async () => 'n',
        cwd: dir,
        provider: testProvider(),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(exitCode, 0);
    assert.ok(out.join('\n').includes('Slice not recorded'), 'expected not-recorded message in output');
    const pipelineContent = readFileSync(join(dir, 'docs/pipeline.md'), 'utf8');
    assert.ok(
      pipelineContent.includes('- [ ] Slice 2: Implement Review Loop for --execute-next-slice'),
      'expected next slice to remain unchecked after cancellation',
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice Review Loop: exits 0 without modifying pipeline on empty input', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_REVIEW_SLICE);
  try {
    const { exitCode } = await main(
      ['--execute-next-slice'],
      {
        out: () => {},
        err: () => {},
        in: async () => null,
        cwd: dir,
        provider: testProvider(),
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(exitCode, 0);
    const pipelineContent = readFileSync(join(dir, 'docs/pipeline.md'), 'utf8');
    assert.ok(
      pipelineContent.includes('- [ ] Slice 2: Implement Review Loop for --execute-next-slice'),
      'expected next slice to remain unchecked when input is empty',
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice Review Loop: exits 2 and reports artifact boundary violations', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_REVIEW_SLICE);
  try {
    await writeFile(join(dir, 'docs/system.md'), '# System\n\n## Business Goals\n\nThis is a violation.\n');
    const errs: string[] = [];
    const { exitCode } = await main(
      ['--execute-next-slice'],
      { out: () => {}, err: (l) => errs.push(l), in: async () => 'y', cwd: dir },
    );
    assert.equal(exitCode, 2);
    assert.ok(errs.join('\n').includes('boundary violations'), 'expected boundary violation message');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice Review Loop: shows artifact path in violation report', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_REVIEW_SLICE);
  try {
    await writeFile(join(dir, 'docs/system.md'), '# System\n\n## Business Goals\n\nThis is a violation.\n');
    const errs: string[] = [];
    await main(
      ['--execute-next-slice'],
      { out: () => {}, err: (l) => errs.push(l), in: async () => 'y', cwd: dir },
    );
    assert.ok(errs.join('\n').includes('docs/system.md'), 'expected artifact path in violation report');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice exits 2 when config is missing', async () => {
  const dir = await makeTempProject(false);
  try {
    const errs: string[] = [];
    const { exitCode } = await main(['--execute-next-slice'], { err: (l) => errs.push(l), cwd: dir });
    assert.equal(exitCode, 2);
    assert.ok(errs.join('\n').includes('raes.config.yaml'), 'expected config error message');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice exits 2 when pipeline file is unreadable', async () => {
  const dir = await makeTempProject(true);
  try {
    rmSync(join(dir, 'docs/pipeline.md'));
    const errs: string[] = [];
    const { exitCode } = await main(['--execute-next-slice'], { err: (l) => errs.push(l), cwd: dir });
    assert.equal(exitCode, 2);
    assert.ok(errs.join('\n').includes('pipeline'), 'expected pipeline error message');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice --dry-run prints preflight output for execution slices without provider submission or writes', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_EXECUTION_SLICE);
  const providerSpy = testProviderSpy();
  try {
    const out: string[] = [];
    const { exitCode } = await main(
      ['--execute-next-slice', '--dry-run'],
      {
        out: (line) => out.push(line),
        err: () => {},
        cwd: dir,
        provider: providerSpy.provider,
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(exitCode, 0);
    const full = out.join('\n');
    assert.ok(full.includes('Implement the next feature'), 'expected slice label in dry-run output');
    assert.ok(full.includes('Execution Loop'), 'expected loop type in dry-run output');
    assert.ok(full.includes('anthropic'), 'expected provider name in dry-run output');
    assert.ok(full.includes(join(dir, 'docs/pipeline.md')), 'expected pipeline path in dry-run output');
    assert.ok(full.includes(getPromptPath()), 'expected prompt source path in dry-run output');
    assert.ok(full.includes('enabled'), 'expected write access mode in dry-run output');
    assert.equal(providerSpy.getCalls(), 0, 'expected dry-run to skip provider submission');
    const pipelineContent = readFileSync(join(dir, 'docs/pipeline.md'), 'utf8');
    assert.ok(
      pipelineContent.includes('- [ ] Slice 2: Implement the next feature'),
      'expected dry-run to leave the pipeline unchanged',
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice --dry-run prints preflight output for review slices without provider submission or writes', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_REVIEW_SLICE);
  const providerSpy = testProviderSpy();
  try {
    const out: string[] = [];
    const { exitCode } = await main(
      ['--execute-next-slice', '--dry-run'],
      {
        out: (line) => out.push(line),
        err: () => {},
        cwd: dir,
        provider: providerSpy.provider,
        loadPrompt: () => 'prompt text',
      },
    );
    assert.equal(exitCode, 0);
    const full = out.join('\n');
    assert.ok(full.includes('Implement Review Loop for --execute-next-slice'), 'expected slice label in dry-run output');
    assert.ok(full.includes('Review Loop'), 'expected review loop type in dry-run output');
    assert.equal(providerSpy.getCalls(), 0, 'expected dry-run to skip provider submission');
    const pipelineContent = readFileSync(join(dir, 'docs/pipeline.md'), 'utf8');
    assert.ok(
      pipelineContent.includes('- [ ] Slice 2: Implement Review Loop for --execute-next-slice'),
      'expected dry-run to leave the review slice unchecked',
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice --dry-run exits 2 on prompt load failure', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_EXECUTION_SLICE);
  const providerSpy = testProviderSpy();
  try {
    const errs: string[] = [];
    const { exitCode } = await main(
      ['--execute-next-slice', '--dry-run'],
      {
        out: () => {},
        err: (line) => errs.push(line),
        cwd: dir,
        provider: providerSpy.provider,
        loadPrompt: () => {
          const error = new Error('Prompt file not found: fake') as Error & { fix?: string };
          error.fix = 'Create the prompt file';
          throw error;
        },
      },
    );
    assert.equal(exitCode, 2);
    assert.ok(errs.join('\n').includes('Prompt file not found'), 'expected prompt failure in stderr');
    assert.equal(providerSpy.getCalls(), 0, 'expected dry-run to fail before provider submission');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--check-config reports all missing artifacts with individual fix blocks', async () => {
  // Create a project with config but NO artifact files
  const dir = await mkdtemp(join(tmpdir(), 'raes-cli-test-'));
  try {
    await mkdir(join(dir, 'docs'), { recursive: true });
    await writeFile(join(dir, 'raes.config.yaml'), VALID_CONFIG_YAML);
    const errs: string[] = [];
    const { exitCode } = await main(['--check-config'], { err: (l) => errs.push(l), cwd: dir });
    assert.equal(exitCode, 2);
    const full = errs.join('\n');
    assert.ok(full.includes('6 errors found'), 'expected count of all 6 missing artifacts');
    const fixCount = (full.match(/fix:/g) ?? []).length;
    assert.equal(fixCount, 6, 'expected one fix: line per error');
  } finally {
    rmSync(dir, { recursive: true });
  }
});
