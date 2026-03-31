#!/usr/bin/env node
import { startWebServer } from './web-control.mjs';

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return '';
  return process.argv[index + 1] || '';
}

const workspaceRoot = getArgValue('--workspace') || process.argv[2] || process.cwd();
const port = Number(getArgValue('--port') || process.env.MANGOU_WEB_PORT || '3000');

startWebServer({ workspaceRoot, port })
  .then((result) => {
    console.log(JSON.stringify({ success: true, ...result }));
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
