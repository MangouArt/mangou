#!/usr/bin/env bun
import fs from 'node:fs/promises';
import path from 'node:path';

function log(...args: any[]) {
  console.error('[BLTAI-LIB]', ...args);
}

/**
 * Minimal .env loader
 */
export async function loadDotEnv() {
  const candidates = ['.env.local', '.env'];
  for (const filename of candidates) {
    const envPath = path.resolve(process.cwd(), filename);
    let content = '';
    try {
      content = await fs.readFile(envPath, 'utf-8');
    } catch { continue; }
    
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

export function normalizeBaseUrl(input: string | undefined): string {
  if (!input) return 'https://api.bltcy.ai';
  let base = input.trim();
  if (base.endsWith('/')) base = base.slice(0, -1);
  if (base.endsWith('/v1') || base.endsWith('/v2')) {
    base = base.slice(0, -3);
  }
  return base;
}

export function splitList(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

const DEFAULT_IMAGE_MODEL = 'flux.1-schnell';
const DEFAULT_VIDEO_MODEL = 'veo3.1-fast';

/**
 * Construct Provider-specific payload from generic params.
 */
export function buildPayload(scope: 'images' | 'videos', args: any) {
  const payload: any = {
    prompt: args.prompt || '',
  };
  
  payload.model = args.model || (scope === 'images' ? DEFAULT_IMAGE_MODEL : DEFAULT_VIDEO_MODEL);
  
  if (args.duration) payload.duration = Number(args.duration);
  if (args.aspect_ratio) {
    payload.aspect_ratio = args.aspect_ratio;
  } else if (scope === 'videos') {
    payload.aspect_ratio = '16:9';
  }
  if (args.size) payload.size = args.size;
  if (args.resolution) payload.resolution = args.resolution;
  
  const images = splitList(args.images);
  if (images.length > 0) {
    if (scope === 'images') payload.image = images[0]; // BLT legacy or single image
    else payload.images = images;
  }
  
  // Merge remaining params for API Pass-through
  return { ...payload, ...args };
}

export function extractOutputs(scope: 'images' | 'videos', result: any): string[] {
  if (scope === 'images') {
    const dataBlock = result?.data?.data || result?.data;
    const urls = dataBlock?.data?.map((item: any) => item.url).filter(Boolean) || [];
    if (urls.length > 0) return urls;
    if (dataBlock?.url) return [dataBlock.url];
    return [];
  }
  const outputs = result?.data?.outputs || (result?.data?.output ? [result.data.output] : []);
  return outputs.filter(Boolean);
}

export async function submitTask(baseUrl: string, apiKey: string, scope: 'images' | 'videos', payload: any): Promise<string> {
  const endpoint = scope === 'images' 
    ? `${baseUrl}/v1/images/generations?async=true` 
    : `${baseUrl}/v2/videos/generations`;

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
    throw new Error(errorData.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  const taskId = data.task_id || data.id || data.data?.task_id || data.data?.id;
  if (!taskId) throw new Error('Missing task_id in API response');
  return taskId;
}

export async function pollTask(baseUrl: string, apiKey: string, scope: 'images' | 'videos', taskId: string, timeoutMs: number, debug: boolean): Promise<any> {
  const started = Date.now();
  let delay = 2000;
  
  for (;;) {
    const endpoint = scope === 'images' 
      ? `${baseUrl}/v1/images/tasks/${taskId}` 
      : `${baseUrl}/v2/videos/generations/${taskId}`;

    const response = await fetch(endpoint, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      if (Date.now() - started > timeoutMs) throw new Error('Poll timeout');
      await new Promise(r => setTimeout(r, delay));
      continue;
    }

    const data = await response.json();
    const status = String(data?.status || data?.data?.status || '').toUpperCase();

    if (['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'DONE'].includes(status)) return data;
    if (['FAILURE', 'FAILED', 'ERROR', 'CANCELED'].includes(status)) {
      throw new Error(data.error?.message || 'BLTAI task failed');
    }

    if (Date.now() - started > timeoutMs) throw new Error('Poll timeout reached');
    await new Promise(r => setTimeout(r, delay));
    delay = Math.min(delay * 2, 8000);
  }
}

export function resolveProviderEnv(provider: any, env: any = process.env, providerConfig: any = {}) {
  const apiKey = env[provider.env.apiKey] || providerConfig.apiKey || '';
  const baseUrl = normalizeBaseUrl(env[provider.env.baseUrl] || providerConfig.baseUrl || provider.env.defaultBaseUrl);
  return { apiKey, baseUrl };
}

export const BLTAI_PROVIDER = {
  id: 'bltai',
  env: { apiKey: 'BLTAI_API_KEY', baseUrl: 'BLTAI_BASE_URL', defaultBaseUrl: 'https://api.bltcy.ai' },
  scopes: { image: 'images', video: 'videos' },
  buildPayload,
  extractOutputs,
  async submit({ baseUrl, apiKey, scope, payload }: any) { return submitTask(baseUrl, apiKey, scope, payload); },
  async poll({ baseUrl, apiKey, scope, taskId, timeoutMs = 1800000, debug = false }: any) { 
    return pollTask(baseUrl, apiKey, scope, taskId, timeoutMs, debug); 
  }
};
