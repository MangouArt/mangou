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

export function joinUrl(base, ...parts) {
  const normalizedBase = String(base || '').replace(/\/+$/, '');
  const normalizedPath = parts
    .map((part) => String(part || '').replace(/^\/+/, '').replace(/\/+$/, ''))
    .filter(Boolean)
    .join('/');
  return normalizedPath ? `${normalizedBase}/${normalizedPath}` : normalizedBase;
}

function resolveWebOrigin() {
  if (process.env.MANGOU_WEB_ORIGIN) return process.env.MANGOU_WEB_ORIGIN;
  const port = process.env.MANGOU_WEB_PORT || '3000';
  return `http://127.0.0.1:${port}`;
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

export async function downloadFile(url, targetPath) {
  const response = await fetch(url);
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
    const filename = `${path.basename(yamlPath, '.yaml')}-${taskId.slice(0, 8)}-${index}.${ext}`;
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
  const projectId = projectsIndex >= 0 ? segments[projectsIndex + 1] : '';
  const section = projectsIndex >= 0 ? segments[projectsIndex + 2] : '';
  if (projectsIndex < 1 || !projectId || !section) {
    throw new Error(`YAML must live under <workspace>/projects/<projectId>/(storyboards|asset_defs)/: ${normalized}`);
  }

  if (section !== 'storyboards' && section !== 'asset_defs') {
    throw new Error(`YAML must live under <workspace>/projects/<projectId>/(storyboards|asset_defs)/: ${normalized}`);
  }

  if (section === 'asset_defs' && segments.length < projectsIndex + 5) {
    throw new Error(`Asset definition YAML must live under <workspace>/projects/<projectId>/asset_defs/<group>/: ${normalized}`);
  }

  const projectsSegments = segments.slice(0, projectsIndex + 1);
  const projectsRoot = `${path.sep}${projectsSegments.join(path.sep)}`;
  const workspaceRoot = path.dirname(projectsRoot);
  const yamlSegments = segments.slice(projectsIndex + 2);
  if (yamlSegments.length === 0) {
    throw new Error(`Invalid project YAML path: ${normalized}`);
  }

  const projectPath = projectId;
  const projectRoot = path.join(projectsRoot, projectId);
  const yamlPath = yamlSegments.join('/');

  const explicitProjectsRoot = process.env.MANGOU_WORKSPACE_ROOT
    ? path.resolve(process.env.MANGOU_WORKSPACE_ROOT)
    : null;
  if (explicitProjectsRoot && projectsRoot !== explicitProjectsRoot) {
    throw new Error(`YAML must live under projects root ${explicitProjectsRoot}: ${normalized}`);
  }

  const explicitWorkspaceRoot = process.env.MANGOU_HOME ? path.resolve(process.env.MANGOU_HOME) : null;
  if (explicitWorkspaceRoot && workspaceRoot !== explicitWorkspaceRoot) {
    throw new Error(`YAML must live under workspace root ${explicitWorkspaceRoot}: ${normalized}`);
  }

  if (!explicitProjectsRoot && !explicitWorkspaceRoot) {
    const hasWorkspaceMarker =
      path.basename(projectsRoot) === 'projects' && (
        (await fileExists(path.join(workspaceRoot, 'projects.json'))) ||
        (await fileExists(path.join(workspaceRoot, 'config.json'))) ||
        (await fileExists(path.join(workspaceRoot, '.mangou')))
      );
    if (!hasWorkspaceMarker) {
      throw new Error(`Cannot infer workspace root from YAML path: ${normalized}`);
    }
  }

  return { workspaceRoot, projectId, projectPath, projectRoot, yamlPath };
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

async function resolveImageInput(workspaceRoot, projectId, value, allowYaml = false, depth = 0) {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (depth > 1) {
    log(`Warning: Maximum YAML resolution depth reached for ${value}`);
    return null;
  }

  const normalized = normalizeWorkspaceRelativePath(value.trim());
  if (normalized.startsWith('data:')) return normalized;
  if (isHttpUrl(normalized)) {
    return fetchMediaAsDataUrl(normalized);
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
        return resolveImageInput(workspaceRoot, projectId, latestOutput, false, depth + 1);
      }
    } catch (error) {
      log(`Warning: Failed to resolve YAML linkage ${normalized}:`, error.message);
    }
  }

  return readLocalMediaAsDataUrl(workspaceRoot, projectId, normalized);
}

