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
async function getProjectUIData(projectRoot: string, projectId: string) {
  const assets: Asset[] = [];
  const storyboards: Storyboard[] = [];

  // 1. Load Assets
  const assetTypes = ['chars', 'scenes', 'props'];
  for (const type of assetTypes) {
    const dir = path.join(projectRoot, 'asset_defs', type);
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (!file.endsWith('.yaml')) continue;
        const raw = await fs.readFile(path.join(dir, file), 'utf-8');
        const doc = yaml.load(raw) as any;
        assets.push({
          id: doc.meta?.id || path.basename(file, '.yaml'),
          project_id: projectId,
          type: (type === 'chars' ? 'character' : type === 'scenes' ? 'scene' : 'prop') as Asset['type'],
          name: doc.content?.name || file,
          description: doc.content?.description || null,
          status: doc.tasks?.image?.latest?.status || 'pending',
          image_url: doc.tasks?.image?.latest?.output || null,
          version: doc.meta?.version || '1.0',
          metadata: doc.meta || {},
          created_at: new Date().toISOString()
        });
      }
    } catch {}
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

function sendJson(res: http.ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

export function startHttpServer({ appRoot, dataRoot, port = 3000 }: ServerOptions) {
  startWatcher(dataRoot);

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
      if (pathname.endsWith('/snapshot')) {
        const projectRoot = path.join(dataRoot, projectId);
        const data = await getProjectUIData(projectRoot, projectId);
        return sendJson(res, 200, { success: true, ...data });
      }
    }

    // API: Projects List
    if (pathname === '/api/projects') {
      const projects = await ProjectManager.listProjects();
      return sendJson(res, 200, { success: true, projects });
    }

    // Static SPA
    return serveStatic(appRoot, req, res, url);
  });

  server.listen(port, () => log(`Readonly mirror server running at http://localhost:${port}`));
  return server;
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
  } catch { res.end('Frontend not built.'); }
}

function getStaticContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  const types: any = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png' };
  return types[ext] || 'application/octet-stream';
}
