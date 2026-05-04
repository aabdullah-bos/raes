import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { RaesConfig } from './config.ts';

export type ArtifactRole =
  | 'build_intent'
  | 'system_constraints'
  | 'next_slice'
  | 'durable_decisions'
  | 'execution_guidance'
  | 'validation';

export interface Artifact {
  role: ArtifactRole;
  path: string;
  content: string;
}

export interface BoundaryViolation {
  role: ArtifactRole;
  path: string;
  issue: string;
  evidence: string;
}

export function loadArtifact(
  role: ArtifactRole,
  relativePath: string,
  projectRoot: string,
): { artifact?: Artifact; error?: string } {
  const abs = join(projectRoot, relativePath);
  if (!existsSync(abs)) {
    return { error: `artifact not found: ${relativePath} [${role}]` };
  }
  try {
    const content = readFileSync(abs, 'utf8');
    return { artifact: { role, path: relativePath, content } };
  } catch (e) {
    return { error: `failed to read artifact ${relativePath}: ${String(e)}` };
  }
}

export function loadAllArtifacts(
  config: RaesConfig,
  projectRoot: string,
): { artifacts?: Record<ArtifactRole, Artifact>; errors: string[] } {
  const errors: string[] = [];
  const loaded = {} as Record<ArtifactRole, Artifact>;

  const specs: Array<{ role: ArtifactRole; path: string }> = [
    { role: 'build_intent', path: config.sources.build_intent },
    { role: 'system_constraints', path: config.sources.system_constraints },
    { role: 'next_slice', path: config.sources.next_slice.path },
    { role: 'durable_decisions', path: config.sources.durable_decisions },
    { role: 'execution_guidance', path: config.sources.execution_guidance },
    { role: 'validation', path: config.sources.validation },
  ];

  for (const { role, path } of specs) {
    const { artifact, error } = loadArtifact(role, path, projectRoot);
    if (error) {
      errors.push(error);
    } else {
      loaded[role] = artifact!;
    }
  }

  if (errors.length > 0) return { errors };
  return { artifacts: loaded, errors: [] };
}

// ---------------------------------------------------------------------------
// Boundary validation
// ---------------------------------------------------------------------------

// Section header patterns that belong to a specific artifact role.
// If a "foreign" header appears in an artifact of another role, it is a violation.

const PRODUCT_INTENT_HEADERS = /^#{1,3}\s+(Business Goals|User Goals|User Stories|Functional Requirements|Success Metrics|User Experience|Narrative)\s*$/m;
const DECISION_RECORD_HEADERS = /^#{1,3}\s+Durable Decisions\s*$/m;
const SYSTEM_CONSTRAINTS_HEADERS = /^#{1,3}\s+(Product Invariants|Drift Guards|Known Contracts)\s*$/m;
const SYSTEM_EXEC_HEADERS = /^#{1,3}\s+(Invariants|Anti-Patterns|Definition of Done|Workflow Rules)\s*$/m;
const PIPELINE_HEADERS = /^#{1,3}\s+(Slice Backlog|Handoff Notes)\s*$/m;
const VALIDATION_HEADERS = /^#{1,3}\s+(Testing Approach|Validation Commands|Known Constraints)\s*$/m;

type ForeignRule = { pattern: RegExp; issue: string };

