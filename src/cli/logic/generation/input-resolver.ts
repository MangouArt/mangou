#!/usr/bin/env bun
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
function normalizeWorkspaceRelativePath(input) {
  const trimmed = (input || '').trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('@logic/')) return trimmed;
  if (trimmed.startsWith('/')) return `.${trimmed}`;
  return `./${trimmed}`;
}

async function readLocalMediaAsDataUrl(workspaceRoot, projectId, relativePath) {
  const normalized = normalizeWorkspaceRelativePath(relativePath);
  const absolutePath = path.resolve(workspaceRoot, 'projects', projectId, normalized.replace(/^\.\//, ''));
  const buffer = await fs.readFile(absolutePath);
  const ext = path.extname(normalized).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'image/png';
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}
import { isHttpUrl, log } from '@logic/utils';

export async function collectRefImageInputs(projectRoot, refs) {
  const results = [];
  if (!Array.isArray(refs) || refs.length === 0) return results;
  const assetDefsRoot = path.join(projectRoot, 'asset_defs');

  async function walk(dir) {
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.yaml')) continue;
      try {
        const raw = await fs.readFile(entryPath, 'utf-8');
        const parsed = yaml.load(raw);
        const refId = parsed?.meta?.id;
        const latestOutput = parsed?.tasks?.image?.latest?.output;
        if (refId && typeof latestOutput === 'string') {
          results.push([refId, latestOutput]);
        }
      } catch {
        // ignore invalid yaml
      }
    }
  }

  await walk(assetDefsRoot);
  const refMap = new Map(results);
  return refs
    .map((id) => refMap.get(id))
    .filter((value) => typeof value === 'string' && value.length > 0);
}

export async function resolveImageInput(workspaceRoot, projectId, projectRoot, value, allowYaml = false, depth = 0) {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (depth > 1) {
    log(`Warning: Maximum YAML resolution depth reached for ${value}`);
    return null;
  }

  let normalized = value.trim();
  const interpolationMatch = normalized.match(/^\$\{(.+)\}$/);
  if (interpolationMatch) {
    normalized = interpolationMatch[1];
    allowYaml = normalized.endsWith('.yaml');
  }

  normalized = normalizeWorkspaceRelativePath(normalized);
  if (normalized.startsWith('data:')) return normalized;
  if (isHttpUrl(normalized)) return normalized;

  if (allowYaml && normalized.endsWith('.yaml')) {
    try {
      const absoluteYamlPath = path.isAbsolute(normalized)
        ? normalized
        : path.join(projectRoot, normalized);
      const raw = await fs.readFile(absoluteYamlPath, 'utf-8');
      const doc = yaml.load(raw);
      const latestOutput = doc?.tasks?.image?.latest?.output;
      if (latestOutput && typeof latestOutput === 'string') {
        return resolveImageInput(workspaceRoot, projectId, projectRoot, latestOutput, false, depth + 1);
      }
    } catch (error) {
      log(`Warning: Failed to resolve YAML linkage ${normalized}:`, error.message);
    }
  }

  const candidatePath = path.resolve(projectRoot, normalized.replace(/^\.\//, ''));
  try {
    const buffer = await fs.readFile(candidatePath);
    const ext = path.extname(normalized).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'image/png';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
    return readLocalMediaAsDataUrl(workspaceRoot, projectId, normalized);
  }
}
