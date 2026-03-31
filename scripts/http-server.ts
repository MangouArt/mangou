import './register-alias';
import http from 'http';
import https from 'https';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProjectManager } from '../src/lib/project-manager';
import { configStore } from '../src/lib/config-store';
import { parseYAML } from '../src/lib/vfs/yaml';
import { stitchVideosLocal } from '../src/lib/video/stitch';
import { getContentTypeByPath, getCacheControlByContentType } from '../src/lib/vfs/server-utils';
import { isMediaContentType, normalizeContentType, sniffContentType } from '../src/lib/file-type';
import { vfsStorageManager } from '../src/lib/vfs/storage-manager';
import { vfsEventManager } from '../src/lib/vfs/event-manager';
import { buildProjectSnapshot } from '../src/lib/vfs/project-snapshot';
import { appendTaskEvent, getTaskById, listLatestTasks } from './tasks-jsonl.mjs';
import { updateGenerationStatus, stringifyYAML } from '../src/lib/vfs/yaml';

type ServerOptions = {
  appRoot: string;
  dataRoot: string;
  port?: number;
};

function log(...args: unknown[]) {
  console.error('[mangou-web]', ...args);
}

type VfsSseClient = { res: http.ServerResponse; projectId: string };
const vfsSseClients = new Set<VfsSseClient>();
let vfsEventBound = false;

function sendSse(res: http.ServerResponse, event: string, payload: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcastLog(payload: unknown) {
  for (const client of vfsSseClients) {
    sendSse(client.res, 'log', payload);
  }
}

function bindVfsEventsOnce() {
  if (vfsEventBound) return;
  vfsEventBound = true;
  vfsEventManager.on('change', (event) => {
    for (const client of vfsSseClients) {
      if (client.projectId && client.projectId !== event.projectId) continue;
      sendSse(client.res, 'vfs', event);
    }
  });
}

function sendJson(res: http.ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body).toString(),
  });
  res.end(body);
}

function sendText(res: http.ServerResponse, status: number, text: string) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function readJson(req: http.IncomingMessage) {
  const body = await readBody(req);
  if (!body.length) return {};
  try {
    return JSON.parse(body.toString('utf-8'));
  } catch {
    return {};
  }
}

function normalizeVfsPath(input: string | null) {
  let vfsPath = input || '/';
  if (vfsPath.startsWith('./')) {
    vfsPath = vfsPath.slice(1);
  }
  if (!vfsPath.startsWith('/')) {
    vfsPath = `/${vfsPath}`;
  }
  return vfsPath;
}

function resolveWorkspaceRoot(dataRoot: string) {
  const explicitWorkspaceRoot = process.env.MANGOU_WORKSPACE_ROOT;
  if (explicitWorkspaceRoot) {
    return path.resolve(explicitWorkspaceRoot);
  }
  const workspaceDir = configStore.get('workspaceDir');
  return path.resolve(dataRoot, workspaceDir);
}

function resolveProjectRoot(dataRoot: string, projectPath: string) {
  const workspaceRoot = resolveWorkspaceRoot(dataRoot);
  // projectPath must be relative to workspace root
  if (path.isAbsolute(projectPath)) {
    throw new Error('projectPath must be relative to workspace root');
  }
  const resolved = path.resolve(workspaceRoot, projectPath);
  const prefix = workspaceRoot.endsWith(path.sep) ? workspaceRoot : `${workspaceRoot}${path.sep}`;
  if (resolved !== workspaceRoot && !resolved.startsWith(prefix)) {
    throw new Error(`Project must be under workspace: ${workspaceRoot}`);
  }
  return resolved;
}

function handleMeta(appRoot: string, dataRoot: string, res: http.ServerResponse) {
  const workspaceDir = configStore.get('workspaceDir');
  const workspaceRoot = resolveWorkspaceRoot(dataRoot);
  return sendJson(res, 200, {
    success: true,
    data: {
      appRoot,
      dataRoot,
      workspaceDir,
      workspaceRoot,
    },
  });
}

