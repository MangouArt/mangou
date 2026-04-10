#!/usr/bin/env bun
import { AIGC_PROVIDER_TEMPLATE } from '@logic/aigc-provider-template';

type BLTAIImagePayload = {
  prompt: string;
  model: string;
  response_format: string;
  aspect_ratio?: string;
  image_size?: string;
  image?: string[];
};

type BLTAIVideoPayload = {
  model: string;
  prompt: string;
  images: string[];
  duration: number;
  ratio?: string;
  resolution?: string;
};

function joinUrl(base: any, ...parts: any[]) {
  const normalizedBase = String(base || '').replace(/\/+$/, '');
  const normalizedPath = parts
    .map((part) => String(part || '').replace(/^\/+/, '').replace(/\/+$/, ''))
    .filter(Boolean)
    .join('/');
  return normalizedPath ? `${normalizedBase}/${normalizedPath}` : normalizedBase;
}

function normalizeBaseUrl(baseUrl: any) {
  let normalized = String(baseUrl || '').trim() || 'https://api.bltcy.ai';
  normalized = normalized.replace(/\/+$/, '');
  normalized = normalized.replace(/\/v[12]$/, '');
  return normalized;
}

function ensureNoDeprecatedImageAliases(params: any) {
  if (params.images !== undefined) {
    throw new Error(`[bltai] YAML 参数必须与接口文档一致。图像生成请使用 'image: []'，不要使用 'images'.`);
  }
}

function extractUploadedFileUrl(result: any) {
  const url =
    result?.url ||
    result?.data?.url ||
    result?.file?.url ||
    result?.data?.file?.url;
  if (!url || typeof url !== 'string') {
    throw new Error(`[bltai] File upload succeeded but no file url was returned: ${JSON.stringify(result)}`);
  }
  return url;
}

async function parseJsonResponse(response: Response, context: string) {
  if (typeof (response as any).text !== 'function') {
    if (typeof (response as any).json === 'function') {
      return await (response as any).json();
    }
    throw new Error(`[bltai] Failed to parse JSON from ${context}: response has neither text() nor json()`);
  }

  const raw = await response.text();
  try {
    return JSON.parse(raw);
  } catch {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let i = 0; i < trimmed.length; i++) {
        const ch = trimmed[i];
        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (ch === '\\') {
            escaped = true;
          } else if (ch === '"') {
            inString = false;
          }
          continue;
        }
        if (ch === '"') {
          inString = true;
          continue;
        }
        if (ch === '{') depth++;
        if (ch === '}') {
          depth--;
          if (depth === 0) {
            const firstObject = trimmed.slice(0, i + 1);
            try {
              return JSON.parse(firstObject);
            } catch {
              break;
            }
          }
        }
      }
    }
    const preview = raw.slice(0, 400);
    throw new Error(`[bltai] Failed to parse JSON from ${context}: ${response.status} ${preview}`);
  }
}

async function uploadToBLTAI(baseUrl: string, apiKey: string, dataUrl: string, fetchImpl = fetchWithRetry) {
  const matches = dataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('[bltai] Invalid Data URL: expected data:<mime>;base64,<data>');
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');
  const blob = new Blob([buffer], { type: mimeType });
  const endpoint = joinUrl(normalizeBaseUrl(baseUrl), 'v1', 'files');
  const formData = new FormData();
  formData.append('file', blob, 'upload.png');

  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const result = await parseJsonResponse(response, 'file upload');
  if (!response.ok) {
    throw new Error(`[bltai] File upload failed: ${response.status} ${JSON.stringify(result)}`);
  }

  return extractUploadedFileUrl(result);
}

