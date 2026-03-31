import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { configStore } from '@/lib/config-store';
import type { TaskStatus, TaskEvent, TaskSnapshot } from '@/types/tasks';

export type { TaskStatus, TaskEvent, TaskSnapshot };

const TASKS_FILE = 'tasks.jsonl';
const LOCK_FILE = 'tasks.jsonl.lock';
const MAX_STRING_LENGTH = 4096;

function resolveAppRoot(): string {
  const envRoot = process.env.MANGOU_HOME;
  if (envRoot && envRoot.trim()) {
    return path.resolve(envRoot.trim());
  }
  return process.cwd();
}

function getWorkspaceRoot(): string {
  const workspaceDir = configStore.get('workspaceDir');
  return path.resolve(resolveAppRoot(), workspaceDir);
}

function getProjectRoot(projectId: string): string {
  return path.join(getWorkspaceRoot(), projectId);
}

function getTasksFilePath(projectId: string): string {
  return path.join(getProjectRoot(projectId), TASKS_FILE);
}

function getLockFilePath(projectId: string): string {
  return path.join(getProjectRoot(projectId), LOCK_FILE);
}

async function ensureTasksFile(projectId: string): Promise<void> {
  const projectRoot = getProjectRoot(projectId);
  await fs.mkdir(projectRoot, { recursive: true });
  const tasksPath = getTasksFilePath(projectId);
  try {
    await fs.access(tasksPath);
  } catch {
    await fs.writeFile(tasksPath, '', 'utf-8');
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function sanitizeTaskValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeTaskValue(item)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, sanitizeTaskValue(nested)])
    ) as T;
  }
  if (typeof value !== 'string') {
    return value;
  }

  const dataUrlMatch = value.match(/^data:([^;,]+);base64,/);
  if (dataUrlMatch) {
    return `[omitted data-url ${dataUrlMatch[1]}]` as T;
  }

  if (value.length > MAX_STRING_LENGTH) {
    return `${value.slice(0, MAX_STRING_LENGTH)}...[truncated ${value.length - MAX_STRING_LENGTH} chars]` as T;
  }

  return value;
}

function computeTaskId(event: TaskEvent): string {
  const payload = {
    type: event.type,
    provider: event.provider,
    input: event.input ?? {},
    ref: event.ref ?? '',
  };
  const hash = crypto.createHash('sha1').update(stableStringify(payload)).digest('hex');
  return `task_${hash}`;
}

async function withFileLock<T>(
  lockPath: string,
  action: () => Promise<T>,
  retries = 10,
  delayMs = 50
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let handle: fs.FileHandle | null = null;
    try {
      handle = await fs.open(lockPath, 'wx');
      const result = await action();
      await handle.close();
      await fs.unlink(lockPath).catch(() => null);
      return result;
    } catch (error: any) {
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

function normalizeEvent(input: TaskEvent): TaskEvent {
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

function parseLine(line: string): TaskEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as TaskEvent;
  } catch {
    return null;
  }
}

async function readAllEvents(projectId: string): Promise<TaskEvent[]> {
  const tasksPath = getTasksFilePath(projectId);
  try {
    const content = await fs.readFile(tasksPath, 'utf-8');
    return content
      .split('\n')
      .map(parseLine)
      .filter((event): event is TaskEvent => !!event);
  } catch {
    return [];
  }
}

function toSnapshot(event: TaskEvent): TaskSnapshot {
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

export async function appendTaskEvent(projectId: string, input: TaskEvent): Promise<TaskSnapshot> {
  await ensureTasksFile(projectId);
  const lockPath = getLockFilePath(projectId);

  return withFileLock(lockPath, async () => {
    const normalized = normalizeEvent(input);
    normalized.id = normalized.id || computeTaskId(normalized);

    const existing = await getTaskById(projectId, normalized.id);
    if (existing && (normalized.status === 'pending' || normalized.status === 'submitted')) {
      throw new Error(`Task already exists: ${normalized.id}`);
    }

    const tasksPath = getTasksFilePath(projectId);
    await fs.appendFile(tasksPath, `${JSON.stringify(normalized)}\n`, 'utf-8');
    return toSnapshot(normalized);
  });
}

export async function listTaskEvents(projectId: string): Promise<TaskEvent[]> {
  await ensureTasksFile(projectId);
  return readAllEvents(projectId);
}

export async function listLatestTasks(projectId: string): Promise<TaskSnapshot[]> {
  const events = await listTaskEvents(projectId);
  const latest = new Map<string, TaskSnapshot>();
  for (const event of events) {
    const id = event.id || computeTaskId(event);
    latest.set(id, toSnapshot({ ...event, id }));
  }
  return Array.from(latest.values()).sort((a, b) => {
    const at = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bt = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bt - at;
  });
}

export async function getTaskById(projectId: string, id: string): Promise<TaskSnapshot | null> {
  if (!id) return null;
  const events = await listTaskEvents(projectId);
  let latest: TaskSnapshot | null = null;
  for (const event of events) {
    const eventId = event.id || computeTaskId(event);
    if (eventId === id) {
      latest = toSnapshot({ ...event, id: eventId });
    }
  }
  return latest;
}
