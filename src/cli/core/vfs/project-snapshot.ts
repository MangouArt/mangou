import fs from 'fs/promises';
import path from 'path';
import type { VFSProjectSnapshot } from './adapter';
import { getContentTypeByPath } from './server-utils';
import { isMediaContentType } from '../file-type';

const IGNORE_DIRS = new Set(['node_modules', '.git', '.agent_logs', '.agents', 'output', '.next']);

export async function buildProjectSnapshot(projectId: string, projectRoot: string): Promise<VFSProjectSnapshot> {
  const files: VFSProjectSnapshot['files'] = [];
  await collectSnapshotFiles(projectRoot, '/', files);
  return {
    projectId,
    generatedAt: new Date().toISOString(),
    files,
  };
}

async function collectSnapshotFiles(
  projectRoot: string,
  vfsPath: string,
  files: VFSProjectSnapshot['files']
): Promise<void> {
  const currentPath = vfsPath === '/' ? projectRoot : path.join(projectRoot, vfsPath.slice(1));
  const entries = await fs.readdir(currentPath, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) {
      continue;
    }

    const nextVfsPath = vfsPath === '/' ? `/${entry.name}` : `${vfsPath}/${entry.name}`;
    if (entry.isDirectory()) {
      await collectSnapshotFiles(projectRoot, nextVfsPath, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const contentType = getContentTypeByPath(nextVfsPath);
    if (isMediaContentType(contentType)) {
      continue;
    }

    const physicalPath = path.join(projectRoot, nextVfsPath.slice(1));
    const content = await fs.readFile(physicalPath, 'utf-8').catch(() => null);
    if (content === null) {
      continue;
    }
    files.push({ path: nextVfsPath, content });
  }

  // Sort files by path for determinism (important for tests and Agent stability)
  files.sort((a, b) => a.path.localeCompare(b.path));
}
