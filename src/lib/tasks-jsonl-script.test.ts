import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

describe('scripts/tasks-jsonl.mjs', () => {
  let tempDir = '';

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('strips base64 data urls from persisted task input', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-tasks-script-'));
    const { appendTaskEvent } = await import('../../scripts/tasks-jsonl.mjs');

    const snapshot = await appendTaskEvent(tempDir, {
      type: 'video',
      status: 'processing',
      provider: 'bltai',
      input: {
        prompt: 'test',
        images: ['data:image/png;base64,AAAAAAAAAAAAAAAAAAAAAAAAAAAA'],
      },
      ref: { yamlPath: 'storyboards/scene-001.yaml', taskType: 'video' },
    });

    expect(snapshot.input).toEqual({
      prompt: 'test',
      images: ['[omitted data-url image/png]'],
    });

    const raw = await fs.readFile(path.join(tempDir, 'tasks.jsonl'), 'utf-8');
    expect(raw).not.toContain('data:image/png;base64');
    expect(raw).toContain('[omitted data-url image/png]');
  });
});