async function handleVfsGet(dataRoot: string, req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  const action = url.searchParams.get('action');
  const projectId = url.searchParams.get('projectId') || 'demo';
  const vfsPath = normalizeVfsPath(url.searchParams.get('path'));
  const isAgentsPath = vfsPath === '/.agents' || vfsPath.startsWith('/.agents/');
  if (isAgentsPath && action !== 'list') {
    return sendJson(res, 404, { success: false, error: 'Ignored path' });
  }

  try {
    const projectRoot = resolveProjectRoot(dataRoot, projectId);
    if (action === 'list') {
      if (isAgentsPath) {
        return sendJson(res, 200, { success: true, entries: [] });
      }
      const fullPath = path.join(projectRoot, vfsPath);
      try {
        const stats = await fs.stat(fullPath);
        if (!stats.isDirectory()) {
          return sendJson(res, 200, { success: true, entries: [] });
        }
      } catch (error: any) {
        if (error?.code === 'ENOENT') {
          return sendJson(res, 200, { success: true, entries: [] });
        }
        throw error;
      }

      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const data = entries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file',
        path: path.join(vfsPath, e.name),
      }));
      return sendJson(res, 200, { success: true, entries: data });
    }

    if (action === 'read') {
      const fullPath = path.join(projectRoot, vfsPath);
      const stats = await fs.stat(fullPath);
      if (stats.isDirectory()) {
        return sendJson(res, 400, { success: false, error: 'Path is a directory', isDirectory: true });
      }
      const buffer = await fs.readFile(fullPath);
      let contentType = getContentTypeByPath(vfsPath);
      if (contentType === 'application/octet-stream') {
        const sniffed = sniffContentType(buffer.subarray(0, 32));
        if (sniffed) contentType = sniffed;
      }

      const normalized = normalizeContentType(contentType);
      const isText =
        normalized.startsWith('text/') ||
        normalized.includes('json') ||
        normalized.includes('yaml') ||
        normalized.includes('markdown');

      if (!isText || isMediaContentType(contentType)) {
        return sendJson(res, 415, { success: false, error: 'Binary file not supported', isBinary: true });
      }

      return sendJson(res, 200, { success: true, content: buffer.toString('utf-8') });
    }

    if (action === 'stat') {
      const fullPath = path.join(projectRoot, vfsPath);
      const stats = await fs.stat(fullPath);
      return sendJson(res, 200, {
        success: true,
        stats: {
          size: stats.size,
          mtime: stats.mtime,
          isDirectory: stats.isDirectory(),
        },
      });
    }

    const fullPath = path.join(projectRoot, vfsPath);
    const stats = await fs.stat(fullPath);
    if (stats.isDirectory()) {
      return sendJson(res, 400, { success: false, error: 'Path is a directory', isDirectory: true });
    }

    let contentType = getContentTypeByPath(vfsPath);
    if (contentType === 'application/octet-stream') {
      try {
        const handle = await fs.open(fullPath, 'r');
        const preview = Buffer.alloc(32);
        await handle.read(preview, 0, preview.length, 0);
        await handle.close();
        const sniffed = sniffContentType(preview);
        if (sniffed) contentType = sniffed;
      } catch {
        // ignore
      }
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': getCacheControlByContentType(contentType),
    });
    fsSync.createReadStream(fullPath).pipe(res);
    return;
  } catch (error: any) {
    log(`[VFS API Error] ${action ?? 'default'} ${vfsPath}:`, error?.message);
    return sendJson(res, 404, { success: false, error: error?.message || 'Not Found' });
  }
}