const FOREIGN_RULES: Record<ArtifactRole, ForeignRule[]> = {
  build_intent: [
    { pattern: DECISION_RECORD_HEADERS, issue: 'decision record content (belongs in durable_decisions)' },
    { pattern: SYSTEM_CONSTRAINTS_HEADERS, issue: 'system constraints content (belongs in system_constraints)' },
    { pattern: SYSTEM_EXEC_HEADERS, issue: 'system/execution guidance content (belongs in execution_guidance)' },
    { pattern: PIPELINE_HEADERS, issue: 'pipeline/handoff content (belongs in next_slice)' },
    { pattern: VALIDATION_HEADERS, issue: 'validation content (belongs in validation)' },
  ],
  system_constraints: [
    { pattern: PRODUCT_INTENT_HEADERS, issue: 'product intent content (belongs in build_intent)' },
    { pattern: DECISION_RECORD_HEADERS, issue: 'decision record content (belongs in durable_decisions)' },
    { pattern: PIPELINE_HEADERS, issue: 'pipeline/handoff content (belongs in next_slice)' },
    { pattern: VALIDATION_HEADERS, issue: 'validation content (belongs in validation)' },
  ],
  durable_decisions: [
    { pattern: PRODUCT_INTENT_HEADERS, issue: 'product intent content (belongs in build_intent)' },
    { pattern: SYSTEM_CONSTRAINTS_HEADERS, issue: 'system constraints content (belongs in system_constraints)' },
    { pattern: SYSTEM_EXEC_HEADERS, issue: 'system/execution guidance content (belongs in execution_guidance)' },
    { pattern: PIPELINE_HEADERS, issue: 'pipeline/handoff content (belongs in next_slice)' },
    { pattern: VALIDATION_HEADERS, issue: 'validation content (belongs in validation)' },
  ],
  execution_guidance: [
    { pattern: PRODUCT_INTENT_HEADERS, issue: 'product intent content (belongs in build_intent)' },
    { pattern: DECISION_RECORD_HEADERS, issue: 'decision record content (belongs in durable_decisions)' },
    { pattern: SYSTEM_CONSTRAINTS_HEADERS, issue: 'system constraints content (belongs in system_constraints)' },
    { pattern: PIPELINE_HEADERS, issue: 'pipeline/handoff content (belongs in next_slice)' },
    { pattern: VALIDATION_HEADERS, issue: 'validation content (belongs in validation)' },
  ],
  validation: [
    { pattern: PRODUCT_INTENT_HEADERS, issue: 'product intent content (belongs in build_intent)' },
    { pattern: DECISION_RECORD_HEADERS, issue: 'decision record content (belongs in durable_decisions)' },
    { pattern: SYSTEM_CONSTRAINTS_HEADERS, issue: 'system constraints content (belongs in system_constraints)' },
    { pattern: SYSTEM_EXEC_HEADERS, issue: 'system/execution guidance content (belongs in execution_guidance)' },
    { pattern: PIPELINE_HEADERS, issue: 'pipeline/handoff content (belongs in next_slice)' },
  ],
  next_slice: [
    { pattern: PRODUCT_INTENT_HEADERS, issue: 'product intent content (belongs in build_intent)' },
    { pattern: DECISION_RECORD_HEADERS, issue: 'decision record content (belongs in durable_decisions)' },
    { pattern: SYSTEM_CONSTRAINTS_HEADERS, issue: 'system constraints content (belongs in system_constraints)' },
    { pattern: VALIDATION_HEADERS, issue: 'validation content (belongs in validation)' },
  ],
};

function findViolatingLine(content: string, pattern: RegExp): string | undefined {
  // Test each line individually so we capture the exact offending header.
  const singleLine = new RegExp(pattern.source.replace(/\^|\$/g, '').replace(/\s*\$/, ''));
  for (const line of content.split('\n')) {
    if (singleLine.test(line)) return line.trim();
  }
  return undefined;
}

export function validateBoundaries(
  artifacts: Record<ArtifactRole, Artifact>,
): BoundaryViolation[] {
  const violations: BoundaryViolation[] = [];

  for (const [roleKey, artifact] of Object.entries(artifacts) as Array<[ArtifactRole, Artifact]>) {
    const rules = FOREIGN_RULES[roleKey];
    for (const { pattern, issue } of rules) {
      if (pattern.test(artifact.content)) {
        const evidence = findViolatingLine(artifact.content, pattern) ?? '(see artifact content)';
        violations.push({ role: roleKey, path: artifact.path, issue, evidence });
      }
    }
  }

  return violations;
}
