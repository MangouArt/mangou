#!/usr/bin/env node
import { initWorkspace } from './web-control.mjs';

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return '';
  return process.argv[index + 1] || '';
}

const workspaceRoot = getArgValue('--workspace') || process.argv[2] || process.cwd();

initWorkspace({ workspaceRoot })
  .then((result) => {
    console.log(JSON.stringify({ success: true, ...result }));
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
