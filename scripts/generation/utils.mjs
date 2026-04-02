import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export function log(...args) {
  console.error('[mangou]', ...args);
}

export function isHttpUrl(value) {
  return /^https?:\/\//i.test(value || '');
}

export function ensureArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function getRemoteExtension(url, fallback) {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).replace(/^\./, '');
    return ext || fallback;
  } catch {
    return fallback;
  }
}

async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;
  for (let i = 0; i < maxRetries; i += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      log(`fetch failed (attempt ${i + 1}/${maxRetries}): ${error.message}`);
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * (i + 1)));
      }
    }
  }
  throw lastError;
}

export async function downloadFile(url, targetPath) {
  log(`Downloading asset: ${url}`);
  const response = await fetchWithRetry(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, buffer);
}

export async function materializeOutputs(projectRoot, yamlPath, type, taskId, outputs) {
  const localized = [];
  for (let index = 0; index < outputs.length; index += 1) {
    const output = outputs[index];
    if (!isHttpUrl(output)) {
      localized.push(output);
      continue;
    }

    const ext = getRemoteExtension(output, type === 'image' ? 'png' : 'mp4');
    const subDir = type === 'image' ? 'images' : 'videos';
    const taskIdStr = typeof taskId === 'string' ? taskId : crypto.randomUUID();
    const filename = `${path.basename(yamlPath, '.yaml')}-${taskIdStr.slice(0, 8)}-${index}.${ext}`;
    const relativePath = path.posix.join('assets', subDir, filename);
    await downloadFile(output, path.join(projectRoot, relativePath));
    localized.push(relativePath);
  }
  return localized;
}

export function resolveResumeTaskId(taskConfig) {
  const latest = taskConfig?.latest;
  const taskId = typeof latest?.task_id === 'string' ? latest.task_id.trim() : '';
  const status = String(latest?.status || '').toLowerCase();
  if (!taskId || taskId === 'unknown') return null;
  if (status === 'success' || status === 'completed') return null;
  return taskId;
}
