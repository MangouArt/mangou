import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { pathToFileURL } from 'url';
import { promisify } from 'util';
import { afterEach, describe, expect, it } from 'vitest';
import { buildSkillBundle } from '../../../scripts/build-skill.mjs';

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
    await fs.access(path.join(buildOut, 'scripts', 'http-server.mjs'));
    await fs.access(path.join(buildOut, 'scripts', 'mangou.mjs'));
    await fs.access(path.join(buildOut, 'scripts', 'tasks-jsonl.mjs'));
    await fs.access(path.join(buildOut, 'scripts', 'aigc-provider-template.mjs'));
    await fs.access(path.join(buildOut, 'scripts', 'agent-generate.mjs'));
    await fs.access(path.join(buildOut, 'scripts-src', 'web-control.mjs'));
    await fs.access(path.join(buildOut, 'scripts-src', 'http-server.ts'));

    const bundledMangou = await fs.readFile(path.join(buildOut, 'scripts', 'mangou.mjs'), 'utf-8');
    expect(bundledMangou.match(/^#!\/usr\/bin\/env node$/gm)).toHaveLength(1);
    expect(bundledMangou).toContain("from './web-control.mjs'");

    const bundledGenerate = await fs.readFile(path.join(buildOut, 'scripts', 'agent-generate.mjs'), 'utf-8');
    expect(bundledGenerate.match(/^#!\/usr\/bin\/env node$/gm)).toHaveLength(1);
    expect(bundledGenerate).not.toContain('Usage: node scripts/bltai-mvp.mjs');

    const bundledHttpServer = await fs.readFile(path.join(buildOut, 'scripts', 'http-server.mjs'), 'utf-8');
    expect(bundledHttpServer.match(/^#!\/usr\/bin\/env node$/gm)).toHaveLength(1);
    expect(bundledHttpServer).not.toContain('TSX_TSCONFIG_PATH');
    expect(bundledHttpServer).not.toContain("endsWith('http-server.ts')");

    const installedSkillRoot = path.join(projectRoot, '.claude', 'skills', 'mangou');
    await copyDir(buildOut, installedSkillRoot);

    await fs.access(path.join(installedSkillRoot, 'SKILL.md'));
    await fs.access(path.join(installedSkillRoot, 'dist', 'index.html'));
    await fs.access(path.join(installedSkillRoot, 'scripts', 'tasks-jsonl.mjs'));
    await expect(fs.access(path.join(projectRoot, 'CLAUDE.md'))).rejects.toThrow();
    await expect(fs.access(path.join(projectRoot, 'AGENTS.md'))).rejects.toThrow();

    const moduleUrl = pathToFileURL(path.join(installedSkillRoot, 'scripts', 'web-control.mjs')).href;
    const skillModule = await import(moduleUrl);
    const cliPath = path.join(installedSkillRoot, 'scripts', 'mangou.mjs');

    await execFileAsync('node', [cliPath, 'workspace', 'init', '--workspace', workspaceRoot], {
      cwd: projectRoot,
    });

    await fs.access(path.join(workspaceRoot, '.env.example'));
    const projectIndex = JSON.parse(await fs.readFile(path.join(workspaceRoot, 'projects.json'), 'utf-8'));
    expect(projectIndex).toEqual({ projects: [] });
    const config = JSON.parse(await fs.readFile(path.join(workspaceRoot, 'config.json'), 'utf-8'));
    expect(config.workspaceDir).toBe('projects');
    await fs.access(path.join(workspaceRoot, 'projects'));
    await expect(fs.access(path.join(workspaceRoot, 'AGENTS.md'))).rejects.toThrow();
    await expect(fs.access(path.join(workspaceRoot, 'CLAUDE.md'))).rejects.toThrow();

    await execFileAsync(
      'node',
      [cliPath, 'project', 'create', '--workspace', workspaceRoot, '--project', 'demo-skill', '--name', 'Demo Skill'],
      { cwd: projectRoot }
    );

    await fs.access(path.join(workspaceRoot, 'projects', 'demo-skill', 'project.json'));

    try {
      await execFileAsync(
        'node',
        [cliPath, 'stitch', path.join(workspaceRoot, 'projects', 'demo-skill')],
        { cwd: projectRoot }
      );
      throw new Error('expected stitch to fail on an empty project');
    } catch (error: any) {
      const combined = `${error?.stdout || ''}\n${error?.stderr || ''}\n${error?.message || ''}`;
      expect(combined).not.toContain('ERR_MODULE_NOT_FOUND');
    }

    const running = new Set<number>();
    let nextPid = 52000;
    const spawnCalls: Array<{ command: string; args: string[] }> = [];

    const started = await skillModule.startWebServer({
      workspaceRoot,
      port: 3333,
      spawnImpl(command: string, args: string[]) {
        const pid = nextPid;
        nextPid += 1;
        running.add(pid);
        spawnCalls.push({ command, args });
        return { pid, unref() {} };
      },
      waitForReady: async () => {},
      isProcessRunningImpl(pid: number) {
        return running.has(pid);
      },
    });

    expect(started.status).toBe('running');
    expect(spawnCalls).toHaveLength(1);
    expect(spawnCalls[0].args[0]).toContain(path.join('.claude', 'skills', 'mangou', 'scripts', 'http-server.mjs'));

    const stopped = await skillModule.stopWebServer({
      workspaceRoot,
      isProcessRunningImpl(pid: number) {
        return running.has(pid);
      },
      killImpl(pid: number) {
        running.delete(Number(pid));
        return true;
      },
    });

    expect(stopped.stopped).toBe(true);
  });
});
