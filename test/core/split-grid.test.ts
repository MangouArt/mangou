import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import yaml from 'js-yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { runSplitGrid } from '../../src/split';
import { listLatestTasks } from '@core/tasks';

async function createTestImage(outputPath: string) {
  await fs.writeFile(outputPath, 'dummy image content', 'utf-8');
}

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
    await createTestImage(parentImagePath);

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

    await runSplitGrid({ yamlPath: parentYamlPath, projectRoot: projectRoot });

    const childA = await readYamlDoc(childAPath);
    const childB = await readYamlDoc(childBPath);
    const tasks = await listLatestTasks(projectRoot);

    expect(childA.tasks.image.latest.output).toBe('assets/images/parent-grid-sub-04.png');
    expect(childB.tasks.image.latest.output).toBe('assets/images/parent-grid-sub-02.png');
    expect(tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'image',
          status: 'success',
          ref: {
            yamlPath: 'storyboards/child-a.yaml',
            taskType: 'image',
          },
        }),
        expect.objectContaining({
          type: 'image',
          status: 'success',
          ref: {
            yamlPath: 'storyboards/child-b.yaml',
            taskType: 'image',
          },
        }),
      ])
    );
  });

  it('uses only cli --grid or yaml meta.grid and ignores prompt-based grid hints', async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-grid-'));
    tempDirs.push(projectRoot);

    const storyboardsDir = path.join(projectRoot, 'storyboards');
    const imagesDir = path.join(projectRoot, 'assets', 'images');
    await fs.mkdir(storyboardsDir, { recursive: true });
    await fs.mkdir(imagesDir, { recursive: true });

    const parentImagePath = path.join(imagesDir, 'prompt-grid.png');
    await createTestImage(parentImagePath);

    const parentYamlPath = path.join(storyboardsDir, 'prompt-parent.yaml');
    await fs.writeFile(
      parentYamlPath,
      [
        'meta:',
        '  id: prompt-parent',
        '  version: "1.0"',
        'tasks:',
        '  image:',
        '    params:',
        '      prompt: "Please render this as a 3x3 storyboard grid"',
        '    latest:',
        '      output: assets/images/prompt-grid.png',
        '',
      ].join('\n'),
      'utf-8',
    );

    const result = await runSplitGrid({ yamlPath: parentYamlPath, projectRoot: projectRoot });

    expect(result.outputs).toHaveLength(4);
    expect(result.outputs).toEqual([
      'assets/images/prompt-grid-sub-01.png',
      'assets/images/prompt-grid-sub-02.png',
      'assets/images/prompt-grid-sub-03.png',
      'assets/images/prompt-grid-sub-04.png',
    ]);
  });
});
