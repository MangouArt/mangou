import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let workspaceDir = '';

vi.mock('@/lib/config-store', () => ({
  configStore: {
    get: (key: string) => {
      if (key === 'workspaceDir') return workspaceDir;
      return undefined;
    },
  },
}));

import { appendTaskEvent, getTaskById, listLatestTasks } from './tasks-jsonl';

async function cleanup(dir: string) {
  if (!dir) return;
  await fs.rm(dir, { recursive: true, force: true });
}

describe('tasks-jsonl', () => {
  beforeEach(async () => {
    workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-workspace-'));
  });

  afterEach(async () => {
    await cleanup(workspaceDir);
    workspaceDir = '';
    vi.useRealTimers();
  });

  it('appends task event and returns snapshot', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    const snapshot = await appendTaskEvent('demo', {
      type: 'storyboard.generate',
      status: 'submitted',
      provider: 'mock',
      input: { prompt: 'hello' },
    });

    expect(snapshot.id).toMatch(/^task_[a-f0-9]{40}$/);
    expect(snapshot.status).toBe('submitted');

    const tasksPath = path.join(workspaceDir, 'demo', 'tasks.jsonl');
    const content = await fs.readFile(tasksPath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(1);
  });

  it('rejects duplicate pending/submitted but allows later updates', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    const first = await appendTaskEvent('demo', {
      type: 'asset.generate',
      status: 'pending',
      provider: 'mock',
      input: { prompt: 'hero' },
    });

    await expect(
      appendTaskEvent('demo', {
        type: 'asset.generate',
        status: 'submitted',
        provider: 'mock',
        input: { prompt: 'hero' },
      })
    ).rejects.toThrow('Task already exists');

    vi.setSystemTime(new Date('2024-01-01T00:01:00.000Z'));

    const updated = await appendTaskEvent('demo', {
      id: first.id,
      type: 'asset.generate',
      status: 'processing',
      provider: 'mock',
      input: { prompt: 'hero' },
    });

    expect(updated.status).toBe('processing');
    const latest = await getTaskById('demo', first.id);
    expect(latest?.status).toBe('processing');
  });

  it('returns latest tasks ordered by updatedAt', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    const taskA = await appendTaskEvent('demo', {
      type: 'storyboard.generate',
      status: 'submitted',
      provider: 'mock',
      input: { prompt: 'scene-a' },
    });

    vi.setSystemTime(new Date('2024-01-01T00:02:00.000Z'));

    const taskB = await appendTaskEvent('demo', {
      type: 'storyboard.generate',
      status: 'submitted',
      provider: 'mock',
      input: { prompt: 'scene-b' },
    });

    vi.setSystemTime(new Date('2024-01-01T00:03:00.000Z'));

    await appendTaskEvent('demo', {
      id: taskA.id,
      type: 'storyboard.generate',
      status: 'success',
      provider: 'mock',
      input: { prompt: 'scene-a' },
      output: { url: 'https://example.com/a.png' },
    });

    const latest = await listLatestTasks('demo');
    expect(latest[0]?.id).toBe(taskA.id);
    expect(latest[0]?.status).toBe('success');
    expect(latest[1]?.id).toBe(taskB.id);
  });
});
