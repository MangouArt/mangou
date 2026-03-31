#!/usr/bin/env node
import path from 'path';

function resolveWebOrigin() {
  if (process.env.MANGOU_WEB_ORIGIN) return process.env.MANGOU_WEB_ORIGIN;
  const port = process.env.MANGOU_WEB_PORT || '3000';
  return `http://127.0.0.1:${port}`;
}

function inferProjectIdFromCwd() {
  const cwd = path.resolve(process.cwd());
  const marker = `${path.sep}projects${path.sep}`;
  const index = cwd.lastIndexOf(marker);
  if (index === -1) return null;
  const rest = cwd.slice(index + marker.length);
  const [projectId] = rest.split(path.sep);
  return projectId || null;
}

async function main() {
  const [projectIdArg] = process.argv.slice(2);
  const projectId = projectIdArg || inferProjectIdFromCwd();

  if (!projectId) {
    console.error('Usage: node agent-stitch.mjs <projectId?> (or run inside <projectId>/)');
    process.exit(1);
  }

  const response = await fetch(`${resolveWebOrigin()}/api/projects/${projectId}/stitch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${errorText}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Stitch failed');
  }

  console.log(JSON.stringify({ success: true, url: result.url || '' }, null, 2));
}

main().catch((error) => {
  console.error('[mangou] Stitch Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
