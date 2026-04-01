import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import yaml from 'js-yaml';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { fileURLToPath } from 'url';
import {
  loadDotEnv,
  resolveProviderEnv,
} from './bltai-lib.mjs';
import { getAIGCProvider } from './aigc-provider-registry.mjs';
import { updateGenerationStatus } from '../src/lib/vfs/yaml.ts';
import { appendTaskEvent } from './tasks-jsonl.mjs';
import {
  fetchMediaAsDataUrl,
  normalizeWorkspaceRelativePath,
  readLocalMediaAsDataUrl,
} from '../src/lib/agent/image-input.ts';

const proxyUrl =
  process.env.https_proxy ||
  process.env.HTTPS_PROXY ||
  process.env.http_proxy ||
  process.env.HTTP_PROXY ||
  '';

if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

function log(...args) {
  console.error('[mangou]', ...args);
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value || '');
}

function ensureArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
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

export function resolveResumeTaskId(taskConfig) {
  const latest = taskConfig?.latest;
  const taskId = typeof latest?.task_id === 'string' ? latest.task_id.trim() : '';
  const status = String(latest?.status || '').toLowerCase();
  if (!taskId || taskId === 'unknown') return null;
  if (status === 'success' || status === 'completed') return null;
  return taskId;
}

async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (err) {
      lastError = err;
      log(`fetch failed (attempt ${i + 1}/${maxRetries}): ${err.message}`);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
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

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function inferContext(absoluteYamlPath) {
  const normalized = path.resolve(absoluteYamlPath);
  const segments = normalized.split(path.sep).filter(Boolean);
  const projectsIndex = segments.lastIndexOf('projects');

  // Attempt to infer standard workspace structure (workspace/projects/id/...)
  if (projectsIndex >= 1 && segments.length > projectsIndex + 2) {
    const projectId = segments[projectsIndex + 1];
    const section = segments[projectsIndex + 2];
    if (section === 'storyboards' || section === 'asset_defs') {
        const projectsSegments = segments.slice(0, projectsIndex + 1);
        const projectsRoot = `${path.sep}${projectsSegments.join(path.sep)}`;
        const workspaceRoot = path.dirname(projectsRoot);
        const projectRoot = path.join(projectsRoot, projectId);
        const yamlSegments = segments.slice(projectsIndex + 2);
        const yamlPath = yamlSegments.join('/');

        // Verify workspace marker for confidence
        const hasWorkspaceMarker = (
            (await fileExists(path.join(workspaceRoot, 'projects.json'))) ||
            (await fileExists(path.join(workspaceRoot, 'config.json'))) ||
            (await fileExists(path.join(workspaceRoot, '.mangou')))
          );
          
        if (hasWorkspaceMarker) {
            return { workspaceRoot, projectId, projectPath: projectId, projectRoot, yamlPath };
        }
    }
  }

  // PORTABLE FALLBACK:
  // If no standard workspace structure detected, use the directory containing the YAML as the project root
  // and the current working directory as the workspace root.
  const portableProjectRoot = path.dirname(normalized);
  const portableProjectId = path.basename(portableProjectRoot);
  const portableYamlPath = path.basename(normalized);

  return {
    workspaceRoot: process.cwd(),
    projectId: portableProjectId,
    projectPath: portableProjectId,
    projectRoot: portableProjectRoot,
    yamlPath: portableYamlPath,
    isPortable: true,
  };
}

async function readWorkspaceConfig(workspaceRoot) {
  const configPath = path.join(workspaceRoot, 'config.json');
  try {
    return JSON.parse(await fs.readFile(configPath, 'utf-8'));
  } catch {
    return {};
  }
}

function getProviderConfig(config, providerId) {
  if (!config || typeof config !== 'object') return {};
  const direct = config?.[providerId];
  if (direct && typeof direct === 'object') {
    return {
      apiKey: typeof direct.apiKey === 'string' ? direct.apiKey : '',
      baseUrl: typeof direct.baseUrl === 'string' ? direct.baseUrl : '',
    };
  }
  const nested = config?.providers?.[providerId];
  if (nested && typeof nested === 'object') {
    return {
      apiKey: typeof nested.apiKey === 'string' ? nested.apiKey : '',
      baseUrl: typeof nested.baseUrl === 'string' ? nested.baseUrl : '',
    };
  }
  return {};
}

async function collectRefImageInputs(projectRoot, refs) {
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

async function resolveImageInput(workspaceRoot, projectId, projectRoot, value, allowYaml = false, depth = 0) {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (depth > 1) {
    log(`Warning: Maximum YAML resolution depth reached for ${value}`);
    return null;
  }

  const normalized = normalizeWorkspaceRelativePath(value.trim());
  if (normalized.startsWith('data:')) return normalized;
  if (isHttpUrl(normalized)) {
    return normalized;
  }

  if (allowYaml && normalized.endsWith('.yaml')) {
    try {
      const absoluteYamlPath = path.isAbsolute(normalized)
        ? normalized
        : path.join(workspaceRoot, 'projects', projectId, normalized);

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

  // Portable resolution: try absolute path relative to projectRoot first
  const candidatePath = path.resolve(projectRoot, normalized.replace(/^\.\//, ''));
  
  try {
     // If the file exists at this resolved location, read it directly
     const buffer = await fs.readFile(candidatePath);
     const contentType = String(normalized).endsWith('.png') ? 'image/png' : 'image/jpeg'; // naive fallback
     return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
     // Fallback to standard registry structure
     return readLocalMediaAsDataUrl(workspaceRoot, projectId, normalized);
  }
}

async function postJson(url, body, method = 'POST', timeout = 2000) {
  return { skipped: true };
}

export async function updateYamlProjection(payload) {
  const {
    projectRoot,
    taskId,
    upstreamTaskId,
    status,
    output,
    yamlPath,
    taskType,
    error,
  } = payload;

  if (projectRoot && yamlPath) {
    try {
      const fullYamlPath = path.join(projectRoot, yamlPath);
      const current = await fs.readFile(fullYamlPath, 'utf-8');
      const updated = updateGenerationStatus(current, taskType, {
        status,
        output: Array.isArray(output?.files) ? output.files[0] : (typeof output === 'string' ? output : null),
        error: typeof error === 'string' ? error : (error?.message || null),
        task_id: taskId ?? null,
        upstream_task_id: upstreamTaskId ?? taskId ?? null,
      });
      await fs.writeFile(fullYamlPath, updated, 'utf-8');
    } catch (writeError) {
      log(`Warning: failed to update YAML directly: ${writeError instanceof Error ? writeError.message : String(writeError)}`);
    }
  }
}

async function upsertTask(projectRoot, id, payload) {
  try {
    return await appendTaskEvent(projectRoot, {
      ...payload,
      id,
    });
  } catch (err) {
    log(`Warning: failed to append task event: ${err.message}`);
  }
}

function isTimeoutError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout/i.test(message);
}

export async function runAIGC(provider, argv = process.argv.slice(2)) {
  await loadDotEnv();

  const yamlArg = argv[0];
  const type = argv[1];
  const debug = argv.includes('--debug');

  if (!yamlArg || !type || !['image', 'video'].includes(type)) {
    console.error('Usage: node agent-generate.mjs <yaml-path> <image|video> [--debug]');
    process.exit(1);
  }

  const absoluteYamlPath = path.resolve(process.cwd(), yamlArg);
  const { workspaceRoot, projectId, projectRoot, yamlPath } = await inferContext(absoluteYamlPath);
  
  const raw = await fs.readFile(absoluteYamlPath, 'utf-8');
  const doc = yaml.load(raw);
  const taskConfig = doc?.tasks?.[type];
  if (!taskConfig?.params || typeof taskConfig.params !== 'object') {
    throw new Error(`Missing tasks.${type}.params in ${yamlArg}`);
  }

  const providerId = taskConfig.provider || process.env.MANGOU_AIGC_PROVIDER || 'bltai';
  const providerToUse = provider || getAIGCProvider(providerId);
  const workspaceConfig = await readWorkspaceConfig(workspaceRoot);
  const { apiKey, baseUrl } = resolveProviderEnv(
    providerToUse,
    process.env,
    getProviderConfig(workspaceConfig, providerToUse.id)
  );
  if (!apiKey) {
    throw new Error(`Missing ${providerToUse.env.apiKey}`);
  }
  const isStoryboard = yamlPath.startsWith('storyboards/');
  const params = { ...taskConfig.params };
  const scope = providerToUse.scopes?.[type] || (type === 'image' ? 'images' : 'videos');
  const refs = ensureArray(doc?.refs);
  const refImages = type === 'image' ? await collectRefImageInputs(projectRoot, refs) : [];

  // Resolve template variables like {{tasks.image.latest.output}}
  function resolveTemplateVar(value) {
    if (typeof value !== 'string') return value;
    return value.replace(/\{\{(tasks\.[^}]+)\}\}/g, (_match, dotPath) => {
      const parts = dotPath.split('.');
      let current = doc;
      for (const part of parts) {
        if (current == null || typeof current !== 'object') return '';
        current = current[part];
      }
      return typeof current === 'string' ? current : '';
    });
  }

  const rawImages = [
    ...ensureArray(params.images),
    ...(params.image_url ? [resolveTemplateVar(params.image_url)] : []),
    ...(params.image ? [resolveTemplateVar(params.image)] : []),
    ...refImages,
  ];

  // For video tasks: auto-inject the image task's latest output if no explicit images
  if (type === 'video' && rawImages.filter(Boolean).length === 0) {
    const imageOutput = doc?.tasks?.image?.latest?.output;
    if (imageOutput && typeof imageOutput === 'string') {
      rawImages.push(imageOutput);
    }
  }

  const uniqueImages = Array.from(new Set(rawImages.filter(Boolean)));
  const resolvedImages = [];
  for (const input of uniqueImages) {
    resolvedImages.push(await resolveImageInput(workspaceRoot, projectId, projectRoot, input, isStoryboard));
  }

  if (resolvedImages.length > 0) {
    params.images = resolvedImages.filter(Boolean);
    delete params.image_url;
    delete params.image;
  }

  const payload = providerToUse.buildPayload(scope, params);
  const localTaskId = crypto.randomUUID();
  let upstreamTaskId = resolveResumeTaskId(taskConfig);
  const resuming = Boolean(upstreamTaskId);
  let submitResult;

  if (!resuming) {
    try {
      await upsertTask(projectRoot, localTaskId, {
        id: localTaskId,
        type,
        status: 'processing',
        provider: providerToUse.id,
        input: params,
        ref: { yamlPath, taskType: type },
        worker: 'mangou',
        event: 'submitted',
      });
    } catch {
      // best effort
    }
  }

  try {
    if (!resuming) {
      log(`Submitting ${type} task`, { projectId, yamlPath });
      submitResult = await providerToUse.submit({
        baseUrl,
        apiKey,
        scope,
        payload,
        workspaceRoot,
        projectId,
        projectRoot,
        yamlPath,
      });
      upstreamTaskId = typeof submitResult === 'string' ? submitResult : localTaskId;

      try {
        await upsertTask(projectRoot, localTaskId, {
          upstreamTaskId,
          type,
          status: 'processing',
          provider: providerToUse.id,
          input: params,
          ref: { yamlPath, taskType: type },
          worker: 'mangou',
          event: 'accepted',
        });
      } catch {
        // best effort
      }

      await updateYamlProjection({
        projectRoot,
        taskId: upstreamTaskId,
        upstreamTaskId,
        status: 'processing',
        output: null,
        yamlPath,
        taskType: type,
        error: null,
      });
    } else {
      log(`Resuming ${type} task`, { projectId, yamlPath, upstreamTaskId });
    }

    const result = await providerToUse.poll({
      baseUrl,
      apiKey,
      scope,
      taskId: submitResult ?? upstreamTaskId,
      timeoutMs: 30 * 60 * 1000,
      debug,
      workspaceRoot,
      projectId,
      projectRoot,
      yamlPath,
    });
    const outputs = providerToUse.extractOutputs(scope, result);
    const finalOutputs = await materializeOutputs(projectRoot, yamlPath, type, upstreamTaskId, outputs);
    const primaryOutput = finalOutputs[0] || '';

    try {
      await upsertTask(projectRoot, localTaskId, {
        upstreamTaskId,
        type,
        status: 'success',
        provider: providerToUse.id,
        input: params,
        output: { urls: finalOutputs },
        ref: { yamlPath, taskType: type },
        worker: 'mangou',
        event: 'completed',
      });
    } catch {
      // best effort
    }

    await updateYamlProjection({
      projectRoot,
      taskId: upstreamTaskId,
      upstreamTaskId,
      status: 'completed',
      output: primaryOutput,
      yamlPath,
      taskType: type,
      error: null,
    });

    console.log(JSON.stringify({
      success: true,
      taskId: upstreamTaskId,
      upstreamTaskId,
      output: primaryOutput,
      outputs: finalOutputs,
    }, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const timeout = isTimeoutError(error);
    const taskStatus = timeout ? 'processing' : 'failed';
    const event = timeout ? 'timeout' : 'failed';

    try {
      await upsertTask(projectRoot, localTaskId, {
        upstreamTaskId,
        type,
        status: taskStatus,
        provider: providerToUse.id,
        input: params,
        ref: { yamlPath, taskType: type },
        error: { message },
        worker: 'mangou',
        event,
      }).catch(() => null);
    } catch {
      // best effort
    }

    await updateYamlProjection({
      projectRoot,
      taskId: upstreamTaskId ?? null,
      upstreamTaskId: upstreamTaskId ?? null,
      status: taskStatus,
      output: null,
      yamlPath,
      taskType: type,
      error: message,
    }).catch(() => null);

    throw error;
  }
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  const provider = getAIGCProvider(process.env.MANGOU_AIGC_PROVIDER || 'bltai');
  runAIGC(provider).catch((error) => {
    console.error('[mangou] Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
