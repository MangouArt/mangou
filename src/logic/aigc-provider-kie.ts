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

function requireArrayField(params: any, field: string) {
  if (params[field] === undefined) {
    return [];
  }
  if (!Array.isArray(params[field])) {
    throw new Error(`[kie] '${field}' 必须是数组，格式请参考 docs/vendor-api/README.md`);
  }
  return params[field].filter(Boolean);
}

function requireStringField(params: any, field: string) {
  if (params[field] === undefined || params[field] === null || params[field] === '') {
    return undefined;
  }
  if (typeof params[field] !== 'string') {
    throw new Error(`[kie] '${field}' 必须是字符串，格式请参考 docs/vendor-api/README.md`);
  }
  return params[field];
}

function rejectAlias(params: any, alias: string, expected: string) {
  if (params[alias] !== undefined) {
    throw new Error(`[kie] YAML 参数必须与接口文档一致。请使用 '${expected}'，不要使用 '${alias}'.`);
  }
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
      if (model.includes('seedance-2')) {
        rejectAlias(params, 'images', 'reference_image_urls / first_frame_url / last_frame_url');
        rejectAlias(params, 'image', 'reference_image_urls / first_frame_url / last_frame_url');
        const reference_image_urls = requireArrayField(params, 'reference_image_urls');
        return {
          model,
          ...(params.callBackUrl ? { callBackUrl: params.callBackUrl } : {}),
          input: {
            prompt,
            ...(requireStringField(params, 'first_frame_url') ? { first_frame_url: requireStringField(params, 'first_frame_url') } : {}),
            ...(requireStringField(params, 'last_frame_url') ? { last_frame_url: requireStringField(params, 'last_frame_url') } : {}),
            ...(reference_image_urls.length > 0 ? { reference_image_urls } : {}),
            reference_video_urls: requireArrayField(params, 'reference_video_urls'),
            reference_audio_urls: requireArrayField(params, 'reference_audio_urls'),
            return_last_frame: params.return_last_frame || false,
            generate_audio: params.generate_audio !== undefined ? params.generate_audio : true,
            resolution: params.resolution || '480p',
            aspect_ratio: params.aspect_ratio || '16:9',
            duration: Number(params.duration || 15),
            web_search: params.web_search !== undefined ? params.web_search : false,
          },
        };
      }

      if (model === 'wan/2-7-r2v') {
        rejectAlias(params, 'images', 'reference_image / first_frame');
        rejectAlias(params, 'image', 'reference_image / first_frame');
        const reference_image = requireArrayField(params, 'reference_image');
        const reference_video = requireArrayField(params, 'reference_video');
        const first_frame = requireStringField(params, 'first_frame');
        const reference_voice = requireStringField(params, 'reference_voice');

        return {
          model,
          ...(params.callBackUrl ? { callBackUrl: params.callBackUrl } : {}),
          input: {
            prompt,
            ...(requireStringField(params, 'negative_prompt') ? { negative_prompt: requireStringField(params, 'negative_prompt') } : {}),
            ...(reference_image.length > 0 ? { reference_image } : {}),
            ...(reference_video.length > 0 ? { reference_video } : {}),
            ...(first_frame ? { first_frame } : {}),
            ...(reference_voice ? { reference_voice } : {}),
            resolution: params.resolution || '1080p',
            aspect_ratio: params.aspect_ratio || '16:9',
            duration: Number(params.duration || 5),
            prompt_extend: params.prompt_extend !== undefined ? params.prompt_extend : true,
            watermark: params.watermark !== undefined ? params.watermark : false,
            ...(params.seed !== undefined ? { seed: Number(params.seed) } : {}),
            nsfw_checker: params.nsfw_checker !== undefined ? params.nsfw_checker : false,
          },
        };
      }

      rejectAlias(params, 'images', 'image_url');
      rejectAlias(params, 'image', 'image_url');
      const imageUrl = requireStringField(params, 'image_url');
      if (!imageUrl) {
        throw new Error(`[kie] Missing required input: 'image_url' is required for video generation`);
      }

      return {
        model,
        ...(params.callBackUrl ? { callBackUrl: params.callBackUrl } : {}),
        input: {
          prompt,
          image_url: imageUrl,
          resolution: params.resolution || '720p',
          duration: String(params.duration || '5'),
          nsfw_checker: params.nsfw_checker !== undefined ? params.nsfw_checker : true,
        },
      };
    }

    if (scope === 'images') {
      rejectAlias(params, 'images', 'image / image_input / image_urls');

      if (model === 'google/nano-banana') {
        rejectAlias(params, 'aspect_ratio', 'image_size');
        return {
          model,
          ...(params.callBackUrl ? { callBackUrl: params.callBackUrl } : {}),
          input: {
            prompt,
            output_format: params.output_format || 'png',
            image_size: params.image_size || '1:1',
          },
        };
      }

      if (model === 'nano-banana-2') {
        const imageInput = requireArrayField(params, 'image_input');
        return {
          model,
          ...(params.callBackUrl ? { callBackUrl: params.callBackUrl } : {}),
          input: {
            prompt,
            ...(imageInput.length > 0 ? { image_input: imageInput } : {}),
            aspect_ratio: params.aspect_ratio || 'auto',
            resolution: params.resolution || '1K',
            output_format: params.output_format || 'jpg',
          },
        };
      }

      if (model === 'google/nano-banana-edit') {
        rejectAlias(params, 'aspect_ratio', 'image_size');
        const imageUrls = requireArrayField(params, 'image_urls');
        if (imageUrls.length === 0) {
          throw new Error(`[kie] Missing required input: 'image_urls' is required for model 'google/nano-banana-edit'`);
        }
        return {
          model,
          ...(params.callBackUrl ? { callBackUrl: params.callBackUrl } : {}),
          input: {
            prompt,
            image_urls: imageUrls,
            output_format: params.output_format || 'png',
            image_size: params.image_size || '1:1',
          },
        };
      }
      
      // Fallback for custom/new models with basic input structure
      return {
        model,
        ...(params.callBackUrl ? { callBackUrl: params.callBackUrl } : {}),
        input: {
            prompt,
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
      } else if (model === 'wan/2-7-r2v') {
        if (Array.isArray(finalPayload.input?.reference_image)) {
          for (let i = 0; i < finalPayload.input.reference_image.length; i++) {
            if (finalPayload.input.reference_image[i]?.startsWith('data:')) {
              console.error(`[kie] Uploading reference image ${i + 1} to KIE...`);
              finalPayload.input.reference_image[i] = await uploadToKie(apiKey, finalPayload.input.reference_image[i], fetchImpl);
            }
          }
        }
        if (finalPayload.input?.first_frame?.startsWith('data:')) {
          console.error(`[kie] Uploading first frame to KIE...`);
          finalPayload.input.first_frame = await uploadToKie(apiKey, finalPayload.input.first_frame, fetchImpl);
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
      if (model === 'nano-banana-2') {
        const images = finalPayload.input?.image_input || [];
        for (let i = 0; i < images.length; i++) {
          if (images[i].startsWith('data:')) {
            console.error(`[kie] Uploading image ${i + 1} to KIE...`);
            images[i] = await uploadToKie(apiKey, images[i], fetchImpl);
          }
        }
      } else if (model === 'google/nano-banana') {
        const image = finalPayload.input?.image;
        if (Array.isArray(image)) {
          for (let i = 0; i < image.length; i++) {
            if (image[i].startsWith('data:')) {
              console.error(`[kie] Uploading image ${i + 1} to KIE...`);
              image[i] = await uploadToKie(apiKey, image[i], fetchImpl);
            }
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
