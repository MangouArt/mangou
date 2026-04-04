import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import yaml from 'js-yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { scaffoldGridChildren } from '../../src/cli/split';

async function readYaml(filePath: string) {
  return yaml.load(await fs.readFile(filePath, 'utf-8')) as Record<string, any>;
}

describe('project scaffold', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('SPEC: scaffolds child storyboards from a master grid yaml', async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-scaffold-'));
    tempDirs.push(projectRoot);

    const storyboardsDir = path.join(projectRoot, 'storyboards');
    await fs.mkdir(storyboardsDir, { recursive: true });

    const masterYamlPath = path.join(storyboardsDir, 'master.yaml');
    await fs.writeFile(
      masterYamlPath,
      [
        'meta:',
        '  id: master-shot',
        '  version: "1.0"',
        '  grid: 3x3',
        'content:',
        '  sequence: 10',
        '  title: "母图"',
        '  story: "原始剧情"',
        '  action: "九宫格母图"',
        '  scene: "地表"',
        '  duration: "4s"',
        '',
      ].join('\n'),
      'utf-8',
    );

    const result = await scaffoldGridChildren({
      projectRoot,
      gridYamlPath: masterYamlPath,
    });

    expect(result.created).toHaveLength(9);

    const firstChild = await readYaml(path.join(storyboardsDir, 'master-shot-sub-01.yaml'));
    const ninthChild = await readYaml(path.join(storyboardsDir, 'master-shot-sub-09.yaml'));

    expect(firstChild.meta.parent).toBe('master-shot');
    expect(firstChild.meta.grid_index).toBe(1);
    expect(firstChild.content.story).toBe('原始剧情');
    expect(ninthChild.meta.grid_index).toBe(9);
  });
});
