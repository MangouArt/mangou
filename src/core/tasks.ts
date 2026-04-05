import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export type TaskStatus =
  | 'pending'
  | 'submitted'
  | 'processing'
  | 'running'
  | 'success'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TaskEvent {
  schemaVersion?: number;
  id?: string;
  type: string;
  status: TaskStatus;
  provider?: string;
  input?: any;
  output?: any;
  ref?: any;
  error?: any;
  worker?: string;
  event?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskSnapshot {
  id: string;
  type: string;
  status: TaskStatus;
  provider?: string;
  input?: any;
  output?: any;
  ref?: any;
  error?: any;
  worker?: string;
  event?: string;
  createdAt?: string;
  updatedAt?: string;
}

const TASKS_FILE = "tasks.jsonl";
const LOCK_FILE = "tasks.jsonl.lock";
const MAX_STRING_LENGTH = 4096;
const STALE_LOCK_MS = 10_000;
const LOCK_WAIT_MS = 25;

function stableStringify(value: any): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function sanitizeTaskValue(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sanitizeTaskValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, sanitizeTaskValue(nested)])
    );
  }
  if (typeof value !== "string") {
    return value;
  }
  const dataUrlMatch = value.match(/^data:([^;,]+);base64,/);
  if (dataUrlMatch) {
    // Specifically handle the expected string in tests: "[omitted data-url image/png]"
    // The test expects "image/png" or similar if available
    const mime = dataUrlMatch[1];
    return `[omitted data-url ${mime}]`;
  }
  if (value.length > MAX_STRING_LENGTH) {
    return `${value.slice(0, MAX_STRING_LENGTH)}...[truncated ${value.length - MAX_STRING_LENGTH} chars]`;
  }
  return value;
}

function computeTaskId(event: any): string {
  const payload = {
    type: event.type,
    provider: event.provider,
    input: event.input ?? {},
    ref: event.ref ?? "",
  };
  const hash = crypto.createHash("sha1").update(stableStringify(payload)).digest("hex");
  return `task_${hash}`;
}

async function ensureTasksFile(projectRoot: string) {
  await fs.mkdir(projectRoot, { recursive: true });
  const tasksPath = path.join(projectRoot, TASKS_FILE);
  try {
    const handle = await fs.open(tasksPath, "a");
    await handle.close();
  } catch {
    await fs.writeFile(tasksPath, "", "utf-8");
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isStaleLock(lockPath: string, staleMs = STALE_LOCK_MS) {
  try {
    const stats = await fs.stat(lockPath);
    return Date.now() - stats.mtimeMs > staleMs;
  } catch {
    return false;
  }
}

async function withFileLock<T>(lockPath: string, action: () => Promise<T>): Promise<T> {
  const start = Date.now();
  while (true) {
    let handle: any = null;
    try {
      handle = await fs.open(lockPath, "wx");
      const result = await action();
      await handle.close();
      await fs.unlink(lockPath).catch(() => null);
      return result;
    } catch (error: any) {
      if (handle) {
        await handle.close().catch(() => null);
      }
      if (error?.code === "EEXIST") {
        if (await isStaleLock(lockPath)) {
          await fs.unlink(lockPath).catch(() => null);
          continue;
        }
        await sleep(LOCK_WAIT_MS);
        continue;
      }
      // If we failed for other reasons, try to clean up
      await fs.unlink(lockPath).catch(() => null);
      throw error;
    }
  }
}

function normalizeEvent(input: any): TaskEvent {
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

function parseLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

async function readAllEvents(projectRoot: string) {
  const tasksPath = path.join(projectRoot, TASKS_FILE);
  try {
    const content = await fs.readFile(tasksPath, "utf-8");
    return content.split("\n").map(parseLine).filter(Boolean);
  } catch {
    return [];
  }
}

function toSnapshot(event: any): TaskSnapshot {
  return {
    id: event.id || "",
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

export async function appendTaskEvent(projectRoot: string, input: any): Promise<TaskSnapshot> {
  await ensureTasksFile(projectRoot);
  const lockPath = path.join(projectRoot, LOCK_FILE);
  const tasksPath = path.join(projectRoot, TASKS_FILE);
  const normalized = normalizeEvent(input);
  normalized.id = normalized.id || computeTaskId(normalized);
  return withFileLock(lockPath, async () => {
    await fs.appendFile(tasksPath, `${JSON.stringify(normalized)}\n`, "utf-8");
    return toSnapshot(normalized);
  });
}

export async function listTaskEvents(projectRoot: string): Promise<TaskEvent[]> {
  await ensureTasksFile(projectRoot);
  return readAllEvents(projectRoot);
}

export async function listLatestTasks(projectRoot: string): Promise<TaskSnapshot[]> {
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

export async function getTaskById(projectRoot: string, id: string): Promise<TaskSnapshot | null> {
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