async function handleVfsPost(dataRoot: string, req: http.IncomingMessage, res: http.ServerResponse) {
  const body = await readJson(req);
  let { action, projectId = 'demo', path: vfsPath, content } = body;
  vfsPath = normalizeVfsPath(typeof vfsPath === 'string' ? vfsPath : '/');
  if (vfsPath.startsWith('/.agents')) {
    return sendJson(res, 404, { success: false, error: 'Ignored path' });
  }
  try {
    const projectRoot = resolveProjectRoot(dataRoot, projectId);
    if (action === 'write') {
      const fullPath = path.join(projectRoot, vfsPath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
      return sendJson(res, 200, { success: true });
    }
    if (action === 'mkdir') {
      const fullPath = path.join(projectRoot, vfsPath);
      await fs.mkdir(fullPath, { recursive: true });
      return sendJson(res, 200, { success: true });
    }
    if (action === 'delete') {
      const fullPath = path.join(projectRoot, vfsPath);
      await fs.rm(fullPath, { recursive: true, force: true });
      return sendJson(res, 200, { success: true });
    }
  } catch (error: any) {
    return sendJson(res, 500, { success: false, error: error?.message || 'Write failed' });
  }

  return sendJson(res, 400, { success: false, error: 'Invalid POST action' });
}

async function handleVfsPut(dataRoot: string, req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  try {
    const projectId = url.searchParams.get('projectId') || 'demo';
    const vfsPath = normalizeVfsPath(url.searchParams.get('path'));
    if (vfsPath.startsWith('/.agents')) {
      return sendJson(res, 404, { success: false, error: 'Ignored path' });
    }
    const projectRoot = resolveProjectRoot(dataRoot, projectId);
    const fullPath = path.join(projectRoot, vfsPath);

    const contentType = req.headers['content-type'] || '';
    const body = await readBody(req);
    const content = contentType.includes('application/json')
      ? JSON.stringify(JSON.parse(body.toString('utf-8')))
      : body.toString('utf-8');

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
    return sendJson(res, 200, { success: true });
  } catch (error: any) {
    return sendJson(res, 500, { success: false, error: error?.message || 'Write failed' });
  }
}

async function handleVfsEvents(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const projectId = url.searchParams.get('projectId') || '';
  bindVfsEventsOnce();
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('event: ready\ndata: {}\n\n');

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  const client = { res, projectId };
  vfsSseClients.add(client);

  req.on('close', () => {
    clearInterval(heartbeat);
    vfsSseClients.delete(client);
  });
}

async function handleLog(dataRoot: string, req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method not allowed' });
  }
  const body = await readJson(req);
  const projectId = String(body.projectId || 'demo');
  const message = typeof body.message === 'string' ? body.message : '';
  const level = typeof body.level === 'string' ? body.level : 'info';
  const event = body.event && typeof body.event === 'object' ? body.event : null;

  try {
    const projectRoot = resolveProjectRoot(dataRoot, projectId);
    if (event) {
      const snapshot = await appendTaskEvent(projectRoot, event);
      broadcastLog({ projectId, snapshot });
      return sendJson(res, 200, { success: true, data: snapshot });
    }
    if (!message) {
      return sendJson(res, 400, { success: false, error: 'Missing message or event' });
    }
    const snapshot = await appendTaskEvent(projectRoot, {
      type: 'log',
      status: 'success',
      provider: 'bridge',
      input: { message, level },
      ref: body.ref || '',
      event: 'note',
      worker: body.worker || 'bridge',
    });
    broadcastLog({ projectId, snapshot });
    return sendJson(res, 200, { success: true, data: snapshot });
  } catch (error: any) {
    return sendJson(res, 500, { success: false, error: error?.message || 'Log failed' });
  }
}

async function handleProjects(dataRoot: string, req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.method === 'GET') {
    try {
      const projects = await ProjectManager.listProjects();
      return sendJson(res, 200, {
        success: true,
        projects: projects.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          video_url: p.videoUrl || null,
          created_at: p.createdAt,
          updated_at: p.updatedAt,
        })),
      });
    } catch (error: any) {
      log('[API-Error] Failed to list projects:', error?.message);
      return sendJson(res, 500, { success: false, error: error?.message || 'Failed to list projects' });
    }
  }
  return sendJson(res, 405, { success: false, error: 'Method not allowed' });
}

async function handleProjectItem(dataRoot: string, req: http.IncomingMessage, res: http.ServerResponse, projectId: string) {
  if (!projectId) {
    return sendJson(res, 400, { success: false, error: 'Project ID is missing' });
  }

  if (req.method === 'GET') {
    try {
      const project = await ProjectManager.getProject(projectId);
      if (!project) {
        return sendJson(res, 404, { success: false, error: 'Project not found' });
      }
      return sendJson(res, 200, {
        success: true,
        project: {
          id: project.id,
          name: project.name,
          description: project.description || '',
          video_url: project.videoUrl || null,
          created_at: project.createdAt,
          updated_at: project.updatedAt,
        },
        assets: [],
        storyboards: [],
        keyframes: [],
        videos: [],
      });
    } catch (error: any) {
      log(`[Project API Error] ${projectId}:`, error?.message);
      return sendJson(res, 500, { success: false, error: error?.message || 'Project error' });
    }
  }

  return sendJson(res, 405, { success: false, error: 'Method not allowed' });
}

