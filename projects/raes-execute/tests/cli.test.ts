import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';
import { main } from '../src/cli.ts';

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
    assert.ok(full.includes('6 artifact paths verified'), 'expected count in success summary');
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
    await main(['--execute-next-slice'], { out: (l) => out.push(l), err: () => {}, cwd: dir });
    assert.ok(out.join('\n').includes('Implement the next feature'), 'expected slice label in output');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice shows "Execution Loop" for an execution-type slice', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_EXECUTION_SLICE);
  try {
    const out: string[] = [];
    await main(['--execute-next-slice'], { out: (l) => out.push(l), err: () => {}, cwd: dir });
    assert.ok(out.join('\n').includes('Execution Loop'), 'expected Execution Loop in output');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice shows "Review Loop" for a review-type slice', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_REVIEW_SLICE);
  try {
    const out: string[] = [];
    await main(['--execute-next-slice'], { out: (l) => out.push(l), err: () => {}, cwd: dir });
    assert.ok(out.join('\n').includes('Review Loop'), 'expected Review Loop in output');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice exits 1 with not-yet-implemented error when loop is execution', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_EXECUTION_SLICE);
  try {
    const errs: string[] = [];
    const { exitCode } = await main(['--execute-next-slice'], { out: () => {}, err: (l) => errs.push(l), cwd: dir });
    assert.equal(exitCode, 1);
    assert.ok(errs.join('\n').includes('not yet implemented'), 'expected not-yet-implemented in error output');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('--execute-next-slice exits 1 with not-yet-implemented error when loop is review', async () => {
  const dir = await makeTempProjectWithPipeline(PIPELINE_WITH_REVIEW_SLICE);
  try {
    const errs: string[] = [];
    const { exitCode } = await main(['--execute-next-slice'], { out: () => {}, err: (l) => errs.push(l), cwd: dir });
    assert.equal(exitCode, 1);
    assert.ok(errs.join('\n').includes('not yet implemented'), 'expected not-yet-implemented in error output');
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
