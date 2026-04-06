import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildSkillBundle } from '../../src/logic/build-skill';

type BuildSkillBundle = (options?: {
  packageRoot?: string;
  skillName?: string;
  outputRoot?: string;
  distSource?: string;
  includeDistInSkill?: boolean;
}) => Promise<{
  skillRoot: string;
  archivePath: string;
  distRoot?: string;
  distArchivePath?: string;
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

describe('skill packaging', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) await cleanup(dir);
    }
  });

  it('builds a slim skill bundle and emits a unified runtime archive', async () => {
    const buildSkill = buildSkillBundle as BuildSkillBundle;
    const fakeDist = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-dist-'));
    const buildOut = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-skill-build-'));
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-project-'));
    tempDirs.push(fakeDist, buildOut, projectRoot);

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
    await expect(fs.access(path.join(buildOut, 'dist', 'index.html'))).rejects.toThrow();
    expect(built.distArchivePath).toBeTruthy();
    await fs.access(built.distArchivePath as string);
    expect(path.basename(built.archivePath)).toBe('mangou.zip');
    expect(path.basename(built.distArchivePath as string)).toBe('mangou-runtime.zip');

    const skillMd = await fs.readFile(path.join(buildOut, 'SKILL.md'), 'utf-8');
    expect(skillMd).toContain('mangou-runtime.zip');

    const installedSkillRoot = path.join(projectRoot, '.claude', 'skills', 'mangou');
    await copyDir(buildOut, installedSkillRoot);

    await fs.access(path.join(installedSkillRoot, 'SKILL.md'));
    await expect(fs.access(path.join(installedSkillRoot, 'dist', 'index.html'))).rejects.toThrow();
  });
});