async function postJson(url, body, method = 'POST') {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${text}`);
  }
  return response.json();
}

export async function updateYamlProjection(origin, payload) {
  const {
    projectPath,
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

  try {
    await postJson(joinUrl(origin, 'api', 'yaml', 'sync-latest'), {
      projectPath,
      taskId,
      upstreamTaskId,
      status,
      output,
      yamlPath,
      taskType,
      error,
    }, 'POST');
  } catch {
    // direct YAML write is the source of durability; web sync is best effort
  }
}

async function upsertTask(origin, id, payload, method = 'POST') {
  const url = method === 'POST'
    ? joinUrl(origin, 'api', 'tasks')
    : joinUrl(origin, 'api', 'tasks', id);
  return postJson(url, payload, method);
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
  const { workspaceRoot, projectId, projectPath, projectRoot, yamlPath } = await inferContext(absoluteYamlPath);
  const origin = resolveWebOrigin();
  const providerToUse = provider || getAIGCProvider(process.env.MANGOU_AIGC_PROVIDER || 'bltai');
  const workspaceConfig = await readWorkspaceConfig(workspaceRoot);
  const { apiKey, baseUrl } = resolveProviderEnv(
    providerToUse,
    process.env,
    getProviderConfig(workspaceConfig, providerToUse.id)
  );
  if (!apiKey) {
    throw new Error(`Missing ${providerToUse.env.apiKey}`);
  }

  const raw = await fs.readFile(absoluteYamlPath, 'utf-8');
  const doc = yaml.load(raw);
  const taskConfig = doc?.tasks?.[type];
  if (!taskConfig?.params || typeof taskConfig.params !== 'object') {
    throw new Error(`Missing tasks.${type}.params in ${yamlArg}`);
  }

  const isStoryboard = yamlPath.startsWith('storyboards/');
  const params = { ...taskConfig.params };
  const scope = providerToUse.scopes?.[type] || (type === 'image' ? 'images' : 'videos');
  const refs = ensureArray(doc?.refs);
  const refImages = type === 'image' ? await collectRefImageInputs(projectRoot, refs) : [];

  const rawImages = [
    ...ensureArray(params.images),
    ...(params.image_url ? [params.image_url] : []),
    ...refImages,
  ];
  const uniqueImages = Array.from(new Set(rawImages.filter(Boolean)));
  const resolvedImages = [];
  for (const input of uniqueImages) {
    resolvedImages.push(await resolveImageInput(workspaceRoot, projectId, input, isStoryboard));
  }

  if (resolvedImages.length > 0) {
    params.images = resolvedImages.filter(Boolean);
    delete params.image_url;
  }

  const payload = providerToUse.buildPayload(scope, params);
  const localTaskId = crypto.randomUUID();
  let upstreamTaskId = resolveResumeTaskId(taskConfig);
  const resuming = Boolean(upstreamTaskId);

  if (!resuming) {
    await upsertTask(origin, localTaskId, {
      projectPath,
      id: localTaskId,
      type,
      status: 'processing',
      provider: providerToUse.id,
      input: params,
      ref: { yamlPath, taskType: type },
      worker: 'mangou',
      event: 'submitted',
    });
  }

  try {
    if (!resuming) {
      log(`Submitting ${type} task`, { projectPath, yamlPath });
      upstreamTaskId = await providerToUse.submit({
        baseUrl,
        apiKey,
        scope,
        payload,
        workspaceRoot,
        projectId,
        projectRoot,
        yamlPath,
      });

      await upsertTask(origin, localTaskId, {
        projectPath,
        upstreamTaskId,
        type,
        status: 'processing',
        provider: providerToUse.id,
        input: params,
        ref: { yamlPath, taskType: type },
        worker: 'mangou',
        event: 'accepted',
      }, 'PATCH');

      await updateYamlProjection(origin, {
        projectPath,
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
      log(`Resuming ${type} task`, { projectPath, yamlPath, upstreamTaskId });
    }

    const result = await providerToUse.poll({
      baseUrl,
      apiKey,
      scope,
      taskId: upstreamTaskId,
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

    await upsertTask(origin, localTaskId, {
      projectPath,
      upstreamTaskId,
      type,
      status: 'success',
      provider: providerToUse.id,
      input: params,
      output: { urls: finalOutputs },
      ref: { yamlPath, taskType: type },
      worker: 'mangou',
      event: 'completed',
    }, 'PATCH');

    await updateYamlProjection(origin, {
      projectPath,
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

    await upsertTask(origin, localTaskId, {
      projectPath,
      upstreamTaskId,
      type,
      status: taskStatus,
      provider: providerToUse.id,
      input: params,
      ref: { yamlPath, taskType: type },
      error: { message },
      worker: 'mangou',
      event,
    }, 'PATCH').catch(() => null);

    await updateYamlProjection(origin, {
      projectPath,
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
