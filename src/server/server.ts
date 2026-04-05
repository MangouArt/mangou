import http from 'http';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { ProjectManager } from '@core/project-manager';
import { getContentTypeByPath, getCacheControlByContentType } from '@core/server-utils';
import yaml from 'js-yaml';
import type { Asset, Storyboard } from '@core/schema';

type ServerOptions = {
  appRoot: string;
  dataRoot: string;
  port?: number;
};

function log(...args: unknown[]) {
  console.error('[mangou-mirror]', ...args);
}

const ASSET_TYPES = new Set<Asset['type']>(['character', 'scene', 'prop']);

type SseClient = { res: http.ServerResponse; projectId: string };
const sseClients = new Set<SseClient>();

function sendSse(res: http.ServerResponse, event: string, payload: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * Real-time File Watcher
 */
function startWatcher(dataRoot: string) {
  if (!fsSync.existsSync(dataRoot)) {
    log(`Warning: Watcher target directory does not exist: ${dataRoot}. Watcher disabled.`);
    return;
  }
  log(`Watching for changes in: ${dataRoot}`);
  fsSync.watch(dataRoot, { recursive: true }, async (event, filename) => {
    if (!filename || filename.includes('.git') || filename.includes('node_modules')) return;
    const relPath = filename.split(path.sep).join('/');
    const projectId = relPath.split('/')[0];
    
    if (filename.endsWith('.yaml') || isMediaFile(filename)) {
      broadcast('file_change', { projectId, path: relPath, timestamp: Date.now() }, projectId);
    }
  });
}

function isMediaFile(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.mp4', '.webp'].includes(ext);
}

function broadcast(event: string, payload: any, projectId: string) {
  for (const client of sseClients) {
    if (client.projectId && client.projectId !== projectId) continue;
    sendSse(client.res, event, payload);
  }
}

/**
 * Data Adapter: YAML -> UI Schema
 */
export async function getProjectUIData(projectRoot: string, projectId: string) {
  const assets: Asset[] = [];
  const storyboards: Storyboard[] = [];

  // 1. Load Assets
  for (const assetPath of await collectYamlFiles(path.join(projectRoot, 'asset_defs'))) {
    const raw = await fs.readFile(assetPath, 'utf-8');
    const doc = yaml.load(raw) as any;
    const assetType = doc?.meta?.type;
    if (!ASSET_TYPES.has(assetType)) {
      const relPath = path.relative(projectRoot, assetPath) || assetPath;
      throw new Error(`Invalid asset type in ${relPath}. Expected meta.type to be one of: character, scene, prop.`);
    }
    assets.push({
      id: doc.meta?.id || path.basename(assetPath, '.yaml'),
      project_id: projectId,
      type: assetType,
      name: doc.content?.name || path.basename(assetPath),
      description: doc.content?.description || null,
      status: doc.tasks?.image?.latest?.status || 'pending',
      image_url: doc.tasks?.image?.latest?.output || null,
      version: doc.meta?.version || '1.0',
      metadata: doc.meta || {},
      created_at: new Date().toISOString()
    });
  }

  // 2. Load Storyboards
  const sbDir = path.join(projectRoot, 'storyboards');
  try {
    const files = await fs.readdir(sbDir);
    for (const file of files) {
      if (!file.endsWith('.yaml')) continue;
      const raw = await fs.readFile(path.join(sbDir, file), 'utf-8');
      const doc = yaml.load(raw) as any;
      storyboards.push({
        id: doc.meta?.id || path.basename(file, '.yaml'),
        project_id: projectId,
        sequence_number: doc.content?.sequence || 0,
        title: doc.content?.title || file,
        description: doc.content?.story || null,
        prompt: doc.tasks?.image?.params?.prompt || null,
        image_url: doc.tasks?.image?.latest?.output || null,
        video_url: doc.tasks?.video?.latest?.output || null,
        status: doc.tasks?.video?.latest?.status === 'completed' ? 'completed' : (doc.tasks?.image?.latest?.status === 'completed' ? 'completed' : 'pending'),
        asset_ids: doc.refs?.characters || [],
        grid: doc.meta?.grid || null,
        parentId: doc.meta?.parent || null,
        tasks: doc.tasks || {},
        metadata: doc.meta || {},
        created_at: new Date().toISOString()
      });
    }
  } catch {}

  storyboards.sort((a, b) => a.sequence_number - b.sequence_number);
  return { assets, storyboards };
}

async function collectYamlFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectYamlFiles(entryPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.yaml')) {
      files.push(entryPath);
    }
  }

  return files;
}

export function createProjectManager(dataRoot: string) {
  return new ProjectManager({
    workspaceRoot: path.dirname(dataRoot),
    projectsRoot: dataRoot,
  });
}

