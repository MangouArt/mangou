import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  materializeOutputs,
  resolveResumeTaskId,
  updateYamlProjection,
} from '../../../scripts/agent-generate.mjs';

describe('agent-generate output materialization', () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('downloads remote outputs into project assets directory', async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-agent-output-'));
    tempDirs.push(projectRoot);

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => Uint8Array.from([0, 1, 2, 3]).buffer,
    } as Response);

    const outputs = await materializeOutputs(
      projectRoot,
      'storyboards/scene-001.yaml',
      'video',
      '12345678-abcd',
      ['https://cdn.example.com/output.mp4']
    );

    expect(outputs).toEqual(['assets/videos/scene-001-12345678-0.mp4']);
    await expect(fs.readFile(path.join(projectRoot, outputs[0]))).resolves.toBeTruthy();
  });


  it('resumes polling from existing latest.task_id when previous run did not succeed', () => {
    expect(
      resolveResumeTaskId({
        latest: {
          task_id: 'upstream-task-123',
          status: 'processing',
        },
      })
    ).toBe('upstream-task-123');

    expect(
      resolveResumeTaskId({
        latest: {
          task_id: 'finished-task-123',
          status: 'success',
        },
      })
    ).toBeNull();
  });

  it('writes latest task state back to yaml even when web sync is unavailable', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-agent-yaml-'));
    tempDirs.push(workspaceRoot);
    const projectRoot = path.join(workspaceRoot, 'projects', 'demo');
    const yamlPath = path.join(projectRoot, 'storyboards', 'scene-001.yaml');
    await fs.mkdir(path.dirname(yamlPath), { recursive: true });
    await fs.writeFile(
      yamlPath,
      `meta:\n  id: scene-001\n  version: "1.0"\ntasks:\n  video:\n    params:\n      prompt: test\n`,
      'utf-8'
    );

    await updateYamlProjection({
      taskId: 'provider-task-001',
      upstreamTaskId: 'provider-task-001',
      status: 'processing',
      output: null,
      yamlPath: 'storyboards/scene-001.yaml',
      taskType: 'video',
      projectRoot,
    });

    const raw = await fs.readFile(yamlPath, 'utf-8');
    expect(raw).toContain('task_id: provider-task-001');
    expect(raw).toContain('upstream_task_id: provider-task-001');
    expect(raw).toContain('status: processing');
  });
});
