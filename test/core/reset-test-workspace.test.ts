import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { resetTestWorkspace } from '../../src/cli/logic/reset-test-workspace';

async function cleanup(dir: string) {
  if (!dir) return;
  await fs.rm(dir, { recursive: true, force: true });
}

async function writeFile(targetPath: string, content: string) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, 'utf-8');
}

describe('reset test workspace', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) await cleanup(dir);
    }
  });

  it('clears workspace and installs bundled skill into .agent/skills', async () => {
    const packageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-reset-root-'));
    tempDirs.push(packageRoot);

    await writeFile(path.join(packageRoot, 'bundled-skills', 'mangou', 'SKILL.md'), '# test skill');
    await writeFile(path.join(packageRoot, 'bundled-skills', 'mangou', 'scripts', 'http-server'), 'console.log("ok");');
    await writeFile(path.join(packageRoot, 'workspace', 'old.txt'), 'stale');

    const result = await resetTestWorkspace({ packageRoot });

    expect(result.workspaceRoot).toBe(path.join(packageRoot, 'workspace'));
    await expect(fs.access(path.join(packageRoot, 'workspace', 'old.txt'))).rejects.toThrow();
    await fs.access(path.join(packageRoot, 'workspace', '.agent', 'skills', 'mangou', 'SKILL.md'));
    await fs.access(path.join(packageRoot, 'workspace', '.agent', 'skills', 'mangou', 'scripts', 'http-server'));
  });
});
