import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildProjectSnapshot } from '../../src/cli/core/vfs/project-snapshot';

describe('buildProjectSnapshot', () => {
  let tempDir = '';

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('collects text files and skips media plus ignored directories', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-snapshot-'));
    await fs.mkdir(path.join(tempDir, 'storyboards'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'asset_defs', 'chars'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'assets', 'images'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'output'), { recursive: true });

    await fs.writeFile(path.join(tempDir, 'storyboards', 'scene-001.yaml'), 'meta:\n  id: scene-001\n');
    await fs.writeFile(path.join(tempDir, 'asset_defs', 'chars', 'hero.yaml'), 'content:\n  name: Hero\n');
    await fs.writeFile(path.join(tempDir, 'tasks.jsonl'), '');
    await fs.writeFile(path.join(tempDir, 'assets', 'images', 'hero.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await fs.writeFile(path.join(tempDir, 'output', 'ignore.txt'), 'ignore me');

    const snapshot = await buildProjectSnapshot('demo', tempDir);

    expect(snapshot.projectId).toBe('demo');
    expect(snapshot.files).toEqual([
      { path: '/asset_defs/chars/hero.yaml', content: 'content:\n  name: Hero\n' },
      { path: '/storyboards/scene-001.yaml', content: 'meta:\n  id: scene-001\n' },
      { path: '/tasks.jsonl', content: '' },
    ]);
  });
});
