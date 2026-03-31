import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { SpawnOptions } from 'child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createProject,
  getWebStatus,
  initWorkspace,
  startWebServer,
  stopWebServer,
} from '../../../scripts/web-control.mjs';

async function cleanup(dir: string) {
  if (!dir) return;
  await fs.rm(dir, { recursive: true, force: true });
}

describe('Web control scripts', () => {
  let workspaceRoot = '';

  afterEach(async () => {
    if (workspaceRoot) {
      await stopWebServer({ workspaceRoot }).catch(() => null);
      await cleanup(workspaceRoot);
      workspaceRoot = '';
    }
  });

  it('initializes workspace scaffold from template', async () => {
    workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-workspace-'));

    await initWorkspace({
      workspaceRoot,
      packageRoot: process.cwd(),
    });

    const envExample = await fs.readFile(path.join(workspaceRoot, '.env.example'), 'utf-8');
    expect(envExample).toContain('BLTAI_API_KEY');
    const config = JSON.parse(await fs.readFile(path.join(workspaceRoot, 'config.json'), 'utf-8'));
    expect(config.workspaceDir).toBe('projects');
    const projectIndex = JSON.parse(await fs.readFile(path.join(workspaceRoot, 'projects.json'), 'utf-8'));
    expect(projectIndex).toEqual({ projects: [] });
    await fs.access(path.join(workspaceRoot, 'projects'));
    await expect(fs.access(path.join(workspaceRoot, 'AGENTS.md'))).rejects.toThrow();
    await expect(fs.access(path.join(workspaceRoot, 'CLAUDE.md'))).rejects.toThrow();
  });

  it('creates a project with timestamps under projects/<projectId>', async () => {
    workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-projects-'));

    await initWorkspace({
      workspaceRoot,
      packageRoot: process.cwd(),
    });

    const created = await createProject({
      workspaceRoot,
      projectId: 'mining-betrayal',
      name: 'Mining Betrayal',
      description: 'test project',
    });

    expect(created.id).toBe('mining-betrayal');
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(created.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await fs.access(path.join(workspaceRoot, 'projects', 'mining-betrayal', 'storyboards'));
    const projectJson = JSON.parse(
      await fs.readFile(path.join(workspaceRoot, 'projects', 'mining-betrayal', 'project.json'), 'utf-8')
    );
    expect(projectJson.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(projectJson.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const projectIndex = JSON.parse(await fs.readFile(path.join(workspaceRoot, 'projects.json'), 'utf-8'));
    expect(projectIndex.projects[0].id).toBe('mining-betrayal');
    expect(projectIndex.projects[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(projectIndex.projects[0].updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it(
    'starts, reports, and stops the web server in background',
    async () => {
      workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-web-'));
      await initWorkspace({
        workspaceRoot,
        packageRoot: process.cwd(),
      });

      const running = new Set<number>();
      let nextPid = 41000;
      const port = 3300;
      const spawnCalls: Array<{ command: string; args: string[]; env?: Record<string, string> }> = [];
      const typedStartWebServer = startWebServer as (options: {
        workspaceRoot: string;
        appRoot: string;
        port: number;
        spawnImpl: (
          command: string,
          args: string[],
          options?: SpawnOptions
        ) => { pid: number; unref(): void };
        waitForReady: (url: string) => Promise<void>;
        isProcessRunningImpl: (pid: number) => boolean;
      }) => ReturnType<typeof startWebServer>;

      const started = await typedStartWebServer({
        workspaceRoot,
        appRoot: process.cwd(),
        port,
        spawnImpl(command, args, options) {
          const pid = nextPid;
          nextPid += 1;
          running.add(pid);
          spawnCalls.push({ command, args, env: options?.env as Record<string, string> });
          return {
            pid,
            unref() {},
          };
        },
        waitForReady: async () => {},
        isProcessRunningImpl(pid) {
          return running.has(pid);
        },
      });

      expect(started.status).toBe('running');
      expect(started.port).toBe(port);
      expect(started.url).toBe(`http://127.0.0.1:${port}`);
      expect(started.reused).toBe(false);
      expect(spawnCalls).toHaveLength(1);
      expect(spawnCalls[0].env?.MANGOU_HOME).toBe(workspaceRoot);
      expect(spawnCalls[0].env?.MANGOU_WORKSPACE_ROOT).toBe(path.join(workspaceRoot, 'projects'));

      const second = await startWebServer({
        workspaceRoot,
        appRoot: process.cwd(),
        port,
        spawnImpl() {
          throw new Error('startWebServer should reuse existing process');
        },
        waitForReady: async () => {},
        isProcessRunningImpl(pid) {
          return running.has(pid);
        },
      });
      expect(second.reused).toBe(true);

      const status = await getWebStatus({
        workspaceRoot,
        isProcessRunningImpl(pid) {
          return running.has(pid);
        },
      });
      expect(status.status).toBe('running');
      expect(status.port).toBe(port);
      expect(status.workspaceRoot).toBe(workspaceRoot);
      expect(status.pid).toBe(started.pid);

      const stopped = await stopWebServer({
        workspaceRoot,
        isProcessRunningImpl(pid) {
          return running.has(pid);
        },
        killImpl(pid) {
          running.delete(Number(pid));
          return true;
        },
      });
      expect(stopped.stopped).toBe(true);

      const stoppedStatus = await getWebStatus({
        workspaceRoot,
        isProcessRunningImpl(pid) {
          return running.has(pid);
        },
      });
      expect(stoppedStatus.status).toBe('stopped');
      expect(stoppedStatus.pid).toBeNull();
    }
  );
});
