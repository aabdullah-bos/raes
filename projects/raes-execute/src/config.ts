import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

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
  provider: {
    name: 'anthropic' | 'openai';
    model?: string;
    openai?: {
      transport: 'exec' | 'app_server';
    };
    sandbox?: {
      write_access?: boolean;
    };
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

function resolveConfigProjectRoot(projectRoot: string, configPathOverride?: string): {
  configPath: string;
  projectRoot: string;
} {
  const configPath = configPathOverride !== undefined
    ? resolve(projectRoot, configPathOverride)
    : join(projectRoot, 'raes.config.yaml');

  if (configPathOverride === undefined) {
    return { configPath, projectRoot };
  }

  const configDir = dirname(configPath);
  const legacyConfigName = join('docs', 'raes.config.yaml');
  const normalizedSuffix = configPath.endsWith(legacyConfigName);
  return {
    configPath,
    projectRoot: normalizedSuffix ? dirname(configDir) : configDir,
  };
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

  const providerRaw = data['provider'];
  if (!isObject(providerRaw)) {
    errors.push({
      field: 'provider',
      message: "missing required section 'provider' — raes.config.yaml",
      fix: "Add a 'provider:' section with 'name: anthropic' or 'name: openai' to raes.config.yaml",
    });
  } else {
    const providerName = providerRaw['name'];
    if (!nonEmptyString(providerName)) {
      errors.push({
        field: 'provider.name',
        message: "missing or empty 'provider.name' — raes.config.yaml",
        fix: "Set 'provider.name' to 'anthropic' or 'openai' in raes.config.yaml",
      });
    } else if (providerName !== 'anthropic' && providerName !== 'openai') {
      errors.push({
        field: 'provider.name',
        message: `unknown provider '${providerName}' — raes.config.yaml`,
        fix: "Set 'provider.name' to one of: anthropic, openai",
      });
    } else if (providerName === 'openai') {
      const openaiRaw = providerRaw['openai'];
      if (openaiRaw !== undefined && !isObject(openaiRaw)) {
        errors.push({
          field: 'provider.openai',
          message: "invalid 'provider.openai' section — raes.config.yaml",
          fix: "Set 'provider.openai.transport' to 'exec' or 'app_server', or remove the 'openai:' block to use the default transport",
        });
      } else if (isObject(openaiRaw)) {
        const transport = openaiRaw['transport'];
        if (
          transport !== undefined &&
          transport !== 'exec' &&
          transport !== 'app_server'
        ) {
          errors.push({
            field: 'provider.openai.transport',
            message: `unknown OpenAI transport '${String(transport)}' — raes.config.yaml`,
            fix: "Set 'provider.openai.transport' to 'exec' or 'app_server'",
          });
        }
      }
    }
  }

  if (errors.length > 0) return { errors };

  const provider = data['provider'] as Record<string, unknown>;
  const sandboxRaw = provider['sandbox'];
  const openaiRaw = isObject(provider['openai'])
    ? provider['openai'] as Record<string, unknown>
    : undefined;
  const sandboxObj = isObject(sandboxRaw) ? (sandboxRaw as Record<string, unknown>) : undefined;
  let writeAccess: boolean | undefined;
  if (sandboxObj !== undefined) {
    const wa = sandboxObj['write_access'];
    if (wa === 'true' || wa === true) writeAccess = true;
    else if (wa === 'false' || wa === false) writeAccess = false;
  }

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
    provider: {
      name: provider['name'] as 'anthropic' | 'openai',
      ...(nonEmptyString(provider['model']) ? { model: provider['model'] as string } : {}),
      ...(
        provider['name'] === 'openai'
          ? {
              openai: {
                transport: (openaiRaw?.['transport'] as 'exec' | 'app_server' | undefined) ?? 'exec',
              },
            }
          : {}
      ),
      ...(sandboxObj !== undefined
        ? { sandbox: writeAccess !== undefined ? { write_access: writeAccess } : {} }
        : {}),
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
  configPathOverride?: string,
): { errors: ConfigError[]; config?: RaesConfig; projectRoot?: string; configPath?: string } {
  const { configPath, projectRoot: resolvedProjectRoot } = resolveConfigProjectRoot(
    projectRoot,
    configPathOverride,
  );

  if (!existsSync(configPath)) {
    return {
      errors: [
        {
          field: 'raes.config.yaml',
          message: `raes.config.yaml not found — expected at: ${configPath}`,
          fix: configPathOverride !== undefined
            ? "Pass a valid --config <path> pointing to a RAES project config file"
            : "Run from a RAES project root, pass --config <path>, or create raes.config.yaml in the project root",
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

  const pathErrors = validatePaths(config, resolvedProjectRoot);
  if (pathErrors.length > 0) return { errors: pathErrors };

  return { errors: [], config, projectRoot: resolvedProjectRoot, configPath };
}

// ---------------------------------------------------------------------------
// Workspace support (Option A)
// ---------------------------------------------------------------------------

export interface WorkspaceError {
  field: string;
  message: string;
  fix?: string;
}

export interface RaesWorkspace {
  projects: Record<string, { config: string }>;
  shared_sources: Record<string, string>;
}

export function extractWorkspace(
  data: Record<string, unknown>,
): { workspace?: RaesWorkspace; errors: WorkspaceError[] } {
  const errors: WorkspaceError[] = [];

  const projectsRaw = data['projects'];
  if (!isObject(projectsRaw)) {
    errors.push({
      field: 'projects',
      message: "missing required section 'projects' — raes.workspace.yaml",
      fix: "Add a 'projects:' section with at least one project entry, each with a 'config:' path",
    });
    return { errors };
  }

  const projects: Record<string, { config: string }> = {};
  for (const [name, entryRaw] of Object.entries(projectsRaw)) {
    if (!isObject(entryRaw)) {
      errors.push({
        field: `projects.${name}`,
        message: `project '${name}' must be an object with a 'config' key — raes.workspace.yaml`,
        fix: `Add 'config: <path/to/raes.config.yaml>' under 'projects.${name}:'`,
      });
      continue;
    }
    if (!nonEmptyString(entryRaw['config'])) {
      errors.push({
        field: `projects.${name}.config`,
        message: `missing or empty 'config' path for project '${name}' — raes.workspace.yaml`,
        fix: `Set 'config:' under 'projects.${name}:' to the relative path of that project's raes.config.yaml`,
      });
      continue;
    }
    projects[name] = { config: entryRaw['config'] };
  }

  if (errors.length > 0) return { errors };

  if (Object.keys(projects).length === 0) {
    errors.push({
      field: 'projects',
      message: "no projects defined — raes.workspace.yaml",
      fix: "Add at least one project entry under 'projects:' with a 'config:' path",
    });
    return { errors };
  }

  const sharedSourcesRaw = data['shared_sources'];
  const shared_sources: Record<string, string> = {};
  if (sharedSourcesRaw !== undefined) {
    if (!isObject(sharedSourcesRaw)) {
      errors.push({
        field: 'shared_sources',
        message: "invalid 'shared_sources' section — raes.workspace.yaml",
        fix: "Set 'shared_sources:' to a map of name: path entries, e.g. raes_reference: docs/raes-reference.md",
      });
    } else {
      for (const [name, pathRaw] of Object.entries(sharedSourcesRaw)) {
        if (!nonEmptyString(pathRaw)) {
          errors.push({
            field: `shared_sources.${name}`,
            message: `missing or empty path for shared source '${name}' — raes.workspace.yaml`,
            fix: `Set 'shared_sources.${name}:' to a non-empty file path relative to the workspace root`,
          });
        } else {
          shared_sources[name] = pathRaw;
        }
      }
    }
  }

  if (errors.length > 0) return { errors };

  return { workspace: { projects, shared_sources }, errors: [] };
}

export function checkWorkspace(
  cwd: string,
  workspacePath?: string,
): { workspace?: RaesWorkspace; workspaceRoot?: string; errors: WorkspaceError[] } {
  const wsPath = workspacePath !== undefined
    ? resolve(cwd, workspacePath)
    : join(cwd, 'raes.workspace.yaml');

  if (!existsSync(wsPath)) {
    return {
      errors: [{
        field: 'raes.workspace.yaml',
        message: `raes.workspace.yaml not found — expected at: ${wsPath}`,
        fix: workspacePath !== undefined
          ? "Pass a valid --workspace <path> pointing to a raes.workspace.yaml file"
          : "Create raes.workspace.yaml at the workspace root, or pass --workspace <path>",
      }],
    };
  }

  let text: string;
  try {
    text = readFileSync(wsPath, 'utf8');
  } catch (e) {
    return {
      errors: [{
        field: 'raes.workspace.yaml',
        message: `raes.workspace.yaml could not be read: ${String(e)}`,
        fix: 'Check file permissions for raes.workspace.yaml',
      }],
    };
  }

  const parsed = parseYaml(text);
  const { workspace, errors: schemaErrors } = extractWorkspace(parsed);
  if (schemaErrors.length > 0) return { errors: schemaErrors };
  if (!workspace) {
    return { errors: [{ field: 'raes.workspace.yaml', message: 'failed to parse workspace' }] };
  }

  const workspaceRoot = dirname(wsPath);

  const pathErrors: WorkspaceError[] = [];
  for (const [name, project] of Object.entries(workspace.projects)) {
    const abs = join(workspaceRoot, project.config);
    if (!existsSync(abs)) {
      pathErrors.push({
        field: `projects.${name}.config`,
        message: `project config not found: ${project.config} [projects.${name}]`,
        fix: `Create '${project.config}' or update 'projects.${name}.config' in raes.workspace.yaml`,
      });
    }
  }

  for (const [name, path] of Object.entries(workspace.shared_sources)) {
    const abs = join(workspaceRoot, path);
    if (!existsSync(abs)) {
      pathErrors.push({
        field: `shared_sources.${name}`,
        message: `shared source not found: ${path} [shared_sources.${name}]`,
        fix: `Create '${path}' or update 'shared_sources.${name}' in raes.workspace.yaml`,
      });
    }
  }

  if (pathErrors.length > 0) return { errors: pathErrors };

  return { workspace, workspaceRoot, errors: [] };
}

export function resolveProjectFromWorkspace(
  workspace: RaesWorkspace,
  workspaceRoot: string,
  projectName: string,
): { configPath?: string; error?: WorkspaceError } {
  const project = workspace.projects[projectName];
  if (!project) {
    const known = Object.keys(workspace.projects).join(', ');
    return {
      error: {
        field: `projects.${projectName}`,
        message: `project '${projectName}' not found in workspace — known projects: ${known}`,
        fix: `Use one of: ${known}; or add '${projectName}' to raes.workspace.yaml`,
      },
    };
  }
  return { configPath: join(workspaceRoot, project.config) };
}
