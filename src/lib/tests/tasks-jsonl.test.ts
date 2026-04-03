import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { appendTaskEvent, listLatestTasks, getTaskById } from '../../../scripts/tasks-jsonl.mjs';

describe('scripts/tasks-jsonl.mjs', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-tasks-test-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('crud lifecycle for tasks', async () => {
    const task1Id = 'task-1';
    
    // 1. Create a task
    await appendTaskEvent(tempDir, {
      id: task1Id,
      type: 'image',
      status: 'pending',
      input: { prompt: 'A cat' }
    });

    // 2. Update the task
    await appendTaskEvent(tempDir, {
      id: task1Id,
      status: 'processing',
      worker: 'worker-1'
    });

    // 3. Complete the task
    await appendTaskEvent(tempDir, {
      id: task1Id,
      status: 'success',
      output: 'cat.png'
    });

    // 4. Create another task
    await appendTaskEvent(tempDir, {
      id: 'task-2',
      type: 'video',
      status: 'pending'
    });

    // 5. List latest tasks
    const tasks = await listLatestTasks(tempDir);
    expect(tasks.length).toBe(2);
    
    const t1 = tasks.find(t => t.id === 'task-1');
    expect(t1.status).toBe('success');
    expect(t1.output).toBe('cat.png');
    
    // 6. Get by ID
    const retrievedT1 = await getTaskById(tempDir, 'task-1');
    expect(retrievedT1?.status).toBe('success');
  });

  it('handles concurrent writes with file lock', async () => {
    const promises = Array.from({ length: 10 }).map((_, i) => 
      appendTaskEvent(tempDir, { id: `task-${i}`, status: 'pending' })
    );

    await Promise.all(promises);
    
    const tasks = await listLatestTasks(tempDir);
    expect(tasks.length).toBe(10);
  });

  it('waits through transient lock contention and still appends the event', async () => {
    await fs.writeFile(path.join(tempDir, 'tasks.jsonl.lock'), 'busy', 'utf-8');
    setTimeout(() => {
      fs.rm(path.join(tempDir, 'tasks.jsonl.lock'), { force: true }).catch(() => null);
    }, 650);

    await expect(
      appendTaskEvent(tempDir, {
        id: 'task-after-lock',
        status: 'processing',
      }),
    ).resolves.toMatchObject({ id: 'task-after-lock', status: 'processing' });

    const latest = await getTaskById(tempDir, 'task-after-lock');
    expect(latest?.status).toBe('processing');
  });

  it('keeps appendTaskEvent append-only and does not reject repeated pending events', async () => {
    await appendTaskEvent(tempDir, {
      id: 'task-repeat',
      type: 'image',
      status: 'pending',
      input: { prompt: 'first' },
    });

    await expect(
      appendTaskEvent(tempDir, {
        id: 'task-repeat',
        type: 'image',
        status: 'pending',
        input: { prompt: 'second' },
      }),
    ).resolves.toMatchObject({ id: 'task-repeat', status: 'pending' });

    const raw = await fs.readFile(path.join(tempDir, 'tasks.jsonl'), 'utf-8');
    const lines = raw.trim().split('\n');
    expect(lines).toHaveLength(2);
  });

  it('cleans stale lock files before appending', async () => {
    const lockPath = path.join(tempDir, 'tasks.jsonl.lock');
    await fs.writeFile(lockPath, 'stale', 'utf-8');
    const staleTime = new Date(Date.now() - 20_000);
    await fs.utimes(lockPath, staleTime, staleTime);

    await expect(
      appendTaskEvent(tempDir, {
        id: 'task-after-stale-lock',
        status: 'processing',
      }),
    ).resolves.toMatchObject({ id: 'task-after-stale-lock', status: 'processing' });

    const latest = await getTaskById(tempDir, 'task-after-stale-lock');
    expect(latest?.status).toBe('processing');
  });

  it('blocks until a non-stale lock is released instead of failing after a retry limit', async () => {
    const lockPath = path.join(tempDir, 'tasks.jsonl.lock');
    await fs.writeFile(lockPath, 'busy', 'utf-8');

    setTimeout(() => {
      fs.rm(lockPath, { force: true }).catch(() => null);
    }, 2_000);

    await expect(
      appendTaskEvent(tempDir, {
        id: 'task-after-long-lock',
        status: 'success',
      }),
    ).resolves.toMatchObject({ id: 'task-after-long-lock', status: 'success' });

    const latest = await getTaskById(tempDir, 'task-after-long-lock');
    expect(latest?.status).toBe('success');
  });
});
