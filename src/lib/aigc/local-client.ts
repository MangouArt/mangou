/**
 * AIGC 本地客户端
 * 用于桌面版，直接调用 AIGC API（不经过 Trigger.dev）
 */

import type {
  AIGCResponse,
  ImageGenerationOptions,
  ImageEditOptions,
  ImageGenerationResult,
  ImageTaskResponse,
  ImageTaskResult,
  VideoGenerationOptions,
  VideoTaskResponse,
  VideoTaskResult,
} from './types';
import { TASK_STATUS } from './constants';

export interface LocalAIGCConfig {
  provider: 'openai' | 'bltai' | 'custom';
  baseUrl: string;
  apiKey: string;
  models: {
    image?: string;
    video?: string;
  };
}

export class LocalAIGCClient {
  private config: LocalAIGCConfig;
  private tasks: Map<string, {
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result?: any;
    error?: string;
  }> = new Map();

  constructor(config: LocalAIGCConfig) {
    this.config = config;
  }

  /**
   * 将本地状态映射到 TaskStatus
   */
  private mapStatus(localStatus: string): typeof TASK_STATUS[keyof typeof TASK_STATUS] {
    switch (localStatus) {
      case 'pending':
        return TASK_STATUS.NOT_START;
      case 'processing':
        return TASK_STATUS.IN_PROGRESS;
      case 'completed':
        return TASK_STATUS.SUCCESS;
      case 'failed':
        return TASK_STATUS.FAILURE;
      default:
        return TASK_STATUS.NOT_START;
    }
  }

  /**
   * 提交图片生成任务
   */
  async submitImageGeneration(
    options: ImageGenerationOptions
  ): Promise<AIGCResponse<ImageTaskResponse>> {
    const taskId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.tasks.set(taskId, { status: 'pending' });

    // 异步执行生成
    this.executeImageGeneration(taskId, options);

    return {
      success: true,
      data: { task_id: taskId },
    };
  }

  /**
   * 执行图片生成（异步）
   */
  private async executeImageGeneration(
    taskId: string,
    options: ImageGenerationOptions
  ): Promise<void> {
    this.tasks.set(taskId, { status: 'processing' });

    try {
      // 调用 AIGC API
      const response = await fetch(`${this.config.baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model || this.config.models.image,
          prompt: options.prompt,
          n: options.n || 1,
          size: options.image_size,
          quality: options.quality,
          response_format: 'url',
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      this.tasks.set(taskId, {
        status: 'completed',
        result: {
          output: data.data?.[0]?.url || data.output,
        },
      });
    } catch (error) {
      this.tasks.set(taskId, {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 查询图片任务状态
   */
  async getImageTask(taskId: string): Promise<AIGCResponse<ImageTaskResult>> {
    const task = this.tasks.get(taskId);

    if (!task) {
      return {
        success: false,
        error: 'Task not found',
      };
    }

    return {
      success: true,
      data: {
        task_id: taskId,
        status: this.mapStatus(task.status),
        fail_reason: task.error,
        data: task.result,
      },
    };
  }

  /**
   * 提交视频生成任务
   */
  async submitVideoGeneration(
    options: VideoGenerationOptions
  ): Promise<AIGCResponse<VideoTaskResponse>> {
    const taskId = `local_video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.tasks.set(taskId, { status: 'pending' });
    this.executeVideoGeneration(taskId, options);

    return {
      success: true,
      data: { task_id: taskId },
    };
  }

  /**
   * 执行视频生成（异步）
   */
  private async executeVideoGeneration(
    taskId: string,
    options: VideoGenerationOptions
  ): Promise<void> {
    this.tasks.set(taskId, { status: 'processing' });

    try {
      const response = await fetch(`${this.config.baseUrl}/videos/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model || this.config.models.video,
          prompt: options.prompt,
          images: options.images,
          enhance_prompt: options.enhance_prompt,
          negative_prompt: options.negative_prompt,
          duration: options.duration,
          aspect_ratio: options.aspect_ratio,
          size: options.size,
          resolution: options.resolution,
          videos: options.videos,
          watermark: options.watermark,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      this.tasks.set(taskId, {
        status: 'completed',
        result: {
          output: data.output,
        },
      });
    } catch (error) {
      this.tasks.set(taskId, {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 查询视频任务状态
   */
  async getVideoTask(taskId: string): Promise<AIGCResponse<VideoTaskResult>> {
    const task = this.tasks.get(taskId);

    if (!task) {
      return {
        success: false,
        error: 'Task not found',
      };
    }

    return {
      success: true,
      data: {
        task_id: taskId,
        status: this.mapStatus(task.status),
        fail_reason: task.error,
        data: task.result,
      },
    };
  }

  /**
   * 轮询任务直到完成
   */
  async pollTaskUntilComplete<T>(
    taskId: string,
    getTask: (id: string) => Promise<AIGCResponse<T>>,
    interval: number = 2000,
    maxAttempts: number = 300
  ): Promise<AIGCResponse<T>> {
    let attempts = 0;

    return new Promise((resolve) => {
      const check = async () => {
        attempts++;
        const result = await getTask(taskId);

        if (!result.success) {
          resolve(result);
          return;
        }

        const status = (result.data as any)?.status;

        if (status === 'completed' || status === 'failed') {
          resolve(result);
          return;
        }

        if (attempts >= maxAttempts) {
          resolve({
            success: false,
            error: 'Polling timeout',
          });
          return;
        }

        setTimeout(check, interval);
      };

      check();
    });
  }
}
