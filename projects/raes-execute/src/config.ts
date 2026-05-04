import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface RaesConfig {
  project: { name: string };
  sources: {
    build_intent: string;
    system_constraints: string;
    next_slice: { path: string; selection_rule: string };
    durable_decisions: string;
    execution_guidance: string;
    validation: string;
  };
}

export interface ConfigError {
  field: string;
  message: string;
  fix?: string;
}

export function parseYaml(text: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  const stack: Array<{ obj: Record<string, unknown>; indent: number }> = [
    { obj: root, indent: -1 },
  ];

  for (const raw of text.split('\n')) {
    const trimmed = raw.trimEnd();
    if (!trimmed.trim() || trimmed.trim().startsWith('#')) continue;

    const indent = trimmed.length - trimmed.trimStart().length;
    const line = trimmed.trim();
    const colon = line.indexOf(':');
    if (colon === -1) continue;

    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim();

    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].obj;

    if (val === '') {
      const child: Record<string, unknown> = {};
      parent[key] = child;
      stack.push({ obj: child, indent });
    } else {
      parent[key] = val;
    }
  }

  return root;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function nonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function extractConfig(
  data: Record<string, unknown>,
): { config?: RaesConfig; errors: ConfigError[] } {
  const errors: ConfigError[] = [];

  const projectRaw = data['project'];
  if (!isObject(projectRaw)) {
    errors.push({
      field: 'project',
      message: "missing required section 'project' — raes.config.yaml",
      fix: "Add a 'project:' section with a 'name' key to raes.config.yaml",
    });
  } else if (!nonEmptyString(projectRaw['name'])) {
    errors.push({
      field: 'project.name',
      message: "missing or empty 'project.name' — raes.config.yaml",
      fix: "Set a non-empty value for 'name' under the 'project:' section in raes.config.yaml",
    });
  }

  const sourcesRaw = data['sources'];
  if (!isObject(sourcesRaw)) {
    errors.push({
      field: 'sources',
      message: "missing required section 'sources' — raes.config.yaml",
      fix: "Add a 'sources:' section listing build_intent, system_constraints, next_slice, durable_decisions, execution_guidance, and validation paths",
    });
    return { errors };
  }

  const requiredStringKeys: Array<{
    key: 'build_intent' | 'system_constraints' | 'durable_decisions' | 'execution_guidance' | 'validation';
    label: string;
    fix: string;
  }> = [
    {
      key: 'build_intent',
      label: 'sources.build_intent',
      fix: "Set 'sources.build_intent' to the relative path of your PRD artifact (e.g. docs/prd.md)",
    },
    {
      key: 'system_constraints',
      label: 'sources.system_constraints',
      fix: "Set 'sources.system_constraints' to the relative path of your system constraints artifact (e.g. docs/system.md)",
    },
    {
      key: 'durable_decisions',
      label: 'sources.durable_decisions',
      fix: "Set 'sources.durable_decisions' to the relative path of your decisions artifact (e.g. docs/decisions.md)",
    },
    {
      key: 'execution_guidance',
      label: 'sources.execution_guidance',
      fix: "Set 'sources.execution_guidance' to the relative path of your execution-guidance artifact (e.g. docs/execution-guidance.md)",
    },
    {
      key: 'validation',
      label: 'sources.validation',
      fix: "Set 'sources.validation' to the relative path of your validation artifact (e.g. docs/validation.md)",
    },
  ];

  for (const { key, label, fix } of requiredStringKeys) {
    if (!nonEmptyString(sourcesRaw[key])) {
      errors.push({
        field: label,
        message: `missing or empty '${label}' — raes.config.yaml`,
        fix,
      });
    }
  }

  const nextSliceRaw = sourcesRaw['next_slice'];
  if (!isObject(nextSliceRaw)) {
    errors.push({
      field: 'sources.next_slice',
      message: "missing required section 'sources.next_slice' — raes.config.yaml",
      fix: "Add a 'next_slice:' sub-section under 'sources:' with 'path' and 'selection_rule' keys",
    });
  } else {
    if (!nonEmptyString(nextSliceRaw['path'])) {
      errors.push({
        field: 'sources.next_slice.path',
        message: "missing or empty 'sources.next_slice.path' — raes.config.yaml",
        fix: "Set 'path' under 'sources.next_slice' to the relative path of your pipeline/backlog file (e.g. docs/pipeline.md)",
      });
    }
    if (!nonEmptyString(nextSliceRaw['selection_rule'])) {
      errors.push({
        field: 'sources.next_slice.selection_rule',
        message: "missing or empty 'sources.next_slice.selection_rule' — raes.config.yaml",
        fix: "Set 'selection_rule' under 'sources.next_slice' to a valid rule (e.g. first_unchecked_slice)",
      });
    }
  }

  if (errors.length > 0) return { errors };

  const config: RaesConfig = {
    project: { name: (projectRaw as Record<string, unknown>)['name'] as string },
    sources: {
      build_intent: sourcesRaw['build_intent'] as string,
      system_constraints: sourcesRaw['system_constraints'] as string,
      next_slice: {
        path: (nextSliceRaw as Record<string, unknown>)['path'] as string,
        selection_rule: (nextSliceRaw as Record<string, unknown>)['selection_rule'] as string,
      },
      durable_decisions: sourcesRaw['durable_decisions'] as string,
      execution_guidance: sourcesRaw['execution_guidance'] as string,
      validation: sourcesRaw['validation'] as string,
    },
  };

  return { config, errors: [] };
}

