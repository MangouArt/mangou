import { MODELS, PROVIDERS } from '../constants';
import {
  AIGCProvider,
  AIGCResponse,
  ChatOptions,
  ChatResult,
  ImageEditOptions,
  ImageGenerationOptions,
  ImageGenerationResult,
  ImageTaskResponse,
  ImageTaskResult,
  VideoGenerationOptions,
  VideoTaskResponse,
  VideoTaskResult,
} from '../types';

export class BLTAIProvider implements AIGCProvider {
  readonly name = PROVIDERS.BLTAI;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.bltcy.ai') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, '').replace(/\/v[12]$/, '');
  }

  async chat(options: ChatOptions): Promise<AIGCResponse<ChatResult>> {
    try {
      const body: Record<string, unknown> = {
        model: options.model,
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
      };

      if (options.json_mode) {
        body.response_format = { type: 'json_object' };
      }

      if (options.tools && options.tools.length > 0) {
        body.tools = options.tools;
        body.tool_choice = options.tool_choice || 'auto';
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error?.message || `HTTP error! status: ${response.status}`,
        };
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message;
      const content = message?.content || '';
      const tool_calls = message?.tool_calls;

      return {
        success: true,
        data: { content, tool_calls },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private buildImageRequestBody(options: ImageGenerationOptions): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: options.model || MODELS.IMAGE.DEFAULT,
      prompt: options.prompt,
      aspect_ratio: options.aspect_ratio || '1:1',
      response_format: options.response_format || 'url',
      n: options.n || 1,
    };

    if (options.image_size) body.image_size = options.image_size;

    if (options.image) {
      const rawImage = options.image;
      let imageArray: string[] = [];
      
      if (Array.isArray(rawImage)) {
        imageArray = rawImage
          .filter((img): img is string => typeof img === 'string' && img.trim().length > 0)
          .map(img => img.split('?')[0]);
      } else if (typeof rawImage === 'string' && (rawImage as string).trim().length > 0) {
        imageArray = [(rawImage as string).trim().split('?')[0]];
      }

      if (imageArray.length > 0) {
        body.image = imageArray;
      }
    }

    return body;
  }

  async generateImage(options: ImageGenerationOptions): Promise<AIGCResponse<ImageGenerationResult>> {
    try {
      const body = this.buildImageRequestBody(options);

      const response = await fetch(`${this.baseUrl}/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error?.message || `HTTP error! status: ${response.status}`,
        };
      }

      const data = await response.json();
      
      // Handle standard DALL-E format
      if (data.data && Array.isArray(data.data)) {
        const urls = data.data.map((item: { url: string }) => item.url).filter(Boolean);
        return {
          success: true,
          data: { urls },
        };
      }

      // Fallback to extraction if format differs
      const content = data.choices?.[0]?.message?.content || JSON.stringify(data);
      return this.extractUrlsFromContent(content);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async submitImageGeneration(options: ImageGenerationOptions): Promise<AIGCResponse<ImageTaskResponse>> {
    try {
      const body = this.buildImageRequestBody(options);

      const imageCount = Array.isArray(body.image) ? body.image.length : 0;
      console.log(`[BLTAI] Submitting async task (${String(body.model)}). Image count: ${imageCount}`);
      if (Array.isArray(body.image) && body.image.length > 0) {
        console.log(`[BLTAI] Reference image[0]: ${body.image[0].slice(0, 100)}${body.image[0].length > 100 ? '...' : ''}`);
      }
      console.log('[BLTAI] Final Request Body:', JSON.stringify(body, null, 2));

      const response = await fetch(`${this.baseUrl}/v1/images/generations?async=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error?.message || `HTTP error! status: ${response.status}`,
        };
      }

      const data = await response.json();
      const task_id = data.data?.task_id || data.task_id || data.id || data.data?.id;
      
      if (!task_id) {
        return {
          success: false,
          error: 'Failed to get task_id from response: ' + JSON.stringify(data),
        };
      }

      return {
        success: true,
        data: { task_id },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getImageTask(taskId: string): Promise<AIGCResponse<ImageTaskResult>> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/images/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error?.message || `HTTP error! status: ${response.status}`,
        };
      }

      const rawData = await response.json();
      const taskData = rawData.data; // The actual task object is under .data

      if (!taskData) {
        return {
          success: false,
          error: 'Invalid response format: missing data property',
        };
      }

      // Format the result to match ImageTaskResult
      const result: ImageTaskResult = {
        task_id: taskData.task_id || taskId,
        status: taskData.status,
        fail_reason: taskData.fail_reason,
        data: {
          // Flatten the outputs. The API returns data.data.data[].url
          outputs: taskData.data?.data?.map((item: { url: string }) => item.url).filter(Boolean) || 
                   (taskData.data?.url ? [taskData.data.url] : [])
        }
      };

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async editImage(options: ImageEditOptions): Promise<AIGCResponse<ImageGenerationResult>> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model || MODELS.IMAGE.SEED_EDIT,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: options.prompt },
                { type: 'image_url', image_url: { url: options.image_url } }
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error?.message || `HTTP error! status: ${response.status}`,
        };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        return {
          success: false,
          error: 'No content in response',
        };
      }

      return this.extractUrlsFromContent(content);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private extractUrlsFromContent(content: string): AIGCResponse<ImageGenerationResult> {
    const urlRegex = /(https?:\/\/[^\s)]+)/g;
    const matches = content.match(urlRegex) || [];
    const urls: string[] = Array.from(new Set(matches)) as string[];

    if (urls.length === 0) {
      if (content.trim().startsWith('http')) {
        return {
          success: true,
          data: { urls: [content.trim()] },
        };
      }
      return {
        success: false,
        error: 'Could not find image URL in response: ' + content,
      };
    }

    return {
      success: true,
      data: { urls },
    };
  }

  async generateVideo(options: VideoGenerationOptions): Promise<AIGCResponse<VideoTaskResponse>> {
    try {
      if (!options.images || options.images.length === 0) {
        return {
          success: false,
          error: 'Video generation requires images',
        };
      }

      const payload = {
        prompt: options.prompt,
        model: options.model,
        images: options.images,
        enhance_prompt: options.enhance_prompt,
        aspect_ratio: options.aspect_ratio,
      };

      const response = await fetch(`${this.baseUrl}/v2/videos/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error?.message || `HTTP error! status: ${response.status}`,
        };
      }

      const data = await response.json();
      const task_id = data.task_id || data.id || data.data?.id;
      
      return {
        success: true,
        data: {
          task_id: task_id,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getVideoTask(taskId: string): Promise<AIGCResponse<VideoTaskResult>> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/videos/generations/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error?.message || `HTTP error! status: ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: data as VideoTaskResult,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
