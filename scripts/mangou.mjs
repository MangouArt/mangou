#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createProject,
  getWebStatus,
  initWorkspace,
  startWebServer,
  stopWebServer,
} from './web-control.mjs';

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function parseFlagValue(argv, index) {
  const next = argv[index + 1];
  if (!next || next.startsWith('--')) {
    return { value: true, nextIndex: index };
  }
  return { value: next, nextIndex: index + 1 };
}

export function parseCliArgs(argv) {
  const flags = {};
  const rawPositionals = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = toCamelCase(token.slice(2));
      const { value, nextIndex } = parseFlagValue(argv, i);
      flags[key] = value;
      i = nextIndex;
      continue;
    }
    rawPositionals.push(token);
  }

  if (rawPositionals.length === 0) {
    return { commandPath: [], positionals: [], flags };
  }

  const aliasMap = {
    'init-workspace': ['workspace', 'init'],
    'create-project': ['project', 'create'],
    'start-web': ['web', 'start'],
    'stop-web': ['web', 'stop'],
    'web-status': ['web', 'status'],
  };

  const alias = aliasMap[rawPositionals[0]];
  if (alias) {
    return {
      commandPath: alias,
      positionals: rawPositionals.slice(1),
      flags,
    };
  }

  const [first, second] = rawPositionals;
  if (['workspace', 'project', 'web', 'generate', 'grid'].includes(first) && second) {
    return {
      commandPath: [first, second],
      positionals: rawPositionals.slice(2),
      flags,
    };
  }

  if (first === 'stitch') {
    return {
      commandPath: ['stitch'],
      positionals: rawPositionals.slice(1),
      flags,
    };
  }

  return {
    commandPath: [first],
    positionals: rawPositionals.slice(1),
    flags,
  };
}

function commandUsage(commandPath = []) {
  const key = commandPath.join(' ');
  switch (key) {
    case 'workspace init':
      return 'Usage: mangou workspace init [--workspace <path>] [--json] [--verbose]';
    case 'project create':
      return 'Usage: mangou project create --project <id> [--workspace <path>] [--name <name>] [--description <text>]';
    case 'project scaffold':
      return 'Usage: mangou project scaffold --grid <masterYaml> [--workspace <path>] [--project-root <path>]';
    case 'web start':
      return 'Usage: mangou web start [--workspace <path>] [--port <number>] [--json] [--verbose]';
    case 'web stop':
      return 'Usage: mangou web stop [--workspace <path>] [--json] [--verbose]';
    case 'web status':
      return 'Usage: mangou web status [--workspace <path>] [--json] [--verbose]';
    case 'generate image':
      return 'Usage: mangou generate image <yaml> [--workspace <path>] [--project <path>] [--provider <id>] [--debug]';
    case 'generate video':
      return 'Usage: mangou generate video <yaml> [--workspace <path>] [--project <path>] [--provider <id>] [--debug]';
    case 'stitch':
      return 'Usage: mangou stitch [projectRoot] [--output <filename>] [--json] [--verbose]';
    case 'grid split':
      return 'Usage: mangou grid split <parentYaml> [--grid NxM] [--targets yaml1,yaml2] [--project-root <path>] [--workspace-root <path>]';
    default:
      return [
        'Usage:',
        '  mangou workspace init',
        '  mangou project create --project <id>',
        '  mangou project scaffold --grid <masterYaml>',
        '  mangou web start|stop|status',
        '  mangou generate image|video <yaml>',
        '  mangou stitch [projectRoot]',
        '  mangou grid split <parentYaml>',
      ].join('\n');
  }
}

function usageError(commandPath = []) {
  return new Error(commandUsage(commandPath));
}

function resolveWorkspaceRoot(flags, positionals) {
  return String(flags.workspace || positionals[0] || process.cwd());
}

function parsePort(value) {
  if (value == null || value === '') return undefined;
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('Usage: mangou web start [--workspace <path>] [--port <number>] [--json] [--verbose]');
  }
  return port;
}

