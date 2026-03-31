import fs from 'fs/promises';
import path from 'path';
import { getContentTypeByPath } from '@/lib/vfs/server-utils';
import { isMediaContentType, normalizeContentType, sniffContentType } from '@/lib/file-type';

export function normalizeWorkspaceRelativePath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('./')) return trimmed;
  if (trimmed.startsWith('/')) return `.${trimmed}`;
  return `./${trimmed}`;
}

function bufferToDataUrl(buffer: Buffer, contentType: string): string {
  const safeType = normalizeContentType(contentType) || 'application/octet-stream';
  return `data:${safeType};base64,${buffer.toString('base64')}`;
}

export async function fetchMediaAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch media: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  let contentType = normalizeContentType(response.headers.get('content-type') || '');

  if (!isMediaContentType(contentType)) {
    const sniffed = sniffContentType(buffer);
    if (sniffed) contentType = sniffed;
  }

  if (!isMediaContentType(contentType)) {
    throw new Error(`Unsupported media type: ${contentType || 'unknown'}`);
  }

  return bufferToDataUrl(buffer, contentType);
}

export async function readLocalMediaAsDataUrl(
  workspaceRoot: string,
  projectId: string,
  relativePath: string
): Promise<string> {
  const normalized = normalizeWorkspaceRelativePath(relativePath);
  const absolutePath = path.resolve(workspaceRoot, 'projects', projectId, normalized.replace(/^\.\//, ''));
  const buffer = await fs.readFile(absolutePath);

  let contentType = getContentTypeByPath(normalized);
  if (!isMediaContentType(contentType)) {
    const sniffed = sniffContentType(buffer);
    if (sniffed) contentType = sniffed;
  }

  if (!isMediaContentType(contentType)) {
    throw new Error(`Unsupported local media type: ${contentType || 'unknown'}`);
  }

  return bufferToDataUrl(buffer, contentType);
}
