#!/usr/bin/env node
import { getWebStatus } from './web-control.mjs';

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return '';
  return process.argv[index + 1] || '';
}

const workspaceRoot = getArgValue('--workspace') || process.argv[2] || process.cwd();

getWebStatus({ workspaceRoot })
  .then((result) => {
    console.log(JSON.stringify({ success: true, ...result }));
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
