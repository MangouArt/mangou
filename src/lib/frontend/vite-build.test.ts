import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { build } from 'vite';

async function cleanup(dir: string) {
  if (!dir) return;
  await fs.rm(dir, { recursive: true, force: true });
}

describe('Vite frontend', () => {
  let outDir = '';

  afterEach(async () => {
    await cleanup(outDir);
    outDir = '';
  });

  it(
    'builds the lightweight frontend bundle',
    { timeout: 30000 },
    async () => {
      outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-vite-build-'));

      await build({
        configFile: path.resolve(process.cwd(), 'vite.config.ts'),
        logLevel: 'silent',
        build: {
          outDir,
          emptyOutDir: true,
          minify: false,
        },
      });

      const indexHtml = await fs.readFile(path.join(outDir, 'index.html'), 'utf-8');
      expect(indexHtml).toContain('<div id="root"></div>');
      expect(indexHtml).toContain('/assets/');

      const assetsDir = path.join(outDir, 'assets');
      const assetFiles = await fs.readdir(assetsDir);
      expect(assetFiles.some((file) => file.endsWith('.js'))).toBe(true);
      expect(assetFiles.some((file) => file.endsWith('.css'))).toBe(true);
    }
  );
});
