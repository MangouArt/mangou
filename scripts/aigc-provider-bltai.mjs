import { AIGC_PROVIDER_TEMPLATE } from './aigc-provider-template.mjs';

function joinUrl(base, ...parts) {
  const normalizedBase = String(base || '').replace(/\/+$/, '');
  const normalizedPath = parts
    .map((part) => String(part || '').replace(/^\/+/, '').replace(/\/+$/, ''))
    .filter(Boolean)
    .join('/');
  return normalizedPath ? `${normalizedBase}/${normalizedPath}` : normalizedBase;
}

function normalizeBaseUrl(baseUrl) {
  let normalized = String(baseUrl || '').trim() || 'https://api.bltcy.ai';
  normalized = normalized.replace(/\/+$/, '');
  normalized = normalized.replace(/\/v[12]$/, '');
  return normalized;
}

async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (err) {
      lastError = err;
      console.error(`[bltai] fetch failed (attempt ${i + 1}/${maxRetries}): ${err.message}`);
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
  buildPayload(scope, params) {
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
      const payload = {
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
      if (Array.isArray(params.images) && params.images.length > 0) {
        payload.image = params.images;
      } else if (params.image) {
        payload.image = [params.image];
      }
      return payload;
    }

    if (scope === 'videos') {
      const images = Array.isArray(params.images)
        ? params.images.filter(Boolean)
        : (params.images ? [params.images] : []);
      
      const payload = {
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
  async submit({ baseUrl, apiKey, scope, payload, fetchImpl = fetchWithRetry }) {
    const normalizedBase = normalizeBaseUrl(baseUrl);
    const endpoint = scope === 'images'
      ? joinUrl(normalizedBase, 'v1', 'images', 'generations')
      : joinUrl(normalizedBase, 'v2', 'videos', 'generations');

    const loggedPayload = {
      ...payload,
      images: payload.images?.map(img => typeof img === 'string' && img.startsWith('data:') ? img.substring(0, 100) + '...' : img),
      image_url: payload.image_url ? (payload.image_url.startsWith('data:') ? payload.image_url.substring(0, 100) + '...' : payload.image_url) : undefined
    };
    console.error(`[bltai] Submit payload for ${scope}:`, JSON.stringify(loggedPayload, null, 2));

    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.error(`[bltai] Submit response for ${scope}:`, JSON.stringify(data, null, 2));

    if (!response.ok) {
      throw new Error(`Submit failed: ${response.status} ${JSON.stringify(data)}`);
    }

    const taskId = data.id || data.task_id || data.data?.id || data.data?.task_id || data.task?.id || (Array.isArray(data.data) ? 'instant' : null);
    
    if (taskId === 'instant' || (data.data && Array.isArray(data.data) && data.data[0]?.url)) {
      return { instantData: data };
    }

    if (!taskId) {
      throw new Error(`Missing task id: ${JSON.stringify(data)}`);
    }
    return taskId;
  },
  async poll({ baseUrl, apiKey, scope, taskId, timeoutMs = 30 * 60 * 1000, debug = false, fetchImpl = fetchWithRetry }) {
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

      const data = await response.json();
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
  extractOutputs(scope, result) {
    console.error(`[bltai] Extracting outputs from ${scope}:`, JSON.stringify(result, null, 2));
    if (scope === 'images') {
      const records = result?.data?.data || result?.data || [];
      return records.map((item) => item.url).filter(Boolean);
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
