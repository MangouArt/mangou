import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { inferContext } from '../../../scripts/agent-generate.mjs';

describe('agent-generate path inference', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('parses yaml paths from projects/<projectId>', async () => {
    const workspaceHome = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-workspace-'));
    tempDirs.push(workspaceHome);
    await fs.mkdir(path.join(workspaceHome, 'projects', 'mining-betrayal', 'storyboards'), { recursive: true });
    await fs.writeFile(path.join(workspaceHome, 'projects.json'), '{"projects":[]}\n', 'utf-8');
    await fs.writeFile(path.join(workspaceHome, 'config.json'), '{"workspaceDir":"projects"}\n', 'utf-8');
    const yamlPath = path.join(workspaceHome, 'projects', 'mining-betrayal', 'storyboards', 'scene-001.yaml');

    await expect(inferContext(yamlPath)).resolves.toEqual({
      workspaceRoot: workspaceHome,
      projectId: 'mining-betrayal',
      projectPath: 'mining-betrayal',
      projectRoot: path.join(workspaceHome, 'projects', 'mining-betrayal'),
      yamlPath: 'storyboards/scene-001.yaml',
    });
  });

  it('parses asset definition yaml paths from projects/<projectId>/asset_defs', async () => {
    const workspaceHome = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-workspace-'));
    tempDirs.push(workspaceHome);
    await fs.mkdir(path.join(workspaceHome, 'projects', 'mining-betrayal', 'asset_defs', 'chars'), { recursive: true });
    await fs.writeFile(path.join(workspaceHome, 'projects.json'), '{"projects":[]}\n', 'utf-8');
    await fs.writeFile(path.join(workspaceHome, 'config.json'), '{"workspaceDir":"projects"}\n', 'utf-8');
    const yamlPath = path.join(workspaceHome, 'projects', 'mining-betrayal', 'asset_defs', 'chars', 'du-xiu.yaml');

    await expect(inferContext(yamlPath)).resolves.toEqual({
      workspaceRoot: workspaceHome,
      projectId: 'mining-betrayal',
      projectPath: 'mining-betrayal',
      projectRoot: path.join(workspaceHome, 'projects', 'mining-betrayal'),
      yamlPath: 'asset_defs/chars/du-xiu.yaml',
    });
  });

  it('rejects yaml files outside initialized workspace project directory', async () => {
    const badWorkspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-bad-workspace-'));
    tempDirs.push(badWorkspaceRoot);
    const badPath = path.join(badWorkspaceRoot, 'storyboards', 'scene-001.yaml');
    await expect(inferContext(badPath)).rejects.toThrow(
      'YAML must live under <workspace>/projects/<projectId>/(storyboards|asset_defs)/'
    );
  });
});
