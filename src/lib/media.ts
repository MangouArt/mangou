import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getExtensionForContentType, isMediaContentType, normalizeContentType, sniffContentType } from './file-type';
import { configStore } from './config-store';

function resolveAppRoot(): string {
  const envRoot = process.env.MANGOU_HOME;
  if (envRoot && envRoot.trim()) {
    return path.resolve(envRoot.trim());
  }
  return process.cwd();
}

function getWorkspaceRoot(): string {
  const workspaceDir = configStore.get('workspaceDir') || 'projects';
  return path.resolve(resolveAppRoot(), workspaceDir);
}

/**
 * Downloads an image from a URL and saves it to the local workspace.
 * Returns the VFS relative path (e.g., /assets/generated/xxx.png).
 */
export async function saveImageFromUrl(
  url: string, 
  projectId: string, 
  prefix: string = 'generated'
): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from URL: ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  // Generate a unique filename based on content hash
  const hash = crypto.createHash('sha1').update(buffer).digest('hex');
  let contentType = normalizeContentType(response.headers.get('content-type') || '');
  if (!isMediaContentType(contentType)) {
    const sniffed = sniffContentType(buffer);
    if (sniffed) contentType = sniffed;
  }
  if (!contentType) contentType = 'image/png';
  const extension = getExtensionForContentType(contentType) || 'png';
  
  const fileName = `${hash}.${extension}`;
  const vfsPath = `/assets/${prefix}/${fileName}`;
  
  // Save to physical file system
  const physicalPath = path.join(getWorkspaceRoot(), projectId, 'assets', prefix, fileName);
  await fs.mkdir(path.dirname(physicalPath), { recursive: true });
  await fs.writeFile(physicalPath, buffer);

  console.log(`[Media] Saved image locally to: ${physicalPath}`);
  
  return vfsPath;
}

/**
 * (Alias for backward compatibility if needed)
 */
export const uploadImageFromUrl = saveImageFromUrl;
