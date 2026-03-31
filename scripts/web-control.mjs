import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PACKAGE_ROOT = path.resolve(SCRIPT_DIR, '..');
const RUNTIME_DIR = '.mangou';
const PID_FILE = 'server.pid';
const PORT_FILE = 'server.port';
const LOG_FILE = 'server.log';
const CONFIG_FILE = 'config.json';
const PROJECT_INDEX_FILE = 'projects.json';
const DEFAULT_WORKSPACE_DIR = 'projects';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolvePackageRoot(packageRoot = DEFAULT_PACKAGE_ROOT) {
  return path.resolve(packageRoot);
}

export function resolveRuntimeDir(workspaceRoot) {
  return path.join(path.resolve(workspaceRoot), RUNTIME_DIR);
}

function resolveRuntimePath(workspaceRoot, filename) {
  return path.join(resolveRuntimeDir(workspaceRoot), filename);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyTemplateDir(templateRoot, targetRoot) {
  const exists = await pathExists(templateRoot);
  if (!exists) return false;

  const copyDir = async (src, dest) => {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.agents') continue;
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await copyDir(srcPath, destPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (await pathExists(destPath)) continue;
      await fs.copyFile(srcPath, destPath);
    }
  };

  await copyDir(templateRoot, targetRoot);
  return true;
}

async function ensureWorkspaceConfig(workspaceRoot) {
  const configPath = path.join(workspaceRoot, CONFIG_FILE);
  let current = {};
  if (await pathExists(configPath)) {
    try {
      current = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    } catch {
      current = {};
    }
  }

  const next = {
    bltai: {
      apiKey: current?.bltai?.apiKey ?? '',
      baseUrl: current?.bltai?.baseUrl ?? 'https://api.bltcy.ai',
    },
    workspaceDir: current?.workspaceDir || DEFAULT_WORKSPACE_DIR,
    ...current,
    workspaceDir: current?.workspaceDir || DEFAULT_WORKSPACE_DIR,
  };

  await fs.writeFile(configPath, `${JSON.stringify(next, null, 2)}\n`, 'utf-8');
}

async function readWorkspaceDir(workspaceRoot) {
  const configPath = path.join(path.resolve(workspaceRoot), CONFIG_FILE);
  try {
    const current = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    if (typeof current?.workspaceDir === 'string' && current.workspaceDir.trim()) {
      return current.workspaceDir.trim();
    }
  } catch {}
  return DEFAULT_WORKSPACE_DIR;
}

export async function resolveProjectsRoot(workspaceRoot) {
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
  const workspaceDir = await readWorkspaceDir(resolvedWorkspaceRoot);
  return path.join(resolvedWorkspaceRoot, workspaceDir);
}

async function ensureProjectIndex(workspaceRoot) {
  const projectIndexPath = path.join(workspaceRoot, PROJECT_INDEX_FILE);
  if (await pathExists(projectIndexPath)) return;
  await fs.writeFile(projectIndexPath, `${JSON.stringify({ projects: [] }, null, 2)}\n`, 'utf-8');
}

export async function initWorkspace({ workspaceRoot, packageRoot = DEFAULT_PACKAGE_ROOT }) {
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
  const resolvedPackageRoot = resolvePackageRoot(packageRoot);
  const templateRoot = path.join(resolvedPackageRoot, 'workspace_template');

  await fs.mkdir(resolvedWorkspaceRoot, { recursive: true });
  await copyTemplateDir(templateRoot, resolvedWorkspaceRoot);
  await fs.mkdir(resolveRuntimeDir(resolvedWorkspaceRoot), { recursive: true });
  await ensureWorkspaceConfig(resolvedWorkspaceRoot);
  await ensureProjectIndex(resolvedWorkspaceRoot);
  const projectsRoot = await resolveProjectsRoot(resolvedWorkspaceRoot);
  await fs.mkdir(projectsRoot, { recursive: true });

  return {
    workspaceRoot: resolvedWorkspaceRoot,
    projectsRoot,
    runtimeDir: resolveRuntimeDir(resolvedWorkspaceRoot),
  };
}

function slugifyProjectId(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function readProjectIndex(workspaceRoot) {
  const projectIndexPath = path.join(path.resolve(workspaceRoot), PROJECT_INDEX_FILE);
  try {
    const parsed = JSON.parse(await fs.readFile(projectIndexPath, 'utf-8'));
    return Array.isArray(parsed?.projects) ? parsed : { projects: [] };
  } catch {
    return { projects: [] };
  }
}

async function writeProjectIndex(workspaceRoot, index) {
  const projectIndexPath = path.join(path.resolve(workspaceRoot), PROJECT_INDEX_FILE);
  await fs.writeFile(projectIndexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf-8');
}

export async function createProject({
  workspaceRoot,
  projectId,
  name,
  description = '',
}) {
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
  await initWorkspace({ workspaceRoot: resolvedWorkspaceRoot });

  const safeProjectId = slugifyProjectId(projectId || name);
  if (!safeProjectId) {
    throw new Error('projectId is required');
  }

  const projectsRoot = await resolveProjectsRoot(resolvedWorkspaceRoot);
  const projectRoot = path.join(projectsRoot, safeProjectId);
  const now = new Date().toISOString();

  await fs.mkdir(path.join(projectRoot, 'storyboards'), { recursive: true });
  await fs.mkdir(path.join(projectRoot, 'asset_defs', 'chars'), { recursive: true });
  await fs.mkdir(path.join(projectRoot, 'asset_defs', 'scenes'), { recursive: true });
  await fs.mkdir(path.join(projectRoot, 'asset_defs', 'props'), { recursive: true });
  await fs.mkdir(path.join(projectRoot, 'assets', 'images'), { recursive: true });
  await fs.mkdir(path.join(projectRoot, 'assets', 'videos'), { recursive: true });
  await fs.writeFile(path.join(projectRoot, 'tasks.jsonl'), '', { flag: 'a' });

  const metadata = {
    schemaVersion: 1,
    id: safeProjectId,
    name: name || safeProjectId,
    description,
    createdAt: now,
    updatedAt: now,
  };
  await fs.writeFile(path.join(projectRoot, 'project.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf-8');

  const index = await readProjectIndex(resolvedWorkspaceRoot);
  const nextProjects = index.projects.filter((item) => item.id !== safeProjectId);
  nextProjects.push({
    id: safeProjectId,
    name: metadata.name,
    description,
    createdAt: now,
    updatedAt: now,
  });
  await writeProjectIndex(resolvedWorkspaceRoot, { projects: nextProjects });

  return {
    id: safeProjectId,
    name: metadata.name,
    description,
    createdAt: now,
    updatedAt: now,
    projectRoot,
  };
}

function isProcessRunning(pid) {
  if (!pid || Number.isNaN(Number(pid))) return false;
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
}

async function readNumberFile(filePath) {
  try {
    const raw = (await fs.readFile(filePath, 'utf-8')).trim();
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

async function writeRuntimeState(workspaceRoot, { pid, port }) {
  await fs.mkdir(resolveRuntimeDir(workspaceRoot), { recursive: true });
  await fs.writeFile(resolveRuntimePath(workspaceRoot, PID_FILE), `${pid}\n`, 'utf-8');
  await fs.writeFile(resolveRuntimePath(workspaceRoot, PORT_FILE), `${port}\n`, 'utf-8');
}

async function clearRuntimeState(workspaceRoot) {
  await fs.rm(resolveRuntimePath(workspaceRoot, PID_FILE), { force: true });
  await fs.rm(resolveRuntimePath(workspaceRoot, PORT_FILE), { force: true });
}

export async function getWebStatus({ workspaceRoot, isProcessRunningImpl = isProcessRunning }) {
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
  const pid = await readNumberFile(resolveRuntimePath(resolvedWorkspaceRoot, PID_FILE));
  const port = await readNumberFile(resolveRuntimePath(resolvedWorkspaceRoot, PORT_FILE));
  const logPath = resolveRuntimePath(resolvedWorkspaceRoot, LOG_FILE);

  if (!pid || !port || !isProcessRunningImpl(pid)) {
    await clearRuntimeState(resolvedWorkspaceRoot);
    return {
      status: 'stopped',
      pid: null,
      port: port ?? null,
      url: null,
      workspaceRoot: resolvedWorkspaceRoot,
      logPath,
    };
  }

  return {
    status: 'running',
    pid,
    port,
    url: `http://127.0.0.1:${port}`,
    workspaceRoot: resolvedWorkspaceRoot,
    logPath,
  };
}

async function waitForServer(url, timeoutMs = 10000) {
  const started = Date.now();
  for (;;) {
    try {
      const response = await fetch(`${url}/api/meta`);
      if (response.ok) return;
    } catch {}

    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out waiting for web server: ${url}`);
    }

    await sleep(100);
  }
}

export async function startWebServer({
  workspaceRoot,
  appRoot = DEFAULT_PACKAGE_ROOT,
  port = 3000,
  timeoutMs = 10000,
  spawnImpl = spawn,
  waitForReady = waitForServer,
  isProcessRunningImpl = isProcessRunning,
}) {
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
  const resolvedAppRoot = resolvePackageRoot(appRoot);
  await initWorkspace({ workspaceRoot: resolvedWorkspaceRoot, packageRoot: resolvedAppRoot });
  const resolvedProjectsRoot = await resolveProjectsRoot(resolvedWorkspaceRoot);

  const current = await getWebStatus({
    workspaceRoot: resolvedWorkspaceRoot,
    isProcessRunningImpl,
  });
  if (current.status === 'running') {
    return { ...current, reused: true };
  }

  const logPath = resolveRuntimePath(resolvedWorkspaceRoot, LOG_FILE);
  await fs.mkdir(resolveRuntimeDir(resolvedWorkspaceRoot), { recursive: true });
  const logFd = fsSync.openSync(logPath, 'a');
  const tsconfigPath = path.join(resolvedAppRoot, 'tsconfig.json');
  const bundledHttpServerEntry = path.join(resolvedAppRoot, 'scripts', 'http-server.mjs');
  const sourceHttpServerEntry = path.join(resolvedAppRoot, 'scripts', 'http-server.ts');
  const hasTsconfig = await pathExists(tsconfigPath);
  const useSourceEntry = hasTsconfig && (await pathExists(sourceHttpServerEntry));
  const commandArgs = useSourceEntry
    ? ['--import', 'tsx', sourceHttpServerEntry]
    : [bundledHttpServerEntry];
  const childEnv = {
    ...process.env,
    MANGOU_HOME: resolvedWorkspaceRoot,
    MANGOU_WORKSPACE_ROOT: resolvedProjectsRoot,
    MANGOU_WEB_PORT: String(port),
  };
  if (useSourceEntry) {
    childEnv.TSX_TSCONFIG_PATH = tsconfigPath;
  }

  const child = spawnImpl(process.execPath, commandArgs, {
    cwd: resolvedAppRoot,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: childEnv,
  });

  child.unref();
  await writeRuntimeState(resolvedWorkspaceRoot, { pid: child.pid, port });

  const url = `http://127.0.0.1:${port}`;
  try {
    await waitForReady(url, timeoutMs);
  } catch (error) {
    await stopWebServer({ workspaceRoot: resolvedWorkspaceRoot }).catch(() => null);
    throw error;
  }

  return {
    status: 'running',
    pid: child.pid,
    port,
    url,
    workspaceRoot: resolvedWorkspaceRoot,
    logPath,
    reused: false,
  };
}

async function waitForExit(pid, timeoutMs = 5000, isProcessRunningImpl = isProcessRunning) {
  const started = Date.now();
  while (isProcessRunningImpl(pid)) {
    if (Date.now() - started > timeoutMs) {
      return false;
    }
    await sleep(100);
  }
  return true;
}

export async function stopWebServer({
  workspaceRoot,
  timeoutMs = 5000,
  isProcessRunningImpl = isProcessRunning,
  killImpl = process.kill.bind(process),
}) {
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
  const status = await getWebStatus({
    workspaceRoot: resolvedWorkspaceRoot,
    isProcessRunningImpl,
  });

  if (status.status !== 'running' || !status.pid) {
    return {
      stopped: false,
      workspaceRoot: resolvedWorkspaceRoot,
    };
  }

  try {
    killImpl(status.pid, 'SIGTERM');
  } catch {}

  const exited = await waitForExit(status.pid, timeoutMs, isProcessRunningImpl);
  if (!exited) {
    try {
      killImpl(status.pid, 'SIGKILL');
    } catch {}
    await waitForExit(status.pid, 2000, isProcessRunningImpl);
  }

  await clearRuntimeState(resolvedWorkspaceRoot);

  return {
    stopped: true,
    workspaceRoot: resolvedWorkspaceRoot,
  };
}
