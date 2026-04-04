#!/usr/bin/env bun
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export function log(...args: any[]) {
  console.error('[mangou]', ...args);
}

export function isHttpUrl(value: string | undefined | null): boolean {
  return /^https?:\/\//i.test(value || '');
}

export function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

export async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function getRemoteExtension(url: string, fallback: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).replace(/^\./, '');
    return ext || fallback;
  } catch {
    return fallback;
  }
}

async function fetchWithRetry(url: string, options?: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i += 1) {
    try {
      return await fetch(url, options);
    } catch (error: any) {
      lastError = error;
      log(`fetch failed (attempt ${i + 1}/${maxRetries}): ${error.message}`);
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * (i + 1)));
      }
    }
  }
  throw lastError;
}

export async function downloadFile(url: string, targetPath: string): Promise<void> {
  log(`Downloading asset: ${url}`);
  const response = await fetchWithRetry(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, buffer);
}

/**
 * Download remote outputs and save them into the project assets directory.
 * Returns the local relative paths.
 */
export async function materializeOutputs(
  projectRoot: string,
  yamlPath: string,
  type: 'image' | 'video',
  taskId: string,
  outputs: string[]
): Promise<string[]> {
  const localized: string[] = [];
  for (let index = 0; index < outputs.length; index += 1) {
    const output = outputs[index];
    if (!isHttpUrl(output)) {
      localized.push(output);
      continue;
    }

    const ext = getRemoteExtension(output, type === 'image' ? 'png' : 'mp4');
    const subDir = type === 'image' ? 'images' : 'videos';
    const taskIdStr = taskId || crypto.randomUUID();
    const filename = `${path.basename(yamlPath, '.yaml')}-${taskIdStr.slice(0, 8)}-${index}.${ext}`;
    const relativePath = path.posix.join('assets', subDir, filename);
    await downloadFile(output, path.join(projectRoot, relativePath));
    localized.push(relativePath);
  }
  return localized;
}

export function resolveResumeTaskId(taskConfig: any): string | null {
  const latest = taskConfig?.latest;
  const taskId = typeof latest?.task_id === 'string' ? latest.task_id.trim() : '';
  const status = String(latest?.status || '').toLowerCase();
  if (!taskId || taskId === 'unknown') return null;
  if (status === 'success' || status === 'completed') return null;
  return taskId;
}
