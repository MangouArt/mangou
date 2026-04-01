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
});
