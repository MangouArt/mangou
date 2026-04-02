import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const TASKS_FILE = 'tasks.jsonl';
const LOCK_FILE = 'tasks.jsonl.lock';
const MAX_STRING_LENGTH = 4096;

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function sanitizeTaskValue(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeTaskValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, sanitizeTaskValue(nested)])
    );
  }
  if (typeof value !== 'string') {
    return value;
  }

  const dataUrlMatch = value.match(/^data:([^;,]+);base64,/);
  if (dataUrlMatch) {
    return `[omitted data-url ${dataUrlMatch[1]}]`;
  }

  if (value.length > MAX_STRING_LENGTH) {
    return `${value.slice(0, MAX_STRING_LENGTH)}...[truncated ${value.length - MAX_STRING_LENGTH} chars]`;
  }

  return value;
}

function computeTaskId(event) {
  const payload = {
    type: event.type,
    provider: event.provider,
    input: event.input ?? {},
    ref: event.ref ?? '',
  };
  const hash = crypto.createHash('sha1').update(stableStringify(payload)).digest('hex');
  return `task_${hash}`;
}

async function ensureTasksFile(projectRoot) {
  await fs.mkdir(projectRoot, { recursive: true });
  const tasksPath = path.join(projectRoot, TASKS_FILE);
  try {
    await fs.access(tasksPath);
  } catch {
    await fs.writeFile(tasksPath, '', 'utf-8');
  }
}

async function withFileLock(lockPath, action, retries = 10, delayMs = 50) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let handle = null;
    try {
      handle = await fs.open(lockPath, 'wx');
      const result = await action();
      await handle.close();
      await fs.unlink(lockPath).catch(() => null);
      return result;
    } catch (error) {
      if (handle) {
        await handle.close().catch(() => null);
      }
      if (error?.code === 'EEXIST') {
        if (attempt >= retries) {
          throw new Error('Failed to acquire tasks.jsonl lock');
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      await fs.unlink(lockPath).catch(() => null);
      throw error;
    }
  }
  throw new Error('Failed to acquire tasks.jsonl lock');
}

function normalizeEvent(input) {
  const now = new Date().toISOString();
  return {
    schemaVersion: input.schemaVersion ?? 1,
    id: input.id,
    type: input.type,
    status: input.status,
    provider: input.provider,
    input: sanitizeTaskValue(input.input),
    output: sanitizeTaskValue(input.output),
    ref: input.ref,
    error: sanitizeTaskValue(input.error),
    worker: input.worker,
    event: input.event,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
}

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

async function readAllEvents(projectRoot) {
  const tasksPath = path.join(projectRoot, TASKS_FILE);
  try {
    const content = await fs.readFile(tasksPath, 'utf-8');
    return content
      .split('\n')
      .map(parseLine)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function toSnapshot(event) {
  return {
    id: event.id || '',
    type: event.type,
    status: event.status,
    provider: event.provider,
    input: event.input,
    output: event.output,
    ref: event.ref,
    error: event.error,
    worker: event.worker,
    event: event.event,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

export async function appendTaskEvent(projectRoot, input) {
  await ensureTasksFile(projectRoot);
  const lockPath = path.join(projectRoot, LOCK_FILE);

  return withFileLock(lockPath, async () => {
    const normalized = normalizeEvent(input);
    normalized.id = normalized.id || computeTaskId(normalized);

    const existing = await getTaskById(projectRoot, normalized.id);
    if (existing && (normalized.status === 'pending' || normalized.status === 'submitted')) {
      throw new Error(`Task already exists: ${normalized.id}`);
    }

    const tasksPath = path.join(projectRoot, TASKS_FILE);
    await fs.appendFile(tasksPath, `${JSON.stringify(normalized)}\n`, 'utf-8');
    return toSnapshot(normalized);
  });
}

export async function listTaskEvents(projectRoot) {
  await ensureTasksFile(projectRoot);
  return readAllEvents(projectRoot);
}

export async function listLatestTasks(projectRoot) {
  const events = await listTaskEvents(projectRoot);
  const latest = new Map();
  for (const event of events) {
    const id = event.id || computeTaskId(event);
    if (!id) continue;
    latest.set(id, toSnapshot({ ...event, id }));
  }
  return Array.from(latest.values()).sort((a, b) => {
    const at = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bt = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bt - at;
  });
}

export async function getTaskById(projectRoot, id) {
  if (!id) return null;
  const events = await listTaskEvents(projectRoot);
  let latest = null;
  for (const event of events) {
    const eventId = event.id || computeTaskId(event);
    if (eventId === id) {
      latest = toSnapshot({ ...event, id: eventId });
    }
  }
  return latest;
}
