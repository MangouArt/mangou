#!/usr/bin/env bun
import { AIGC_PROVIDER_TEMPLATE } from '@logic/aigc-provider-template';

function joinUrl(base: any, ...parts: any[]) {
  const normalizedBase = String(base || '').replace(/\/+$/, '');
  const normalizedPath = parts
    .map((part) => String(part || '').replace(/^\/+/, '').replace(/\/+$/, ''))
    .filter(Boolean)
    .join('/');
  return normalizedPath ? `${normalizedBase}/${normalizedPath}` : normalizedBase;
}

async function fetchWithRetry(url: any, options: any, maxRetries = 3) {
  let lastError: unknown;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url, options);
    } catch (err: unknown) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[evolink] fetch failed (attempt ${i + 1}/${maxRetries}): ${message}`);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
      }
    }
  }
  throw lastError;
}

async function uploadToEvolink(apiKey: string, dataUrl: string, fetchImpl = fetchWithRetry) {
  const endpoint = 'https://files-api.evolink.ai/api/v1/files/upload/stream';
  const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid Data URL: expected data:<mime>;base64,<data>');
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const extension = mimeType.split('/')[1] || 'png';
  const buffer = Buffer.from(base64Data, 'base64');
  const blob = new Blob([buffer], { type: mimeType });
  const formData = new FormData();
  formData.append('file', blob, `upload.${extension}`);
  formData.append('upload_path', 'mangou-uploads');

  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok || !data?.success) {
    throw new Error(`EvoLink stream upload failed: ${response.status} ${JSON.stringify(data)}`);
  }

  const fileUrl = data?.data?.file_url;
  if (!fileUrl) {
    throw new Error(`EvoLink stream upload missing file_url: ${JSON.stringify(data)}`);
  }

  return fileUrl;
}

function requireMediaUrlArray(params: any, field: string, maxLength?: number, allowDataUrl = false) {
  if (params[field] === undefined || params[field] === null) {
    return [];
  }
  if (!Array.isArray(params[field])) {
    throw new Error(`[evolink] '${field}' 必须是 URL 数组`);
  }

  const values = params[field].filter(Boolean);
  if (maxLength !== undefined && values.length > maxLength) {
    throw new Error(`[evolink] '${field}' 最多只接受 ${maxLength} 个 URL`);
  }

  for (const value of values) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`[evolink] '${field}' 必须是 URL 字符串数组`);
    }
    if (value.startsWith('data:')) {
      if (!allowDataUrl) {
        throw new Error(`[evolink] '${field}' 只接受远程 URL，不接受 data: URL 或裸 base64`);
      }
      continue;
    }
    if (!/^https?:\/\//.test(value)) {
      throw new Error(`[evolink] '${field}' 只接受可直连的 http/https URL`);
    }
  }

  return values;
}

function validateSeedanceQuality(quality: any) {
  if (quality === undefined || quality === null || quality === '') {
    return '720p';
  }
  if (quality === '480p' || quality === '720p') {
    return quality;
  }
  throw new Error("[evolink] seedance-2.0-fast-reference-to-video 的 quality 只接受 '480p' 或 '720p'");
}

function validateDuration(duration: any) {
  const value = duration === undefined || duration === null || duration === '' ? 8 : Number(duration);
  if (!Number.isFinite(value) || value < 5 || value > 12) {
    throw new Error('[evolink] duration 必须在 5 到 12 秒之间');
  }
  return value;
}

function pickVideoOutputs(result: any) {
  const candidates = [
    ...(Array.isArray(result?.results) ? result.results : []),
    ...(Array.isArray(result?.data) ? result.data : []),
    ...(Array.isArray(result?.output) ? result.output : []),
    ...(Array.isArray(result?.outputs) ? result.outputs : []),
    ...(Array.isArray(result?.video_urls) ? result.video_urls : []),
    ...(Array.isArray(result?.result?.videos) ? result.result.videos : []),
  ];

  return candidates
    .map((item: any) => {
      if (typeof item === 'string') {
        return item;
      }
      return item?.url || item?.video_url || item?.download_url || item?.output_url;
    })
    .filter(Boolean);
}

export const EVOLINK_PROVIDER = {
  ...AIGC_PROVIDER_TEMPLATE,
  id: 'evolink',
  label: 'EvoLink AI',
  env: {
    apiKey: 'EVOLINK_API_KEY',
    baseUrl: 'EVOLINK_BASE_URL',
    defaultBaseUrl: 'https://api.evolink.ai',
  },
  scopes: {
    image: 'images',
    video: 'videos',
  },
  buildPayload(scope: any, params: any) {
    if (scope !== 'videos') {
      throw new Error('[evolink] 当前只接入视频能力');
    }

    const model = params.model;
    if (!model) {
      throw new Error("[evolink] Missing required parameter: 'model'");
    }
    if (model !== 'seedance-2.0-fast-reference-to-video') {
      throw new Error(`[evolink] Unsupported model: ${model}`);
    }

    const prompt = String(params.prompt || '').trim();
    if (!prompt) {
      throw new Error("[evolink] Missing required parameter: 'prompt'");
    }

    const image_urls = requireMediaUrlArray(params, 'image_urls', 9, true);
    const video_urls = requireMediaUrlArray(params, 'video_urls', 3, false);
    const audio_urls = requireMediaUrlArray(params, 'audio_urls', 3, false);

    if (image_urls.length === 0 && video_urls.length === 0) {
      throw new Error('[evolink] 至少提供 1 个 image_urls 或 1 个 video_urls');
    }

    return {
      model,
      prompt,
      ...(image_urls.length > 0 ? { image_urls } : {}),
      ...(video_urls.length > 0 ? { video_urls } : {}),
      ...(audio_urls.length > 0 ? { audio_urls } : {}),
      duration: validateDuration(params.duration),
      quality: validateSeedanceQuality(params.quality || params.resolution),
      aspect_ratio: params.aspect_ratio || '16:9',
      generate_audio: params.generate_audio !== undefined ? params.generate_audio : true,
    };
  },
  async submit({ baseUrl, apiKey, payload, fetchImpl = fetchWithRetry }: any) {
    const finalPayload = JSON.parse(JSON.stringify(payload));

    if (Array.isArray(finalPayload.image_urls)) {
      for (let i = 0; i < finalPayload.image_urls.length; i++) {
        const value = finalPayload.image_urls[i];
        if (typeof value === 'string' && value.startsWith('data:')) {
          finalPayload.image_urls[i] = await uploadToEvolink(apiKey, value, fetchImpl);
        }
      }
    }

    const endpoint = joinUrl(baseUrl, 'v1/videos/generations');
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(finalPayload),
    });

    const data = await response.json();
    console.error(`[evolink] Submit response status: ${response.status}`);
    console.error(`[evolink] Submit response body: ${JSON.stringify(data)}`);
    if (!response.ok) {
      throw new Error(`Submit failed: ${response.status} ${JSON.stringify(data)}`);
    }

    const taskId = data.id || data.task_id;
    if (!taskId) {
      throw new Error(`Missing task id in response: ${JSON.stringify(data)}`);
    }
    return taskId;
  },
  async poll({ baseUrl, apiKey, taskId, timeoutMs = 30 * 60 * 1000, debug = false, fetchImpl = fetchWithRetry }: any) {
    const endpoint = joinUrl(baseUrl, 'v1/tasks', taskId);
    const startedAt = Date.now();
    let delayMs = 2000;

    for (;;) {
      const response = await fetchImpl(endpoint, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Poll failed: ${response.status} ${response.statusText} ${text}`);
      }

      const data = await response.json();
      const status = String(data.status || '').toLowerCase();
      if (debug) {
        console.error(`[evolink] Poll response: ${JSON.stringify(data)}`);
      }

      if (status === 'completed' || status === 'success') {
        return data;
      }
      if (status === 'failed' || status === 'error' || status === 'cancelled' || status === 'canceled') {
        throw new Error(data.error?.message || data.error || data.message || 'EvoLink task failed');
      }
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error('Provider polling timeout');
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs + 2000, 15000);
    }
  },
  extractOutputs(scope: any, result: any) {
    if (scope !== 'videos') {
      return [];
    }
    return pickVideoOutputs(result);
  },
};
