import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import yaml from 'js-yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { runSplitGrid } from '../../../scripts/split-grid.mjs';

async function readYamlDoc(filePath: string) {
  const raw = await fs.readFile(filePath, 'utf-8');
  return yaml.load(raw) as Record<string, any>;
}

describe('split-grid', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('prefers explicit meta.grid_index over sibling ordering when backfilling child yaml files', async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-grid-'));
    tempDirs.push(projectRoot);

    const storyboardsDir = path.join(projectRoot, 'storyboards');
    const imagesDir = path.join(projectRoot, 'assets', 'images');
    await fs.mkdir(storyboardsDir, { recursive: true });
    await fs.mkdir(imagesDir, { recursive: true });

    const parentImagePath = path.join(imagesDir, 'parent-grid.png');
    const pixels = Buffer.from([
      255, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255,
      0, 0, 255, 255, 0, 0, 255, 255, 255, 255, 0, 255, 255, 255, 0, 255,
      255, 0, 255, 255, 255, 0, 255, 255, 0, 255, 255, 255, 0, 255, 255, 255,
      10, 10, 10, 255, 10, 10, 10, 255, 200, 200, 200, 255, 200, 200, 200, 255,
    ]);
    await sharp(pixels, {
      raw: {
        width: 4,
        height: 4,
        channels: 4,
      },
    }).png().toFile(parentImagePath);

    const parentYamlPath = path.join(storyboardsDir, 'parent.yaml');
    const childAPath = path.join(storyboardsDir, 'child-a.yaml');
    const childBPath = path.join(storyboardsDir, 'child-b.yaml');

    await fs.writeFile(
      parentYamlPath,
      [
        'meta:',
        '  id: master-shot',
        '  version: "1.0"',
        '  grid: 2x2',
        'tasks:',
        '  image:',
        '    latest:',
        '      output: assets/images/parent-grid.png',
        '',
      ].join('\n'),
      'utf-8',
    );

    await fs.writeFile(
      childAPath,
      [
        'meta:',
        '  id: child-a',
        '  version: "1.0"',
        '  parent: master-shot',
        '  grid_index: 4',
        'content:',
        '  sequence: 1',
        '',
      ].join('\n'),
      'utf-8',
    );

    await fs.writeFile(
      childBPath,
      [
        'meta:',
        '  id: child-b',
        '  version: "1.0"',
        '  parent: master-shot',
        '  grid_index: 2',
        'content:',
        '  sequence: 2',
        '',
      ].join('\n'),
      'utf-8',
    );

    await runSplitGrid([parentYamlPath, '--project-root', projectRoot]);

    const childA = await readYamlDoc(childAPath);
    const childB = await readYamlDoc(childBPath);

    expect(childA.tasks.image.latest.output).toBe('assets/images/parent-grid-sub-04.png');
    expect(childB.tasks.image.latest.output).toBe('assets/images/parent-grid-sub-02.png');
  });
});
