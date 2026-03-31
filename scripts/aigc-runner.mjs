import path from 'path';
import { appendTaskEvent, listLatestTasks } from './tasks-jsonl.mjs';

function log(...args) {
  console.error('[aigc-runner]', ...args);
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function normalizeInput(input) {
  if (!input || typeof input !== 'object') return {};
  return input;
}

async function runTask(projectPath, task) {
  const input = normalizeInput(task.input);
  const endpoint = input.endpoint;
  const method = (input.method || 'POST').toUpperCase();
  const headers = input.headers || { 'content-type': 'application/json' };
  const payload = input.payload ?? input;

  await appendTaskEvent(projectPath, {
    id: task.id,
    type: task.type,
    status: 'processing',
    provider: task.provider || 'http-json',
    ref: task.ref,
    input: task.input,
    event: 'start',
  });

  if (!endpoint) {
    await appendTaskEvent(projectPath, {
      id: task.id,
      type: task.type,
      status: 'failed',
      provider: task.provider || 'http-json',
      ref: task.ref,
      input: task.input,
      error: 'Missing input.endpoint',
      event: 'failed',
    });
    return;
  }

  try {
    const response = await fetch(endpoint, {
      method,
      headers,
      body: method === 'GET' ? undefined : JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    let output = null;
    if (contentType.includes('application/json')) {
      const data = await response.json();
      output = data?.output || data?.url || data;
    } else {
      output = await response.text();
    }

    await appendTaskEvent(projectPath, {
      id: task.id,
      type: task.type,
      status: 'success',
      provider: task.provider || 'http-json',
      ref: task.ref,
      input: task.input,
      output,
      event: 'completed',
    });
  } catch (error) {
    await appendTaskEvent(projectPath, {
      id: task.id,
      type: task.type,
      status: 'failed',
      provider: task.provider || 'http-json',
      ref: task.ref,
      input: task.input,
      error: error instanceof Error ? error.message : String(error),
      event: 'failed',
    });
  }
}

async function main() {
  const projectArg = getArg('--project');
  if (!projectArg) {
    log('Usage: node scripts/aigc-runner.mjs --project <project-path>');
    process.exit(1);
  }

  const projectPath = path.resolve(projectArg);
  const tasks = await listLatestTasks(projectPath);
  const pending = tasks.filter((task) =>
    task.status === 'submitted' || task.status === 'pending'
  );

  if (pending.length === 0) {
    log('No pending tasks');
    return;
  }

  for (const task of pending) {
    await runTask(projectPath, task);
  }
}

main().catch((error) => {
  log('Runner failed:', error);
  process.exit(1);
});

