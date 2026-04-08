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
      const response = await fetch(url, options);
      return response;
    } catch (err: unknown) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[jiekou] fetch failed (attempt ${i + 1}/${maxRetries}): ${message}`);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
      }
    }
  }
  throw lastError;
}

function dataUrlToBase64(dataUrl: string) {
  const matches = dataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid Data URL: expected data:<mime>;base64,<data>');
  }
  return matches[2];
}

function encodeNestedSubjectImages(subjects: any[]) {
  for (const subject of subjects) {
    if (!subject || !Array.isArray(subject.images)) {
      continue;
    }

    for (let i = 0; i < subject.images.length; i++) {
      const image = subject.images[i];
      if (typeof image === 'string' && image.startsWith('data:')) {
        subject.images[i] = dataUrlToBase64(image);
      }
    }
  }
}

export const JIEKOU_PROVIDER = {
  ...AIGC_PROVIDER_TEMPLATE,
  id: 'jiekou',
  label: 'JieKou AI',
  env: {
    apiKey: 'JIEKOU_API_KEY',
    baseUrl: 'JIEKOU_BASE_URL',
    defaultBaseUrl: 'https://api.jiekou.ai',
  },
  scopes: {
    image: 'images',
    video: 'videos',
  },
  buildPayload(scope: any, params: any) {
    const prompt = (params.prompt || '').trim();
    if (!prompt && scope === 'videos') {
      // In some modes prompt might be optional if images are provided, but usually required
    }

    const model = params.model;
    if (!model) {
      throw new Error(`[jiekou] Missing required parameter: 'model'`);
    }

    // Seedance 2.0 parameter mapping
    if (model.includes('seedance-2.0')) {
      return {
        model,
        prompt,
        fast: params.fast !== undefined ? params.fast : model.includes('fast'),
        seed: params.seed !== undefined ? params.seed : -1,
        image: params.image || params.first_frame_url,
        last_image: params.last_image || params.last_frame_url,
        ratio: params.ratio || params.aspect_ratio || 'adaptive',
        duration: params.duration !== undefined ? Number(params.duration) : 5,
        resolution: params.resolution || '720p',
        watermark: params.watermark !== undefined ? params.watermark : false,
        web_search: params.web_search !== undefined ? params.web_search : false,
        generate_audio: params.generate_audio !== undefined ? params.generate_audio : true,
        reference_images: params.reference_images || params.reference_image_urls,
        reference_videos: params.reference_videos || params.reference_video_urls,
        reference_audios: params.reference_audios || params.reference_audio_urls,
        return_last_frame: params.return_last_frame !== undefined ? params.return_last_frame : false,
      };
    }

    if (model.includes('viduq2-pro-fast')) {
      return {
        model,
        prompt,
        bgm: params.bgm !== undefined ? params.bgm : false,
        seed: params.seed,
        audio: params.audio !== undefined ? params.audio : false,
        duration: params.duration !== undefined ? Number(params.duration) : 5,
        subjects: params.subjects || [],
        watermark: params.watermark !== undefined ? params.watermark : false,
        resolution: params.resolution || '720p',
        aspect_ratio: params.aspect_ratio,
        movement_amplitude: params.movement_amplitude,
      };
    }

    // Fallback for other models (unified format)
    return {
      model,
      input: {
        prompt,
        ...params
      }
    };
  },
  async submit({ baseUrl, apiKey, scope, payload, fetchImpl = fetchWithRetry }: any) {
    // 1. Prepare media inputs (Deep clone to avoid proxy/readonly issues)
    const finalPayload = JSON.parse(JSON.stringify(payload));
    const model = String(finalPayload.model || '');

    // JieKou Seedance 2.0 accepts base64-encoded media content directly.
    if (Array.isArray(finalPayload.reference_images)) {
      for (let i = 0; i < finalPayload.reference_images.length; i++) {
        const url = finalPayload.reference_images[i];
        if (url && url.startsWith('data:')) {
          finalPayload.reference_images[i] = dataUrlToBase64(url);
        }
      }
    }

    for (const key of ['image', 'last_image']) {
      const url = finalPayload[key];
      if (url && url.startsWith('data:')) {
        finalPayload[key] = dataUrlToBase64(url);
      }
    }

    if (Array.isArray(finalPayload.subjects)) {
      encodeNestedSubjectImages(finalPayload.subjects);
    }

    // 2. Determine endpoint
    // User requested: https://api.jiekou.ai/v3/async/seedance-2.0
    let endpoint = joinUrl(baseUrl, 'api/v1/jobs/createTask');
    if (model.includes('seedance-2.0')) {
      // If the provided baseUrl already contains v3/async, use it as is
      if (baseUrl.includes('v3/async')) {
        endpoint = baseUrl;
      } else {
        endpoint = joinUrl(baseUrl, 'v3/async/seedance-2.0');
      }
      // Seedance 2.0 uses a model-specific endpoint; `model` is routing metadata, not request body.
      delete finalPayload.model;
    } else if (model.includes('viduq2-pro-fast')) {
      endpoint = baseUrl.includes('v3/async')
        ? baseUrl
        : joinUrl(baseUrl, 'v3/async/viduq2-pro-fast');
      delete finalPayload.model;
    }

    console.error(`[jiekou] Submitting to ${endpoint}...`);
    
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(finalPayload),
    });

    const data = await response.json();
    console.error(`[jiekou] Submit response status: ${response.status}`);
    console.error(`[jiekou] Submit response body: ${JSON.stringify(data)}`);
    if (!response.ok) {
      throw new Error(`Submit failed: ${response.status} ${JSON.stringify(data)}`);
    }

    const taskId = data.task_id || data.data?.taskId || data.data?.task_id;
    if (!taskId) {
      throw new Error(`Missing task id in response: ${JSON.stringify(data)}`);
    }
    return taskId;
  },
  async poll({ baseUrl, apiKey, taskId, timeoutMs = 30 * 60 * 1000, debug = false, fetchImpl = fetchWithRetry }: any) {
    // Polling endpoint: https://api.jiekou.ai/v3/async/task-result?task_id=...
    const pollBase = baseUrl.includes('v3/async') ? baseUrl.split('/v3/async')[0] : baseUrl;
    const endpoint = joinUrl(pollBase, `v3/async/task-result?task_id=${taskId}`);

    const startedAt = Date.now();
    let delayMs = 2000;

    for (;;) {
      const response = await fetchImpl(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Poll failed: ${response.status} ${text}`);
      }

      const data = await response.json();
      if (debug) {
        console.error(`[jiekou] Poll response:`, JSON.stringify(data, null, 2));
      }

      // New status format: TASK_STATUS_SUCCEED, TASK_STATUS_FAILED, TASK_STATUS_PROCESSING
      const status = String(data.task?.status || data.data?.state || '').toUpperCase();

      if (status === 'TASK_STATUS_SUCCEED' || status === 'SUCCESS') {
        return data;
      }
      if (status === 'TASK_STATUS_FAILED' || status === 'FAIL' || status === 'FAILED') {
        const reason = data.task?.reason || data.data?.failMsg || 'Unknown error';
        throw new Error(`Jiekou task failed: ${reason}`);
      }
      
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error('Provider polling timeout');
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs + 2000, 15000);
    }
  },
  extractOutputs(scope: any, result: any) {
    // Handle the new response format: data.videos, data.images, data.audios
    if (scope === 'videos') {
       const videos = result.videos || result.data?.resultUrls || [];
       return videos.map((v: any) => typeof v === 'string' ? v : v.video_url).filter(Boolean);
    }
    if (scope === 'images') {
       const images = result.images || result.data?.resultUrls || [];
       return images.map((img: any) => typeof img === 'string' ? img : img.image_url).filter(Boolean);
    }
    return [];
  },
};