async function fetchWithRetry(url: any, options: any, maxRetries = 3) {
  let lastError: unknown;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (err: unknown) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[bltai] fetch failed (attempt ${i + 1}/${maxRetries}): ${message}`);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
      }
    }
  }
  throw lastError;
}

export const BLTAI_PROVIDER = {
  ...AIGC_PROVIDER_TEMPLATE,
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
  buildPayload(scope: any, params: any) {
    const prompt = (params.prompt || '').trim();
    if (!prompt) {
      throw new Error(`[bltai] Missing required parameter: 'prompt'`);
    }

    const model = params.model;
    if (!model) {
      if (scope === 'images') {
        throw new Error(`[bltai] 缺失 'model' 参数。可用图像模型: nano-banana, nano-banana-2。请在 YAML 的 tasks.image.params.model 中指定。`);
      } else {
        throw new Error(`[bltai] 缺失 'model' 参数。可用视频模型: doubao-seedance-1-0-pro-fast-251015, veo3.1-fast。请在 YAML 的 tasks.video.params.model 中指定。`);
      }
    }

    if (scope === 'images') {
      ensureNoDeprecatedImageAliases(params);
      const payload: BLTAIImagePayload = {
        prompt,
        model,
        response_format: 'url',
      };
      if (params.aspect_ratio) {
        payload.aspect_ratio = params.aspect_ratio;
      }
      if (params.image_size) {
        payload.image_size = params.image_size;
      }
      if (Array.isArray(params.image) && params.image.length > 0) {
        payload.image = params.image;
      } else if (params.image !== undefined) {
        throw new Error(`[bltai] 'image' 必须是数组，格式请参考 docs/vendor-api/bltai-gemini-3.1-flash-image-preview.md`);
      }
      return payload;
    }

    if (scope === 'videos') {
      const images = Array.isArray(params.images)
        ? params.images.filter(Boolean)
        : (params.images ? [params.images] : []);
      
      const payload: BLTAIVideoPayload = {
        model,
        prompt,
        images,
        duration: params.duration || 5,
      };
      if (params.ratio || params.aspect_ratio) {
        payload.ratio = params.ratio || params.aspect_ratio;
      }
      if (params.resolution) {
        payload.resolution = params.resolution;
      }
      return payload;
    }
    return params;
  },
  async submit({ baseUrl, apiKey, scope, payload, fetchImpl = fetchWithRetry }: any) {
    const finalPayload = JSON.parse(JSON.stringify(payload));
    const normalizedBase = normalizeBaseUrl(baseUrl);
    let endpoint = scope === 'images'
      ? joinUrl(normalizedBase, 'v1', 'images', 'generations')
      : joinUrl(normalizedBase, 'v2', 'videos', 'generations');

    if (scope === 'images') {
      endpoint += '?async=true';
      if (Array.isArray(finalPayload.image)) {
        for (let i = 0; i < finalPayload.image.length; i++) {
          const image = finalPayload.image[i];
          if (typeof image === 'string' && image.startsWith('data:')) {
            console.error(`[bltai] Uploading image ${i + 1} to BLTAI...`);
            finalPayload.image[i] = await uploadToBLTAI(normalizedBase, apiKey, image, fetchImpl);
          }
        }
      }
    }

    const loggedPayload = {
      ...finalPayload,
      images: finalPayload.images?.map((img: any) => typeof img === 'string' && img.startsWith('data:') ? img.substring(0, 100) + '...' : img),
      image: finalPayload.image?.map((img: any) => typeof img === 'string' && img.startsWith('data:') ? img.substring(0, 100) + '...' : img),
      image_url: finalPayload.image_url ? (finalPayload.image_url.startsWith('data:') ? finalPayload.image_url.substring(0, 100) + '...' : finalPayload.image_url) : undefined
    };
    console.error(`[bltai] Submit payload for ${scope}:`, JSON.stringify(loggedPayload, null, 2));

    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(finalPayload),
    });

    const data = await parseJsonResponse(response, `${scope} submit`);
    console.error(`[bltai] Submit response for ${scope}:`, JSON.stringify(data, null, 2));

    if (!response.ok) {
      throw new Error(`Submit failed: ${response.status} ${JSON.stringify(data)}`);
    }

    let taskId = null;
    if (scope === 'images' && typeof data.data === 'string') {
      taskId = data.data;
    } else {
      taskId = data.id || data.task_id || data.data?.id || data.data?.task_id || data.task?.id || (Array.isArray(data.data) ? 'instant' : null);
    }
    
    if (taskId === 'instant' || (data.data && Array.isArray(data.data) && data.data[0]?.url)) {
      return { instantData: data };
    }

    if (!taskId) {
      throw new Error(`Missing task id: ${JSON.stringify(data)}`);
    }
    return taskId;
  },
  async poll({ baseUrl, apiKey, scope, taskId, timeoutMs = 30 * 60 * 1000, debug = false, fetchImpl = fetchWithRetry }: any) {
    if (taskId && typeof taskId === 'object' && taskId.instantData) {
      return taskId.instantData;
    }

    const normalizedBase = normalizeBaseUrl(baseUrl);
    const endpoint = scope === 'images'
      ? joinUrl(normalizedBase, 'v1', 'images', 'tasks', taskId)
      : joinUrl(normalizedBase, 'v2', 'videos', 'generations', taskId);

    const startedAt = Date.now();
    let delayMs = 2000;

    for (;;) {
      const response = await fetchImpl(endpoint, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Poll failed: ${response.status} ${text}`);
      }

      const data = await parseJsonResponse(response, `${scope} poll ${taskId}`);
      console.error(`[bltai] Poll response for ${taskId}:`, JSON.stringify(data, null, 2));

      const rawStatus = data.status || data.state || data.task_status || data.data?.status || data.task?.status || '';
      const statusStr = String(rawStatus).toUpperCase();
      
      if (debug) {
        console.error('[bltai] poll status:', statusStr || '(empty)');
      }

      if (['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'DONE', 'FINISHED'].includes(statusStr)) {
        return data;
      }
      if (['FAILED', 'FAILURE', 'ERROR', 'CANCELLED', 'CANCELED', 'TIMEOUT', 'EXPIRED'].includes(statusStr)) {
        throw new Error(data.error?.message || data.fail_reason || data.data?.fail_reason || 'Provider task failed');
      }
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error('Provider polling timeout');
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs + 2000, 15000);
    }
  },
  extractOutputs(scope: any, result: any) {
    console.error(`[bltai] Extracting outputs from ${scope}:`, JSON.stringify(result, null, 2));
    if (scope === 'images') {
      // Handle nested structures from polling results
      let records = result?.data?.data?.data || result?.data?.data || result?.data || [];
      if (!Array.isArray(records) && typeof records === 'object' && Array.isArray(records.data)) {
        records = records.data;
      }
      if (!Array.isArray(records)) records = [];
      return records.map((item: any) => item.url).filter(Boolean);
    }

    const data = result?.data || result;
    const videoUrl =
      data?.output ||
      data?.video_url ||
      data?.data?.output ||
      data?.data?.video_url ||
      data?.output?.url ||
      data?.url;
    if (videoUrl) return [videoUrl];
    if (Array.isArray(data?.outputs)) return data.outputs.filter(Boolean);
    return [];
  },
};