export function validatePaths(config: RaesConfig, projectRoot: string): ConfigError[] {
  const errors: ConfigError[] = [];

  const checks: Array<{ field: string; path: string }> = [
    { field: 'sources.build_intent', path: config.sources.build_intent },
    { field: 'sources.system_constraints', path: config.sources.system_constraints },
    { field: 'sources.next_slice.path', path: config.sources.next_slice.path },
    { field: 'sources.durable_decisions', path: config.sources.durable_decisions },
    { field: 'sources.execution_guidance', path: config.sources.execution_guidance },
    { field: 'sources.validation', path: config.sources.validation },
  ];

  for (const { field, path } of checks) {
    const abs = join(projectRoot, path);
    if (!existsSync(abs)) {
      errors.push({
        field,
        message: `artifact not found: ${path} [${field}]`,
        fix: `Create the file at '${path}' or update '${field}' in raes.config.yaml to point to an existing file`,
      });
    }
  }

  return errors;
}

export function checkConfig(
  projectRoot: string,
): { errors: ConfigError[]; config?: RaesConfig } {
  const configPath = join(projectRoot, 'raes.config.yaml');

  if (!existsSync(configPath)) {
    return {
      errors: [
        {
          field: 'raes.config.yaml',
          message: `raes.config.yaml not found — expected at: ${configPath}`,
          fix: "Run 'raes init' or create raes.config.yaml in the project root",
        },
      ],
    };
  }

  let text: string;
  try {
    text = readFileSync(configPath, 'utf8');
  } catch (e) {
    return {
      errors: [
        {
          field: 'raes.config.yaml',
          message: `raes.config.yaml could not be read: ${String(e)}`,
          fix: 'Check file permissions for raes.config.yaml',
        },
      ],
    };
  }

  const parsed = parseYaml(text);
  const { config, errors: schemaErrors } = extractConfig(parsed);

  if (schemaErrors.length > 0) return { errors: schemaErrors };
  if (!config) {
    return {
      errors: [{ field: 'raes.config.yaml', message: 'failed to parse config' }],
    };
  }

  const pathErrors = validatePaths(config, projectRoot);
  if (pathErrors.length > 0) return { errors: pathErrors };

  return { errors: [], config };
}