function sendJson(res: http.ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

export function startHttpServer({ appRoot, dataRoot, port = 3000 }: ServerOptions): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const projectManager = createProjectManager(dataRoot);
    const server = http.createServer(async (req, res) => {
      if (!req.url) return res.end();
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const pathname = url.pathname;

      // API: Proxy media and YAML via VFS URL
      if (pathname === '/api/vfs') {
        const projectId = url.searchParams.get('projectId');
        const relPath = url.searchParams.get('path');
        if (!projectId || !relPath) return sendJson(res, 400, { error: 'Missing params' });
        const fullPath = path.join(dataRoot, projectId, relPath);
        try {
          const contentType = getContentTypeByPath(relPath);
          res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': getCacheControlByContentType(contentType) });
          fsSync.createReadStream(fullPath).pipe(res);
          return;
        } catch { return sendJson(res, 404, { error: 'Not found' }); }
      }

      // API: SSE Events
      if (pathname === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        const client = { res, projectId: url.searchParams.get('projectId') || '' };
        sseClients.add(client);
        req.on('close', () => sseClients.delete(client));
        return;
      }

      // API: Structured Project Snapshot
      if (pathname.startsWith('/api/projects/')) {
        const projectId = pathname.split('/')[2];
        try {
          if (pathname.endsWith('/snapshot')) {
            const projectRoot = path.join(dataRoot, projectId);
            const data = await getProjectUIData(projectRoot, projectId);
            return sendJson(res, 200, { success: true, ...data });
          }
          if (projectId) {
            const project = await projectManager.getProject(projectId);
            if (!project) {
              return sendJson(res, 404, { success: false, error: 'Project not found' });
            }
            const projectRoot = path.join(dataRoot, projectId);
            const data = await getProjectUIData(projectRoot, projectId);
            return sendJson(res, 200, { success: true, project, ...data, keyframes: [], videos: [] });
          }
        } catch (error: any) {
          return sendJson(res, 500, { success: false, error: error.message || 'Failed to load project data' });
        }
      }

      // API: Projects List
      if (pathname === '/api/projects') {
        const projects = await projectManager.listProjects();
        return sendJson(res, 200, { success: true, projects });
      }

      if (pathname === '/api/meta') {
        return sendJson(res, 200, {
          success: true,
          data: {
            appRoot,
            dataRoot,
          },
        });
      }

      // Static SPA
      return serveStatic(appRoot, req, res, url);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        log(`Error: Port ${port} is already in use.`);
      } else {
        log(`Server error: ${err.message}`);
      }
      reject(err);
    });

    server.listen(port, '127.0.0.1', () => {
      log(`Readonly mirror server running at http://127.0.0.1:${port}`);
      startWatcher(dataRoot);
      resolve(server);
    });
  });
}

async function serveStatic(appRoot: string, req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  const distDir = path.join(appRoot, 'dist');
  const requestedPath = decodeURIComponent(url.pathname);
  const targetPath = path.join(distDir, requestedPath === '/' ? 'index.html' : requestedPath);
  try {
    const stats = await fs.stat(targetPath);
    if (stats.isFile()) {
      res.writeHead(200, { 'Content-Type': getStaticContentType(targetPath) });
      fsSync.createReadStream(targetPath).pipe(res);
      return;
    }
  } catch {}
  try {
    const content = await fs.readFile(path.join(distDir, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(content);
  } catch { 
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(FALLBACK_HTML); 
  }
}

const FALLBACK_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Mangou AI Studio - Server Status</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { background: #09090b; color: #fafafa; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; box-sizing: border-box; }
    .card { background: #18181b; border: 1px solid #27272a; padding: 2.5rem; border-radius: 0.75rem; text-align: center; max-width: 480px; width: 100%; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4); }
    h1 { color: #f4f4f5; margin-bottom: 1.5rem; font-size: 1.5rem; letter-spacing: -0.025em; }
    p { color: #a1a1aa; line-height: 1.6; margin: 1rem 0; font-size: 0.95rem; }
    code { background: #27272a; padding: 0.2rem 0.45rem; border-radius: 0.375rem; color: #e4e4e7; font-family: monospace; font-size: 0.9em; }
    .status { display: inline-flex; align-items: center; background: rgba(34, 197, 94, 0.1); color: #4ade80; padding: 0.35rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 500; margin-bottom: 1.5rem; }
    .dot { width: 8px; height: 8px; background: currentColor; border-radius: 50%; margin-right: 0.5rem; }
    hr { border: 0; border-top: 1px solid #27272a; margin: 2rem 0; }
    a { color: #3b82f6; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="status"><span class="dot"></span>Server Active</div>
    <h1>Mangou CLI Server</h1>
    <p>Readonly mirror server is running, but the frontend was not detected in <code>dist/</code>.</p>
    <p>Run <code>bun run build</code> in the source directory to enable the full visual dashboard.</p>
    <hr>
    <p style="font-size: 0.85rem;">API is live at <a href="/api/projects"><code>/api/projects</code></a></p>
  </div>
</body>
</html>
`;

function getStaticContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  const types: any = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png' };
  return types[ext] || 'application/octet-stream';
}