async function handleProjectSnapshot(dataRoot: string, res: http.ServerResponse, projectId: string) {
  if (!projectId) {
    return sendJson(res, 400, { success: false, error: 'Project ID is missing' });
  }

  try {
    const projectRoot = resolveProjectRoot(dataRoot, projectId);
    const snapshot = await buildProjectSnapshot(projectId, projectRoot);
    return sendJson(res, 200, { success: true, snapshot });
  } catch (error: any) {
    log(`[Project Snapshot Error] ${projectId}:`, error?.message);
    return sendJson(res, 500, { success: false, error: error?.message || 'Snapshot failed' });
  }
}

async function handleTasks(dataRoot: string, req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  try {
    if (req.method === 'GET') {
      const projectPath = url.searchParams.get('projectPath');
      if (!projectPath) return sendJson(res, 400, { success: false, error: 'Missing projectPath' });
      const projectRoot = resolveProjectRoot(dataRoot, projectPath);
      const tasks = await listLatestTasks(projectRoot);
      return sendJson(res, 200, { success: true, data: tasks });
    }
    if (req.method === 'POST') {
      const body = await readJson(req);
      const { projectPath, ...event } = body;
      if (!projectPath) return sendJson(res, 400, { success: false, error: 'Missing projectPath' });
      const projectRoot = resolveProjectRoot(dataRoot, projectPath);
      const snapshot = await appendTaskEvent(projectRoot, event);
      return sendJson(res, 200, { success: true, data: snapshot });
    }
  } catch (error: any) {
    return sendJson(res, 500, { success: false, error: error?.message || 'Tasks failed' });
  }
  return sendJson(res, 405, { success: false, error: 'Method not allowed' });
}

async function handleTaskItem(dataRoot: string, req: http.IncomingMessage, res: http.ServerResponse, url: URL, id: string) {
  try {
    if (req.method === 'GET') {
      const projectPath = url.searchParams.get('projectPath');
      if (!projectPath) return sendJson(res, 400, { success: false, error: 'Missing projectPath' });
      const projectRoot = resolveProjectRoot(dataRoot, projectPath);
      const task = await getTaskById(projectRoot, id);
      return sendJson(res, 200, { success: true, data: task || {} });
    }
    if (req.method === 'PATCH') {
      const body = await readJson(req);
      const { projectPath, ...event } = body;
      if (!projectPath) return sendJson(res, 400, { success: false, error: 'Missing projectPath' });
      const projectRoot = resolveProjectRoot(dataRoot, projectPath);
      const snapshot = await appendTaskEvent(projectRoot, { ...event, id });
      return sendJson(res, 200, { success: true, data: snapshot });
    }
  } catch (error: any) {
    return sendJson(res, 500, { success: false, error: error?.message || 'Task failed' });
  }
  return sendJson(res, 405, { success: false, error: 'Method not allowed' });
}

async function handleYamlSyncLatest(dataRoot: string, req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { success: false, error: 'Method not allowed' });
  try {
    const body = await readJson(req);
    const { projectPath, taskId, upstreamTaskId, status, output, yamlPath, taskType, error } = body;
    if (!projectPath || !yamlPath || !taskType) {
      return sendJson(res, 400, { success: false, error: 'Missing required sync fields' });
    }
    const projectRoot = resolveProjectRoot(dataRoot, projectPath);
    const fullYamlPath = path.join(projectRoot, yamlPath);
    const content = await fs.readFile(fullYamlPath, 'utf-8');
    
    // Using internal yaml utility
    const updatedContent = updateGenerationStatus(content, taskType as 'image' | 'video', {
      status,
      output: Array.isArray(output?.files) ? output.files[0] : (typeof output === 'string' ? output : null),
      error: typeof error === 'string' ? error : (error?.message || null),
      task_id: taskId,
      upstream_task_id: upstreamTaskId,
    });
    
    await fs.writeFile(fullYamlPath, updatedContent, 'utf-8');
    return sendJson(res, 200, { success: true });
  } catch (error: any) {
    return sendJson(res, 500, { success: false, error: error?.message || 'Sync failed' });
  }
}

