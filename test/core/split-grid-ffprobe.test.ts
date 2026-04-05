import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import yaml from 'js-yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { runSplitGrid } from '../../src/split';

describe('split-grid ffprobe fallback', () => {
  const tempDirs: string[] = [];
  const originalPath = process.env.PATH;

  afterEach(async () => {
    process.env.PATH = originalPath;
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('falls back instead of crashing when ffprobe is unavailable', async () => {
    process.env.PATH = '';

    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-grid-ffprobe-'));
    tempDirs.push(projectRoot);

    const storyboardsDir = path.join(projectRoot, 'storyboards');
    const imagesDir = path.join(projectRoot, 'assets', 'images');
    await fs.mkdir(storyboardsDir, { recursive: true });
    await fs.mkdir(imagesDir, { recursive: true });

    const parentYamlPath = path.join(storyboardsDir, 'master.yaml');
    await fs.writeFile(
      parentYamlPath,
      yaml.dump({
        meta: { id: 'master', grid: '2x2' },
        tasks: {
          image: {
            latest: {
              status: 'success',
              output: 'assets/images/master.png',
            },
          },
        },
      }),
      'utf-8',
    );

    await fs.writeFile(path.join(imagesDir, 'master.png'), 'dummy content', 'utf-8');

    const result = await runSplitGrid({ yamlPath: parentYamlPath, projectRoot });

    expect(result.outputs).toEqual([
      'assets/images/master-sub-01.png',
      'assets/images/master-sub-02.png',
      'assets/images/master-sub-03.png',
      'assets/images/master-sub-04.png',
    ]);
  });
});
