import fs from 'fs/promises';
import path from 'path';

const packageRoot = path.resolve(import.meta.dirname, '..');
const sourceDist = path.join(packageRoot, 'dist');
const dashboardPackageRoot = path.join(packageRoot, 'packages', 'dashboard');
const targetDist = path.join(dashboardPackageRoot, 'dist');

async function copyDir(src, dest) {
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

await fs.access(sourceDist);
await fs.rm(targetDist, { recursive: true, force: true });
await copyDir(sourceDist, targetDist);

console.log(`[sync-dashboard-package] Copied ${sourceDist} -> ${targetDist}`);
