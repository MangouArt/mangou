#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function main() {
  const vitePort = Number(process.env.VITE_PORT ?? '5173');
  const devProxyOrigin = process.env.MANGOU_DEV_PROXY_ORIGIN ?? `http://localhost:${vitePort}`;

  const envBase = {
    ...process.env,
    MANGOU_HOME: process.env.MANGOU_HOME ?? rootDir,
    MANGOU_DEV_PROXY_ORIGIN: devProxyOrigin,
    TSX_TSCONFIG_PATH: path.resolve(rootDir, 'tsconfig.json'),
  };
  console.log(`[mangou-dev] Vite: http://localhost:${vitePort}`);

  const viteProcess = spawn(
    process.execPath,
    [path.resolve(rootDir, 'node_modules/vite/bin/vite.js'), '--port', String(vitePort)],
    {
      stdio: 'inherit',
      env: envBase,
    }
  );

  const shutdown = (signal) => {
    if (!viteProcess.killed) {
      viteProcess.kill(signal);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  viteProcess.on('exit', (code) => {
    if (code && code !== 0) {
      process.exit(code);
    }
  });
}

main().catch((error) => {
  console.error('[mangou-dev] Failed to start dev environment', error);
  process.exit(1);
});
