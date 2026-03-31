#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

function log(...args) {
  console.error('[BLTAI-MVP]', ...args);
}

export async function loadDotEnv() {
  const candidates = ['.env.local', '.env'];
  for (const filename of candidates) {
    const envPath = path.resolve(process.cwd(), filename);
    let content = '';
    try {
      content = await fs.readFile(envPath, 'utf-8');
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (!key) continue;
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

export function normalizeBaseUrl(input) {
  if (!input) return 'https://api.bltcy.ai';
  let base = input.trim();
  if (base.endsWith('/')) base = base.slice(0, -1);
  if (base.endsWith('/v1') || base.endsWith('/v2')) {
    base = base.slice(0, -3);
  }
  return base;
}

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

export function splitList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const DEFAULT_IMAGE_MODEL = 'nano-banana';
const DEFAULT_VIDEO_MODEL = 'veo3.1-fast';

export function buildPayload(scope, args) {
  const payload = {
    prompt: args.prompt || '',
  };
  if (args.model) {
    payload.model = args.model;
  } else if (scope === 'images') {
    payload.model = DEFAULT_IMAGE_MODEL;
  } else if (scope === 'videos') {
    payload.model = DEFAULT_VIDEO_MODEL;
  }
  if (args.duration) payload.duration = Number(args.duration);
  if (args.aspect_ratio) {
    payload.aspect_ratio = args.aspect_ratio;
  } else if (scope === 'videos') {
    payload.aspect_ratio = '16:9';
  }
  if (args.size) payload.size = args.size;
  if (args.resolution) payload.resolution = args.resolution;
  if (args.watermark !== undefined) {
    payload.watermark = args.watermark === 'true' || args.watermark === true;
  }
  const images = splitList(args.images);
  const videos = splitList(args.videos);
  if (images.length > 0) {
    if (scope === 'images') payload.image = images;
    else payload.images = images;
  }
  if (videos.length > 0) payload.videos = videos;
  return payload;
}

export function extractOutputs(scope, result) {
  if (scope === 'images') {
    const dataBlock = result?.data?.data || result?.data;
    const urls = dataBlock?.data?.map((item) => item.url).filter(Boolean) || [];
    if (urls.length > 0) return urls;
    if (dataBlock?.url) return [dataBlock.url];
    return [];
  }
  const outputs = result?.data?.outputs || (result?.data?.output ? [result.data.output] : []);
  return outputs.filter(Boolean);
}

export function normalizeStatus(status) {
  return String(status || '').toUpperCase();
}

export function resolveSubmitEndpoint(baseUrl, scope) {
  if (scope === 'images') return `${baseUrl}/v1/images/generations?async=true`;
  if (scope === 'videos') return `${baseUrl}/v2/videos/generations`;
  return '';
}

export function resolvePollEndpoint(baseUrl, scope, taskId) {
  if (scope === 'images') return `${baseUrl}/v1/images/tasks/${taskId}`;
  if (scope === 'videos') return `${baseUrl}/v2/videos/generations/${taskId}`;
  return '';
}

export async function submitTask(baseUrl, apiKey, scope, payload) {
  const endpoint = resolveSubmitEndpoint(baseUrl, scope);
  if (!endpoint) {
    throw new Error(`Unsupported scope: ${scope}`);
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  const taskId = data.task_id || data.id || data.data?.task_id || data.data?.id;
  if (!taskId) throw new Error(`Missing task_id in response: ${JSON.stringify(data)}`);
  return taskId;
}

export async function getTask(baseUrl, apiKey, scope, taskId) {
  const primary = resolvePollEndpoint(baseUrl, scope, taskId);
  if (!primary) {
    throw new Error(`Unsupported scope: ${scope}`);
  }
  const fallbacks = scope === 'images'
    ? [`${baseUrl}/v1/images/generations/${taskId}`]
    : [];

  const candidates = [primary, ...fallbacks];
  let lastError = '';
  for (const endpoint of candidates) {
    const response = await fetch(endpoint, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      lastError = errorData.error?.message || `HTTP ${response.status} ${response.statusText}`;
      continue;
    }
    const data = await response.json();
    return { endpoint, data };
  }
  throw new Error(lastError || 'Failed to fetch task status');
}

export function extractStatus(payload) {
  if (!payload) return '';
  if (payload.status !== undefined) return payload.status;
  if (payload.data?.status !== undefined) return payload.data.status;
  if (payload.task?.status !== undefined) return payload.task.status;
  return '';
}

export async function pollTask(baseUrl, apiKey, scope, taskId, timeoutMs, debug) {
  const started = Date.now();
  let delay = 2000;
  for (;;) {
    const { endpoint, data } = await getTask(baseUrl, apiKey, scope, taskId);
    const rawStatus = extractStatus(data);
    const status = normalizeStatus(rawStatus);
    if (debug) {
      log(`Poll ${endpoint} -> status:`, rawStatus || '(empty)');
    }
    if (status === 'SUCCESS' || status === 'SUCCEEDED' || status === 'COMPLETED' || status === 'DONE' || status === 'FINISHED') {
      return data;
    }
    if (status === 'FAILURE' || status === 'FAILED' || status === 'ERROR' || status === 'CANCELED' || status === 'CANCELLED' || status === 'TIMEOUT') {
      const reason = data.fail_reason || data.error || data.data?.fail_reason || 'BLTAI task failed';
      throw new Error(String(reason));
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error('Polling timeout reached');
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, 8000);
  }
}

export function resolveProviderEnv(provider, env = process.env, providerConfig = {}) {
  const apiKey = env[provider.env.apiKey] || providerConfig.apiKey || '';
  const baseUrl = normalizeBaseUrl(
    env[provider.env.baseUrl] || providerConfig.baseUrl || provider.env.defaultBaseUrl
  );
  return { apiKey, baseUrl };
}

export const BLTAI_PROVIDER = {
  id: 'bltai',
  label: 'BLTAI',
  env: {
    apiKey: 'BLTAI_API_KEY',
    baseUrl: 'BLTAI_BASE_URL',
    defaultBaseUrl: 'https://api.bltcy.ai',
  },
  scopes: {
    image: 'images',
    video: 'videos',
  },
  buildPayload,
  extractOutputs,
  async submit({ baseUrl, apiKey, scope, payload }) {
    return submitTask(baseUrl, apiKey, scope, payload);
  },
  async poll({ baseUrl, apiKey, scope, taskId, timeoutMs, debug }) {
    return pollTask(baseUrl, apiKey, scope, taskId, timeoutMs, debug);
  },
};

export async function main(argv = process.argv.slice(2)) {
  await loadDotEnv();
  const args = parseArgs(argv);
  const [scope, prompt] = args._;
  if (!scope || !prompt) {
    log('Usage: node scripts/bltai-mvp.mjs <scope> <prompt> [--model <name>] [--images url1,url2] [--videos url1,url2]');
    log('Example: node scripts/bltai-mvp.mjs videos "A cat" --images https://...');
    process.exit(1);
  }

  if (!process.env.BLTAI_API_KEY) {
    throw new Error('Missing BLTAI_API_KEY (set in .env.local or env var)');
  }

  const baseUrl = normalizeBaseUrl(process.env.BLTAI_BASE_URL || 'https://api.bltcy.ai');
  const payload = buildPayload(scope, { ...args, prompt });

  log('Submitting task...', { scope, baseUrl, payload });
  const taskId = await submitTask(baseUrl, process.env.BLTAI_API_KEY, scope, payload);
  log('Task submitted:', taskId);

  const timeoutMs = Number(args.timeout || 30 * 60 * 1000);
  const result = await pollTask(baseUrl, process.env.BLTAI_API_KEY, scope, taskId, timeoutMs, args.debug);
  let outputs = [];
  if (scope === 'images') {
    const dataBlock = result?.data?.data || result?.data;
    outputs = dataBlock?.data?.map((item) => item.url).filter(Boolean) || [];
    if (outputs.length === 0 && dataBlock?.url) outputs = [dataBlock.url];
  } else {
    outputs = result?.data?.outputs || (result?.data?.output ? [result.data.output] : []);
  }

  console.log(JSON.stringify({
    task_id: taskId,
    status: result.status,
    output: outputs[0] || '',
    outputs,
    raw: result,
  }, null, 2));
}
