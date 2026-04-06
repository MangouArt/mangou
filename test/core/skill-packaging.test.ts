import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { pathToFileURL } from 'url';
import { promisify } from 'util';
import { afterEach, describe, expect, it } from 'vitest';
import { buildSkillBundle } from '../../src/logic/build-skill';

const GENERATED_NOTICE = '<!-- GENERATED FROM skill-src/mangou. DO NOT EDIT HERE. EDIT skill-src/mangou INSTEAD. -->';

type BuildSkillBundle = (options?: {
  packageRoot?: string;
  skillName?: string;
  outputRoot?: string;
  distSource?: string;
  includeDistInSkill?: boolean;
}) => Promise<{
  skillRoot: string;
  standardSkillRoot?: string;
  clawhubSkillRoot?: string;
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

async function listFilesRecursive(root: string, base = root): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...await listFilesRecursive(fullPath, base));
      continue;
    }
    if (entry.isFile()) {
      results.push(path.relative(base, fullPath));
    }
  }
  return results.sort();
}

function stripGeneratedNotice(markdown: string) {
  return markdown.replace(`${GENERATED_NOTICE}\n`, '');
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

  it('builds a slim skill bundle and emits a unified runtime archive', async () => {
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
    await expect(fs.access(path.join(buildOut, 'dist', 'index.html'))).rejects.toThrow();
    expect(path.basename(built.standardSkillRoot as string)).toBe('managing-motion-comics');
    await fs.access(path.join(built.standardSkillRoot as string, 'SKILL.md'));
    expect(path.basename(built.clawhubSkillRoot as string)).toBe('mangou-ai-motion-comic');
    await fs.access(path.join(built.clawhubSkillRoot as string, 'SKILL.md'));
    const sourceRoot = path.join(process.cwd(), 'skill-src', 'mangou');
    const standardRoot = built.standardSkillRoot as string;
    const clawhubRoot = built.clawhubSkillRoot as string;
    const sourceFiles = await listFilesRecursive(sourceRoot);
    const standardFiles = await listFilesRecursive(standardRoot);
    const clawhubFiles = await listFilesRecursive(clawhubRoot);
    expect(standardFiles).toEqual(sourceFiles);
    expect(clawhubFiles).toEqual(sourceFiles);
    for (const relativePath of sourceFiles) {
      const sourceContent = await fs.readFile(path.join(sourceRoot, relativePath), 'utf-8');
      const standardContent = await fs.readFile(path.join(standardRoot, relativePath), 'utf-8');
      expect(standardContent).toContain(GENERATED_NOTICE);
      expect(stripGeneratedNotice(standardContent)).toBe(sourceContent);
    }
    const clawhubSkillMd = await fs.readFile(path.join(clawhubRoot, 'SKILL.md'), 'utf-8');
    expect(clawhubSkillMd).toContain('name: mangou-ai-motion-comic');
    expect(clawhubSkillMd).toContain('license: MIT-0');
    expect(clawhubSkillMd).toContain('display-name: Mangou AI 漫剧导演 / Motion Comic Director');
    expect(clawhubSkillMd).toContain('ClawHub edition');
    expect(clawhubSkillMd).toContain('# Mangou AI 漫剧导演 / Motion Comic Director');
    expect(clawhubSkillMd).toContain(GENERATED_NOTICE);
    const clawhubInstall = await fs.readFile(path.join(clawhubRoot, 'INSTALL.md'), 'utf-8');
    expect(clawhubInstall).toContain('ClawHub 已经负责安装这份 skill 入口');
    expect(clawhubInstall).not.toContain('npx skills add ./skills/managing-motion-comics --agent claude-code');
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