async function handleWorkspace(dataRoot: string, res: http.ServerResponse) {
  const workspaceDir = configStore.get('workspaceDir');
  const projectsRoot = resolveWorkspaceRoot(dataRoot);
  const workspaceRoot = process.env.MANGOU_HOME ? path.resolve(process.env.MANGOU_HOME) : path.dirname(projectsRoot);
  return sendJson(res, 200, {
    success: true,
    data: {
      root: workspaceRoot,
      projectsRoot,
      workspaceDir,
    },
  });
}

async function handleProjectStitch(dataRoot: string, req: http.IncomingMessage, res: http.ServerResponse, projectId: string) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method not allowed' });
  }
  try {
    const workspaceRoot = resolveWorkspaceRoot(dataRoot);
    const projectRoot = resolveProjectRoot(dataRoot, projectId);
    const storyboardsDir = path.join(projectRoot, 'storyboards');
    const files = await fs.readdir(storyboardsDir).catch(() => []);

    const entries = await Promise.all(
      files
        .filter((name) => name.endsWith('.yaml') || name.endsWith('.yml'))
        .map(async (name) => {
          const filePath = path.join(storyboardsDir, name);
          const content = await fs.readFile(filePath, 'utf-8');
          const data = parseYAML(content);
          const sequence = Number(data?.content?.sequence ?? 0);
          const output = data?.tasks?.video?.latest?.output as string | undefined;
          const status = data?.tasks?.video?.latest?.status as string | undefined;
          return { sequence, output, status };
        })
    );

    const videoUrls = entries
      .filter((e) => e.output && e.status === 'completed')
      .sort((a, b) => a.sequence - b.sequence)
      .map((e) => e.output as string);

    if (videoUrls.length === 0) {
      throw new Error('No videos found to stitch');
    }

    const outputPath = await stitchVideosLocal(projectRoot, videoUrls, 'output.mp4');

    const pm = new ProjectManager(workspaceRoot);
    await pm.init();
    await pm.updateProjectVideoUrl(projectId, outputPath);

    return sendJson(res, 200, { success: true, url: outputPath });
  } catch (error: any) {
    return sendJson(res, 500, { success: false, error: error?.message || 'Stitch failed' });
  }
}

function getStaticContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.map':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.ico':
      return 'image/x-icon';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

async function serveStatic(appRoot: string, req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  const distDir = path.join(appRoot, 'dist');
  const requestedPath = decodeURIComponent(url.pathname);
  const safePath = requestedPath.replace(/^\/+/, '');
  const targetPath = path.join(distDir, safePath);
  const normalized = path.normalize(targetPath);
  if (!normalized.startsWith(distDir)) {
    return sendText(res, 403, 'Forbidden');
  }

  try {
    const stats = await fs.stat(targetPath);
    if (stats.isFile()) {
      const contentType = getStaticContentType(targetPath);
      res.writeHead(200, { 'Content-Type': contentType });
      fsSync.createReadStream(targetPath).pipe(res);
      return;
    }
  } catch {
    // fallback to index.html
  }

  try {
    const indexPath = path.join(distDir, 'index.html');
    const content = await fs.readFile(indexPath);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(content);
  } catch {
    sendText(res, 500, 'Frontend not built. Run `npm run build`.');
  }
}

