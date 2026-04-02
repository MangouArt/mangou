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
});
