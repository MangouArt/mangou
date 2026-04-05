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

async function uploadToKie(apiKey: string, dataUrl: string, fetchImpl = fetchWithRetry) {
  const uploadBaseUrl = 'https://kieai.redpandaai.co';
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

async function fetchWithRetry(url: any, options: any, maxRetries = 3) {
  let lastError: unknown;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (err: unknown) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[kie] fetch failed (attempt ${i + 1}/${maxRetries}): ${message}`);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
      }
    }
  }
  throw lastError;
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
  buildPayload(scope: any, params: any) {
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
      
      if (model.includes('seedance-2')) {
        const reference_image_urls = params.reference_image_urls || images || [];
        return {
          model,
          input: {
            prompt,
            reference_image_urls: Array.isArray(reference_image_urls) ? reference_image_urls : [reference_image_urls],
            reference_video_urls: params.reference_video_urls || [],
            reference_audio_urls: params.reference_audio_urls || [],
            return_last_frame: params.return_last_frame || false,
            generate_audio: params.generate_audio !== undefined ? params.generate_audio : true,
            resolution: params.resolution || '480p',
            aspect_ratio: params.aspect_ratio || '16:9',
            duration: Number(params.duration || 15),
            web_search: params.web_search !== undefined ? params.web_search : false,
          },
        };
      }

      if (images.length === 0) {
        throw new Error(`[kie] Missing required input: 'images' or 'image_url' is required for video generation`);
      }

      return {
        model,
        input: {
          prompt,
          image_url: images[0] || '', // KIE expects single image_url string for this model
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
  async submit({ baseUrl, apiKey, scope, payload, fetchImpl = fetchWithRetry }: any) {
    // Deep clone payload to avoid mutating original
    const finalPayload = JSON.parse(JSON.stringify(payload));
    const loggedPayload = {
      ...finalPayload,
      input: {
        ...finalPayload.input,
        image_url: finalPayload.input?.image_url?.startsWith('data:') ? finalPayload.input.image_url.substring(0, 100) + '...' : finalPayload.input?.image_url,
        image_urls: finalPayload.input?.image_urls?.map((url: string) => url.startsWith('data:') ? url.substring(0, 100) + '...' : url)
      }
    };
    console.error(`[kie] Submit payload for ${scope}:`, JSON.stringify(loggedPayload, null, 2));

    // Handle file uploads for KIE
    if (scope === 'videos') {
      const model = finalPayload.model;
      if (model.includes('seedance-2')) {
        // Handle reference_image_urls
        if (Array.isArray(finalPayload.input?.reference_image_urls)) {
          for (let i = 0; i < finalPayload.input.reference_image_urls.length; i++) {
            if (finalPayload.input.reference_image_urls[i]?.startsWith('data:')) {
              console.error(`[kie] Uploading reference image ${i + 1} to KIE...`);
              finalPayload.input.reference_image_urls[i] = await uploadToKie(apiKey, finalPayload.input.reference_image_urls[i], fetchImpl);
            }
          }
        }
      } else {
        const imageUrl = finalPayload.input?.image_url;
        if (imageUrl && imageUrl.startsWith('data:')) {
          console.error(`[kie] Uploading video ref image to KIE...`);
          finalPayload.input.image_url = await uploadToKie(apiKey, imageUrl, fetchImpl);
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
    console.error(`[kie] Submit response for ${scope}:`, JSON.stringify(data, null, 2));
    if (!response.ok) {
      throw new Error(`Submit failed: ${response.status} ${JSON.stringify(data)}`);
    }

    const taskId = data.data?.taskId;
    if (!taskId) {
      throw new Error(`Missing task id: ${JSON.stringify(data)}`);
    }
    return taskId;
  },
  async poll({ baseUrl, apiKey, scope, taskId, timeoutMs = 30 * 60 * 1000, debug = false, fetchImpl = fetchWithRetry }: any) {
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
      console.error(`[kie] Poll response for ${taskId}:`, JSON.stringify(data, null, 2));
      const state = String(data.data?.state || '').toLowerCase();

      if (debug) {
        console.error('[kie] poll state:', state || '(empty)');
      }

      if (state === 'success') {
        const resultUrls = data.data?.resultUrls || [];
        if (resultUrls.length === 0 && scope === 'videos') {
          // If no resultUrls but state is success, it might be a false success or nested result
          try {
            const resultJson = typeof data.data?.resultJson === 'string' 
              ? JSON.parse(data.data.resultJson) 
              : data.data?.resultJson;
            if (!resultJson?.resultUrls || resultJson.resultUrls.length === 0) {
              throw new Error(`[kie] Task success but no resultUrls found in payload: ${JSON.stringify(data.data)}`);
            }
          } catch (e: unknown) {
             throw new Error(`[kie] False success - result validation failed: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
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
  extractOutputs(scope: any, result: any) {
    try {
      const resultJson = typeof result.resultJson === 'string' 
        ? JSON.parse(result.resultJson) 
        : result.resultJson;
      return resultJson?.resultUrls || [];
    } catch (e: unknown) {
      console.error('[kie] extractOutputs error:', e);
      return [];
    }
  },
};
