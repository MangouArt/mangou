import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { pathToFileURL } from 'url';
import { promisify } from 'util';
import { afterEach, describe, expect, it } from 'vitest';
import { buildSkillBundle } from '../../src/cli/logic/build-skill';

type BuildSkillBundle = (options?: {
  packageRoot?: string;
  skillName?: string;
  outputRoot?: string;
  distSource?: string;
}) => Promise<{
  skillRoot: string;
  archivePath: string;
}>;

async function cleanup(dir: string) {
  if (!dir) return;
  await fs.rm(dir, { recursive: true, force: true });
}

async function copyDir(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
      continue;
    }
    if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

const execFileAsync = promisify(execFile);

describe('skill packaging', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) await cleanup(dir);
    }
  });

  it('builds a self-contained Claude skill bundle that can be copied into .claude/skills', async () => {
    const buildSkill = buildSkillBundle as BuildSkillBundle;
    const fakeDist = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-dist-'));
    const buildOut = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-skill-build-'));
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-project-'));
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-workspace-'));
    tempDirs.push(fakeDist, buildOut, projectRoot, workspaceRoot);

    await fs.mkdir(path.join(fakeDist, 'assets'), { recursive: true });
    await fs.writeFile(path.join(fakeDist, 'index.html'), '<!doctype html><div id="root"></div>');
    await fs.writeFile(path.join(fakeDist, 'assets', 'app.js'), 'console.log("ok")');

    const built = await buildSkill({
      packageRoot: process.cwd(),
      outputRoot: buildOut,
      distSource: fakeDist,
    });

    expect(built.skillRoot).toBe(buildOut);
    await fs.access(path.join(buildOut, 'SKILL.md'));
    await fs.access(path.join(buildOut, 'dist', 'index.html'));
    await fs.access(path.join(buildOut, 'workspace_template', '.env.example'));

    const skillMd = await fs.readFile(path.join(buildOut, 'SKILL.md'), 'utf-8');
    expect(skillMd).toContain('bun');

    const installedSkillRoot = path.join(projectRoot, '.claude', 'skills', 'mangou');
    await copyDir(buildOut, installedSkillRoot);

    await fs.access(path.join(installedSkillRoot, 'SKILL.md'));
    await fs.access(path.join(installedSkillRoot, 'dist', 'index.html'));
  });
});