export function startHttpServer({ appRoot, dataRoot, port = 3000 }: ServerOptions) {
  const server = http.createServer(async (req, res) => {
    if (!req.url) {
      return sendText(res, 400, 'Bad Request');
    }
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const devProxyOrigin = process.env.MANGOU_DEV_PROXY_ORIGIN;

    if (pathname === '/api/tasks') {
      return handleTasks(dataRoot, req, res, url);
    }
    if (pathname.startsWith('/api/tasks/')) {
      const parts = pathname.split('/').filter(Boolean);
      const taskId = parts[2];
      return handleTaskItem(dataRoot, req, res, url, taskId);
    }
    if (pathname === '/api/yaml/sync-latest') {
      return handleYamlSyncLatest(dataRoot, req, res);
    }
    if (pathname === '/api/workspace') {
      return handleWorkspace(dataRoot, res);
    }

    if (pathname === '/api/vfs') {
      if (req.method === 'GET') return handleVfsGet(dataRoot, req, res, url);
      if (req.method === 'POST') return handleVfsPost(dataRoot, req, res);
      if (req.method === 'PUT') return handleVfsPut(dataRoot, req, res, url);
      return sendJson(res, 405, { success: false, error: 'Method not allowed' });
    }

    if (pathname === '/api/meta') {
      return handleMeta(appRoot, dataRoot, res);
    }

    if (pathname === '/api/log') {
      return handleLog(dataRoot, req, res);
    }

    if (pathname === '/api/projects') {
      return handleProjects(dataRoot, req, res);
    }

    if (pathname.startsWith('/api/vfs/events')) {
      return handleVfsEvents(req, res);
    }

    if (pathname.startsWith('/api/projects/')) {
      const parts = pathname.split('/').filter(Boolean);
      const projectId = parts[2] || '';
      const sub = parts[3];

      if (sub === 'snapshot' && req.method === 'GET') {
        return handleProjectSnapshot(dataRoot, res, projectId);
      }
      
      if (sub === 'tasks') {
        if (req.method === 'GET') {
          const projectRoot = resolveProjectRoot(dataRoot, projectId);
          const tasks = await listLatestTasks(projectRoot);
          return sendJson(res, 200, { success: true, tasks });
        }
        if (req.method === 'POST') {
          const body = await readJson(req);
          const projectRoot = resolveProjectRoot(dataRoot, projectId);
          const snapshot = await appendTaskEvent(projectRoot, body);
          return sendJson(res, 200, { success: true, task: snapshot });
        }
      }
      
      if (sub === 'stitch') {
        return handleProjectStitch(dataRoot, req, res, projectId);
      }
      
      return handleProjectItem(dataRoot, req, res, projectId);
    }

    if (devProxyOrigin && req.method && ['GET', 'HEAD'].includes(req.method)) {
      return proxyToDevServer(req, res, devProxyOrigin, url);
    }

    return serveStatic(appRoot, req, res, url);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      log(
        `Web server failed to start: port ${port} is already in use. ` +
          `Free the port or set MANGOU_WEB_PORT to another port.`
      );
      return;
    }
    log('Web server failed to start', error);
  });

  server.listen(port, () => {
    log(`Web server running at http://localhost:${port}`);
  });

  return server;
}

async function proxyToDevServer(req: http.IncomingMessage, res: http.ServerResponse, origin: string, url: URL) {
  const targetUrl = new URL(origin);
  const isHttps = targetUrl.protocol === 'https:';
  const proxyModule = isHttps ? https : http;
  const headers = { ...req.headers };
  headers.host = targetUrl.host;

  const options: http.RequestOptions = {
    protocol: targetUrl.protocol,
    hostname: targetUrl.hostname,
    port: targetUrl.port,
    method: req.method,
    path: url.pathname + url.search,
    headers,
  };

  return new Promise<void>((resolve) => {
    const proxyReq = proxyModule.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
      proxyRes.on('end', () => resolve());
    });

    proxyReq.on('error', () => {
      sendText(res, 502, 'Bad Gateway');
      resolve();
    });

    req.pipe(proxyReq);
  });
}

// 自动启动逻辑（仅在直接执行当前脚本时运行）。
// 不要用 TSX_TSCONFIG_PATH 这类环境变量做判断，否则打包进 skill 后会被误触发。
const isEntrypoint =
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  const appRoot = path.resolve(process.cwd());
  const dataRoot = process.env.MANGOU_HOME || appRoot;
  const port = Number(process.env.MANGOU_WEB_PORT || process.env.PORT || '3000');
  
  startHttpServer({
    appRoot,
    dataRoot,
    port,
  });
}