export async function dispatchCliCommand(parsed, handlers) {
  const { commandPath, positionals, flags } = parsed;
  const key = commandPath.join(' ');
  const json = Boolean(flags.json);
  const verbose = Boolean(flags.verbose);

  switch (key) {
    case 'workspace init':
      return handlers.initWorkspace({
        workspaceRoot: resolveWorkspaceRoot(flags, positionals),
        json,
        verbose,
      });
    case 'project create': {
      const projectId = String(flags.project || positionals[0] || '').trim();
      if (!projectId) throw usageError(commandPath);
      return handlers.createProject({
        workspaceRoot: String(flags.workspace || process.cwd()),
        projectId,
        name: String(flags.name || projectId),
        description: String(flags.description || ''),
        json,
        verbose,
      });
    }
    case 'project scaffold': {
      const gridYamlPath = String(flags.grid || '').trim();
      if (!gridYamlPath) throw usageError(commandPath);
      return handlers.scaffoldProject({
        workspaceRoot: String(flags.workspace || process.cwd()),
        projectRoot: String(flags.projectRoot || ''),
        gridYamlPath,
        json,
        verbose,
      });
    }
    case 'web start':
      return handlers.startWeb({
        workspaceRoot: resolveWorkspaceRoot(flags, positionals),
        port: parsePort(flags.port) ?? Number(process.env.MANGOU_WEB_PORT || '3000'),
        json,
        verbose,
      });
    case 'web stop':
      return handlers.stopWeb({
        workspaceRoot: resolveWorkspaceRoot(flags, positionals),
        json,
        verbose,
      });
    case 'web status':
      return handlers.webStatus({
        workspaceRoot: resolveWorkspaceRoot(flags, positionals),
        json,
        verbose,
      });
    case 'generate image':
    case 'generate video': {
      const type = commandPath[1];
      const yamlPath = positionals[0];
      if (!yamlPath) throw usageError(commandPath);
      const argv = [yamlPath, type];
      if (flags.workspace) argv.push('--workspace', String(flags.workspace));
      if (flags.project) argv.push('--project', String(flags.project));
      if (flags.provider) argv.push('--provider', String(flags.provider));
      if (flags.debug) argv.push('--debug');
      return handlers.generate({
        type,
        yamlPath,
        argv,
        json,
        verbose,
      });
    }
    case 'stitch': {
      const projectRoot = positionals[0] ? path.resolve(String(positionals[0])) : '';
      return handlers.stitch({
        projectRoot,
        outputName: flags.output ? String(flags.output) : undefined,
        json,
        verbose,
      });
    }
    case 'grid split': {
      const parentYaml = positionals[0];
      if (!parentYaml) throw usageError(commandPath);
      const argv = [parentYaml];
      if (flags.grid) argv.push('--grid', String(flags.grid));
      if (flags.targets) argv.push('--targets', String(flags.targets));
      if (flags.projectRoot) argv.push('--project-root', String(flags.projectRoot));
      if (flags.workspaceRoot) argv.push('--workspace-root', String(flags.workspaceRoot));
      return handlers.splitGrid({
        parentYaml,
        argv,
        json,
        verbose,
      });
    }
    default:
      throw usageError(commandPath);
  }
}

export function createDefaultHandlers() {
  return {
    initWorkspace: ({ workspaceRoot }) => initWorkspace({ workspaceRoot }),
    createProject: ({ workspaceRoot, projectId, name, description }) =>
      createProject({ workspaceRoot, projectId, name, description }),
    scaffoldProject: async ({ workspaceRoot, projectRoot, gridYamlPath }) => {
      const { scaffoldGridChildren } = await import('./project-scaffold.mjs');
      return scaffoldGridChildren({ workspaceRoot, projectRoot, gridYamlPath });
    },
    startWeb: ({ workspaceRoot, port }) => startWebServer({ workspaceRoot, port }),
    stopWeb: ({ workspaceRoot }) => stopWebServer({ workspaceRoot }),
    webStatus: ({ workspaceRoot }) => getWebStatus({ workspaceRoot }),
    generate: async ({ argv }) => {
      const { runAIGC } = await import('./agent-generate.mjs');
      return runAIGC(undefined, argv);
    },
    stitch: async ({ projectRoot, outputName }) => {
      const { inferProjectRootFromCwd, stitch } = await import('./agent-stitch.mjs');
      const resolvedProjectRoot = projectRoot || inferProjectRootFromCwd();
      if (!resolvedProjectRoot) {
        throw usageError(['stitch']);
      }
      const outputPath = await stitch(resolvedProjectRoot, outputName);
      return { path: outputPath, url: outputPath };
    },
    splitGrid: async ({ argv }) => {
      const { runSplitGrid } = await import('./split-grid.mjs');
      return runSplitGrid(argv);
    },
  };
}

function formatSuccess(result, json) {
  if (json) {
    return JSON.stringify(
      result === undefined ? { success: true } : { success: true, data: result },
      null,
      2
    );
  }
  if (typeof result === 'string') return result;
  if (result === undefined) return 'success';
  return JSON.stringify({ success: true, data: result }, null, 2);
}

function formatError(error, json) {
  const message = error instanceof Error ? error.message : String(error);
  if (json) {
    return JSON.stringify({ success: false, error: message }, null, 2);
  }
  return message;
}

export async function main(argv = process.argv.slice(2), handlers = createDefaultHandlers()) {
  const parsed = parseCliArgs(argv);
  try {
    const result = await dispatchCliCommand(parsed, handlers);
    console.log(formatSuccess(result, Boolean(parsed.flags.json)));
    return result;
  } catch (error) {
    console.error(formatError(error, Boolean(parsed.flags.json)));
    process.exitCode = 1;
    throw error;
  }
}

const isEntrypoint =
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  main().catch(() => {});
}
