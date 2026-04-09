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
    expect(skillMd).toContain('轻量安装态不包含 Bun runtime');
    await fs.access(path.join(buildOut, 'bootstrap-runtime.mjs'));

    const commandsMd = await fs.readFile(path.join(buildOut, 'COMMANDS.md'), 'utf-8');
    expect(commandsMd).toContain('如果当前技能根目录里还没有 `src/main.ts`');
    expect(commandsMd).toContain('先停止执行这些命令');

    const directoryMd = await fs.readFile(
      path.join(buildOut, 'knowledge', 'directory.md'),
      'utf-8',
    );
    expect(directoryMd).toContain('<skill-root>/');
    expect(directoryMd).not.toContain('.claude/skills/');

    const installedSkillRoot = path.join(projectRoot, '.claude', 'skills', 'mangou');
    await copyDir(buildOut, installedSkillRoot);

    await fs.access(path.join(installedSkillRoot, 'SKILL.md'));
    await expect(fs.access(path.join(installedSkillRoot, 'dist', 'index.html'))).rejects.toThrow();
  });

  it('does not sync into sibling lightweight skill repos', async () => {
    const buildSkill = buildSkillBundle as BuildSkillBundle;
    const fakeDist = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-dist-'));
    const packageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-package-'));
    const buildOut = path.join(packageRoot, 'bundled-skills', 'mangou');
    const skillSrcRoot = path.join(packageRoot, 'skill-src', 'mangou');
    const workspaceTemplateRoot = path.join(packageRoot, 'workspace_template');
    const runtimeSrcRoot = path.join(packageRoot, 'src');
    const skillRepoRoot = path.join(path.dirname(packageRoot), 'mangou-ai-motion-comics');
    tempDirs.push(fakeDist, packageRoot, skillRepoRoot);

    await fs.mkdir(path.join(fakeDist, 'assets'), { recursive: true });
    await fs.writeFile(path.join(fakeDist, 'index.html'), '<!doctype html><div id="root"></div>');
    await fs.writeFile(path.join(fakeDist, 'assets', 'app.js'), 'console.log("ok")');

    await fs.mkdir(path.join(skillSrcRoot, 'knowledge'), { recursive: true });
    await fs.mkdir(path.join(workspaceTemplateRoot, '.agents'), { recursive: true });
    await fs.mkdir(runtimeSrcRoot, { recursive: true });
    await fs.writeFile(path.join(skillSrcRoot, 'SKILL.md'), '# synced skill');
    await fs.writeFile(path.join(skillSrcRoot, 'COMMANDS.md'), 'commands');
    await fs.writeFile(path.join(skillSrcRoot, 'INSTALL.md'), 'install');
    await fs.writeFile(path.join(skillSrcRoot, 'knowledge', 'storyboards.md'), 'storyboards');
    await fs.writeFile(path.join(runtimeSrcRoot, 'main.ts'), 'console.log("runtime");');
    await fs.writeFile(path.join(workspaceTemplateRoot, 'placeholder.txt'), 'template');
    await fs.writeFile(path.join(packageRoot, 'package.json'), '{"name":"test"}');
    await fs.writeFile(path.join(packageRoot, 'tsconfig.json'), '{"compilerOptions":{}}');
    await fs.mkdir(path.join(skillRepoRoot, '.git'), { recursive: true });
    await fs.writeFile(path.join(skillRepoRoot, 'SKILL.md'), '# old skill');
    await fs.writeFile(path.join(skillRepoRoot, 'obsolete.md'), 'stale');

    await buildSkill({
      packageRoot,
      outputRoot: buildOut,
      distSource: fakeDist,
    });

    expect(await fs.readFile(path.join(skillRepoRoot, 'SKILL.md'), 'utf-8')).toBe('# old skill');
    await fs.access(path.join(skillRepoRoot, 'obsolete.md'));
    await expect(fs.access(path.join(skillRepoRoot, 'knowledge', 'storyboards.md'))).rejects.toThrow();
  });
});
