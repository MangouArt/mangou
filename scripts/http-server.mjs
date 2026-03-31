#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';
import { startHttpServer } from './http-server.ts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const dataRoot = process.env.MANGOU_HOME || process.cwd();
const port = Number(process.env.MANGOU_WEB_PORT || process.env.PORT || '3000');

startHttpServer({
  appRoot,
  dataRoot,
  port,
});
