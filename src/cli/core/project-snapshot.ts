import fs from 'fs/promises';
import path from 'path';
import { getContentTypeByPath } from './server-utils';
import { isMediaContentType } from './file-type';

export interface VFSFileSnapshot {
  path: string;
  content: string; // Base64 for media, UTF-8 for text
}

export interface VFSProjectSnapshot {
  projectId: string;
  files: VFSFileSnapshot[];
}

const IGNORE_DIRS = new Set(['node_modules', '.git', '.agent_logs', '.agents', 'output', '.next']);

export async function buildProjectSnapshot(projectId: string, projectRoot: string): Promise<VFSProjectSnapshot> {
  const files: VFSFileSnapshot[] = [];
  await walkDir(projectRoot, '', files);
  return { projectId, files };
}

async function walkDir(fullDir: string, vfsPath: string, files: VFSFileSnapshot[]) {
  const entries = await fs.readdir(fullDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.env') continue;
    if (IGNORE_DIRS.has(entry.name)) continue;

    const fullPath = path.join(fullDir, entry.name);
    const nextVfsPath = vfsPath ? `${vfsPath}/${entry.name}` : `/${entry.name}`;

    if (entry.isDirectory()) {
      await walkDir(fullPath, nextVfsPath, files);
      continue;
    }

    const contentType = getContentTypeByPath(entry.name);
    const isMedia = isMediaContentType(contentType);

    let content: string | null = null;
    try {
      if (isMedia) {
        const buffer = await fs.readFile(fullPath);
        content = buffer.toString('base64');
      } else {
        content = await fs.readFile(fullPath, 'utf-8');
      }
    } catch {
      continue;
    }

    if (content === null) continue;
    files.push({ path: nextVfsPath, content });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
}
