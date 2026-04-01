import { AIGC_PROVIDER_TEMPLATE } from './aigc-provider-template.mjs';

function joinUrl(base, ...parts) {
  const normalizedBase = String(base || '').replace(/\/+$/, '');
  const normalizedPath = parts
    .map((part) => String(part || '').replace(/^\/+/, '').replace(/\/+$/, ''))
    .filter(Boolean)
    .join('/');
  return normalizedPath ? `${normalizedBase}/${normalizedPath}` : normalizedBase;
}

export const KIE_PROVIDER = {
  ...AIGC_PROVIDER_TEMPLATE,
  id: 'kie',
  label: 'KIE AI',
  env: {
    apiKey: 'KIE_API_KEY',
    baseUrl: 'KIE_BASE_URL',
    defaultBaseUrl: 'https://api.kie.ai',
  },
  scopes: {
    image: 'images',
    video: 'videos',
  },
  buildPayload(scope, params) {
    if (scope === 'videos') {
      const images = Array.isArray(params.images)
        ? params.images.filter(Boolean)
        : (params.images ? [params.images] : []);
      const imageUrl = params.image_url || images[0] || params.image;

      return {
        model: params.model || 'bytedance/v1-pro-fast-image-to-video',
        input: {
          prompt: params.prompt || '',
          image_url: imageUrl,
          resolution: params.resolution || '720p',
          duration: String(params.duration || '5'),
          nsfw_checker: params.nsfw_checker !== undefined ? params.nsfw_checker : true,
        },
      };
    }
    // KIE only used for image-to-video in current request, but we could add image-to-image if it supports it.
    // For now, let's keep it simple as requested.
    return params;
  },
  async submit({ baseUrl, apiKey, scope, payload, fetchImpl = fetch }) {
    const endpoint = joinUrl(baseUrl, 'api/v1/jobs/createTask');

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

    const taskId = data.data?.taskId;
    if (!taskId) {
      throw new Error(`Missing task id: ${JSON.stringify(data)}`);
    }
    return taskId;
  },
  async poll({ baseUrl, apiKey, scope, taskId, timeoutMs = 30 * 60 * 1000, debug = false, fetchImpl = fetch }) {
    const endpoint = joinUrl(baseUrl, `api/v1/jobs/recordInfo?taskId=${taskId}`);

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
      const state = String(data.data?.state || '').toLowerCase();

      if (debug) {
        console.error('[kie] poll state:', state || '(empty)');
      }

      if (state === 'success') {
        return data.data;
      }
      if (state === 'fail') {
        throw new Error(`KIE task failed: ${data.data?.failMsg || 'Unknown error'}`);
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
      // Not implemented for KIE images based on current docs
      return [];
    }

    try {
      const resultJson = typeof result.resultJson === 'string' 
        ? JSON.parse(result.resultJson) 
        : result.resultJson;
      return resultJson?.resultUrls || [];
    } catch (e) {
      console.error('[kie] extractOutputs error:', e);
      return [];
    }
  },
};
