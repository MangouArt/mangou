#!/usr/bin/env node

import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const distRoot = path.join(packageRoot, 'dist');
const port = Number(process.env.PORT || 3010);
const apiOrigin = process.env.MANGOU_API_ORIGIN || 'http://127.0.0.1:3000';

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
]);

function getMimeType(filePath) {
  return MIME_TYPES.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

async function serveFile(res, filePath) {
  const content = await fs.readFile(filePath);
  send(res, 200, content, {
    'Content-Type': getMimeType(filePath),
    'Cache-Control': filePath.endsWith('.html') ? 'no-cache' : 'public, max-age=3600',
  });
}

async function readRequestBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function proxyApi(req, res) {
  const upstreamUrl = new URL(req.url, apiOrigin);
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      headers.set(key, value.join(', '));
      continue;
    }
    if (value !== undefined) {
      headers.set(key, value);
    }
  }

  const requestBody =
    req.method === 'GET' || req.method === 'HEAD' ? undefined : await readRequestBody(req);

  const upstream = await fetch(upstreamUrl, {
    method: req.method,
    headers,
    body: requestBody,
    duplex: requestBody ? 'half' : undefined,
  });

  const responseHeaders = {};
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') return;
    responseHeaders[key] = value;
  });

  const body = Buffer.from(await upstream.arrayBuffer());
  send(res, upstream.status, body, responseHeaders);
}

async function resolveStaticPath(urlPath) {
  const pathname = decodeURIComponent(new URL(urlPath, 'http://127.0.0.1').pathname);
  const candidate = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(distRoot, candidate);
  const normalized = path.normalize(filePath);

  if (!normalized.startsWith(distRoot)) {
    return null;
  }

  try {
    const stat = await fs.stat(normalized);
    if (stat.isFile()) return normalized;
  } catch {
    if (!candidate.endsWith('.html')) {
      return path.join(distRoot, 'index.html');
    }
  }

  return path.join(distRoot, 'index.html');
}

async function main() {
  try {
    await fs.access(path.join(distRoot, 'index.html'));
  } catch {
    console.error(`[mangou-dashboard] Missing dist/ under ${distRoot}`);
    process.exit(1);
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (!req.url) {
        send(res, 400, 'Bad Request');
        return;
      }

      if (req.url.startsWith('/api/')) {
        await proxyApi(req, res);
        return;
      }

      const staticPath = await resolveStaticPath(req.url);
      if (!staticPath) {
        send(res, 404, 'Not Found');
        return;
      }

      await serveFile(res, staticPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      send(res, 500, `mangou-dashboard error: ${message}`, {
        'Content-Type': 'text/plain; charset=utf-8',
      });
    }
  });

  server.on('error', (error) => {
    console.error('[mangou-dashboard] Server error:', error);
    process.exit(1);
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  server.listen(port, '127.0.0.1', () => {
    console.log(`[mangou-dashboard] Serving ${distRoot}`);
    console.log(`[mangou-dashboard] Dashboard: http://127.0.0.1:${port}`);
    console.log(`[mangou-dashboard] API proxy: ${apiOrigin}`);
  });
}

main().catch((error) => {
  console.error('[mangou-dashboard] Fatal:', error);
  process.exit(1);
});
