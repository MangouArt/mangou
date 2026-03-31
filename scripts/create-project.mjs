#!/usr/bin/env node
import { createProject } from './web-control.mjs';

export function parseArgs(argv) {
  const args = {
    workspace: '.',
    project: '',
    name: '',
    description: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--workspace' && argv[i + 1]) {
      args.workspace = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--project' && argv[i + 1]) {
      args.project = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--name' && argv[i + 1]) {
      args.name = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--description' && argv[i + 1]) {
      args.description = argv[i + 1];
      i += 1;
      continue;
    }
  }

  return args;
}

const { workspace, project, name, description } = parseArgs(process.argv.slice(2));
const workspaceRoot = workspace || process.cwd();
const projectId = project || '';
const projectName = name || projectId || 'new-project';

createProject({ workspaceRoot, projectId, name: projectName, description })
  .then((result) => {
    console.log(JSON.stringify({ success: true, data: result }, null, 2));
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
