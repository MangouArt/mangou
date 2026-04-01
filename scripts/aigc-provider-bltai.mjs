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
    if (scope === 'images') {
      const payload = {
        prompt: params.prompt || '',
        model: params.model || 'nano-banana',
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
        model: params.model || 'doubao-seedance-1-0-pro-fast-251015',
        prompt: params.prompt || '',
        images,
        duration: params.duration || 5,
      };
      if (params.ratio || params.aspect_ratio) {
        payload.ratio = params.ratio || params.aspect_ratio;
      }
      return payload;
    }
    return params;
  },
  async submit({ baseUrl, apiKey, scope, payload, fetchImpl = fetch }) {
    const normalizedBase = normalizeBaseUrl(baseUrl);
    const endpoint = scope === 'images'
      ? joinUrl(normalizedBase, 'v1', 'images', 'generations')
      : joinUrl(normalizedBase, 'v2', 'videos', 'generations');

    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
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
  async poll({ baseUrl, apiKey, scope, taskId, timeoutMs = 30 * 60 * 1000, debug = false, fetchImpl = fetch }) {
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
