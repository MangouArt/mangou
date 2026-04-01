import { AIGC_PROVIDER_TEMPLATE } from './aigc-provider-template.mjs';

function joinUrl(base, ...parts) {
  const normalizedBase = String(base || '').replace(/\/+$/, '');
  const normalizedPath = parts
    .map((part) => String(part || '').replace(/^\/+/, '').replace(/\/+$/, ''))
    .filter(Boolean)
    .join('/');
  return normalizedPath ? `${normalizedBase}/${normalizedPath}` : normalizedBase;
}

async function uploadToKie(apiKey, dataUrl, fetchImpl = fetch) {
  const uploadBaseUrl = 'https://api.kie.ai';
  const endpoint = joinUrl(uploadBaseUrl, 'api/file-stream-upload');

  const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid Data URL: expected data:<mime>;base64,<data>');
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');
  const blob = new Blob([buffer], { type: mimeType });

  const formData = new FormData();
  // Using 'image.png' as default filename; the server will accept it or overwrite based on content
  formData.append('file', blob, 'upload.png');
  formData.append('uploadPath', 'mangou-uploads');

  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(`KIE stream upload failed: ${response.status} ${JSON.stringify(result)}`);
  }

  return result.data.downloadUrl;
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
    const prompt = (params.prompt || '').trim();
    if (!prompt) {
      throw new Error(`[kie] Missing required parameter: 'prompt'`);
    }

    const model = params.model;
    if (!model) {
      throw new Error(`[kie] Missing required parameter: 'model'. Please specify a valid model in tasks.${scope}.params.model`);
    }

    if (scope === 'videos') {
      const images = Array.isArray(params.images)
        ? params.images.filter(Boolean)
        : (params.images ? [params.images] : (params.image_url ? [params.image_url] : (params.image ? [params.image] : [])));
      
      if (images.length === 0) {
        throw new Error(`[kie] Missing required input: 'images' or 'image_url' is required for video generation`);
      }

      return {
        model,
        input: {
          prompt,
          images,
          resolution: params.resolution || '720p',
          duration: String(params.duration || '5'),
          nsfw_checker: params.nsfw_checker !== undefined ? params.nsfw_checker : true,
        },
      };
    }

    if (scope === 'images') {
      const images = Array.isArray(params.images)
        ? params.images.filter(Boolean)
        : (params.images ? [params.images] : []);

      if (model === 'nano-banana' || model === 'nano-banana-2' || model === 'nano-banana-v1' || model === 'nano-banana-v2') {
        return {
          model,
          input: {
            prompt,
            image_input: images.length > 0 ? images : undefined,
            aspect_ratio: params.aspect_ratio || params.ratio || 'auto',
            resolution: params.resolution || '1K',
            output_format: params.output_format || 'jpg',
          },
        };
      }

      if (model === 'google/nano-banana-edit') {
        if (images.length === 0) {
          throw new Error(`[kie] Missing required input: 'images' is required for an 'edit' model`);
        }
        return {
          model,
          input: {
            prompt,
            image_urls: images,
            output_format: params.output_format || 'png',
            image_size: params.aspect_ratio || params.ratio || params.image_size || '1:1',
          },
        };
      }
      
      // Fallback for custom/new models with basic input structure
      return {
        model,
        input: {
            prompt,
            images,
        },
      };
    }

    return params;
  },
  async submit({ baseUrl, apiKey, scope, payload, fetchImpl = fetch }) {
    // Deep clone payload to avoid mutating original
    const finalPayload = JSON.parse(JSON.stringify(payload));

    // Handle file uploads for KIE
    if (scope === 'videos') {
      const images = finalPayload.input?.images || [];
      for (let i = 0; i < images.length; i++) {
        if (images[i] && images[i].startsWith('data:')) {
          console.error(`[kie] Uploading video ref image ${i + 1} to KIE...`);
          images[i] = await uploadToKie(apiKey, images[i], fetchImpl);
        }
      }
    } else if (scope === 'images') {
      const model = finalPayload.model;
      if (model === 'nano-banana' || model === 'nano-banana-2') {
        const images = finalPayload.input?.image_input || [];
        for (let i = 0; i < images.length; i++) {
          if (images[i].startsWith('data:')) {
            console.error(`[kie] Uploading image ${i + 1} to KIE...`);
            images[i] = await uploadToKie(apiKey, images[i], fetchImpl);
          }
        }
      } else if (model === 'google/nano-banana-edit') {
        const images = finalPayload.input?.image_urls || [];
        for (let i = 0; i < images.length; i++) {
          if (images[i].startsWith('data:')) {
            console.error(`[kie] Uploading image ${i + 1} to KIE...`);
            images[i] = await uploadToKie(apiKey, images[i], fetchImpl);
          }
        }
      }
    }

    const endpoint = joinUrl(baseUrl, 'api/v1/jobs/createTask');

    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(finalPayload),
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
