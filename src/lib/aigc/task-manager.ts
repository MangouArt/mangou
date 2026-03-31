/**
 * AIGC 任务管理器
 * 统一接口，支持网页版（Trigger.dev）和桌面版（本地轮询）
 */

import type {
  ImageGenerationOptions,
  ImageEditOptions,
  VideoGenerationOptions,
} from './types';
import { isDesktop, isWeb } from '@/lib/vfs/adapter';

export interface GenerationTask {
  id: string;
  type: 'image' | 'video';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  options: ImageGenerationOptions | VideoGenerationOptions;
  result?: {
    url: string;
  };
  error?: string;
  createdAt: Date;
}

class TaskManager {
  private tasks: Map<string, GenerationTask> = new Map();
  private localClient: any = null;
  private initialized: boolean = false;

  /**
   * 初始化任务管理器
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    if (isDesktop()) {
      // 桌面版：初始化本地客户端
      const { LocalAIGCClient } = await import('./local-client');

      // 从本地配置读取
      const config = await this.loadLocalConfig();
      if (config) {
        this.localClient = new LocalAIGCClient(config);
      }
    }

    this.initialized = true;
  }

  /**
   * 加载本地配置
   */
  private async loadLocalConfig() {
    try {
      // 从本地存储或文件读取配置
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('mangou-config');
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * 提交生成任务
   */
  async submitTask(
    type: 'image' | 'video',
    options: ImageGenerationOptions | VideoGenerationOptions
  ): Promise<{ taskId: string; status: string }> {
    await this.init();

    if (isWeb()) {
      // 网页版：通过 Trigger.dev
      return this.submitWebTask(type, options);
    } else {
      // 桌面版：本地轮询
      return this.submitLocalTask(type, options);
    }
  }

  /**
   * 提交网页版任务（Trigger.dev）
   */
  private async submitWebTask(
    type: 'image' | 'video',
    options: ImageGenerationOptions | VideoGenerationOptions
  ): Promise<{ taskId: string; status: string }> {
    const projectId = (options as any).projectId as string | undefined;
    const refPath = (options as any).path as string | undefined;
    const payload = {
      type,
      status: 'submitted',
      ref: refPath,
      input: options,
    };

    if (!projectId) {
      throw new Error('Missing projectId in task options');
    }

    const response = await fetch(`/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Failed to submit task');
    }

    const data = await response.json();

    return {
      taskId: data?.task?.id || data?.taskId || data?.task_id,
      status: 'submitted',
    };
  }

  /**
   * 提交桌面版任务（本地轮询）
   */
  private async submitLocalTask(
    type: 'image' | 'video',
    options: ImageGenerationOptions | VideoGenerationOptions
  ): Promise<{ taskId: string; status: string }> {
    if (!this.localClient) {
      throw new Error('Local AIGC client not initialized. Please configure AIGC settings first.');
    }

    let result;

    if (type === 'image') {
      const response = await this.localClient.submitImageGeneration(options as ImageGenerationOptions);
      if (!response.success) {
        throw new Error(response.error || 'Failed to submit image task');
      }
      result = response.data;
    } else {
      const response = await this.localClient.submitVideoGeneration(options as VideoGenerationOptions);
      if (!response.success) {
        throw new Error(response.error || 'Failed to submit video task');
      }
      result = response.data;
    }

    // 保存任务信息
    const task: GenerationTask = {
      id: result.task_id,
      type,
      status: 'pending',
      options,
      createdAt: new Date(),
    };

    this.tasks.set(result.task_id, task);

    // 开始轮询
    this.startPolling(result.task_id, type);

    return {
      taskId: result.task_id,
      status: 'pending',
    };
  }

  /**
   * 开始轮询任务状态（仅桌面版）
   */
  private async startPolling(taskId: string, type: 'image' | 'video'): Promise<void> {
    if (!this.localClient) return;

    const poll = async () => {
      const task = this.tasks.get(taskId);
      if (!task) return;

      // 查询任务状态
      let result;
      if (type === 'image') {
        result = await this.localClient.getImageTask(taskId);
      } else {
        result = await this.localClient.getVideoTask(taskId);
      }

      if (!result.success) {
        task.status = 'failed';
        task.error = result.error;
        this.tasks.set(taskId, task);
        return;
      }

      const status = result.data?.status;
      task.status = status;

      if (status === 'completed') {
        task.result = {
          url: result.data?.data?.output,
        };
        this.tasks.set(taskId, task);

        // 触发回调
        this.notifyComplete(task);
        return;
      }

      if (status === 'failed') {
        task.error = result.data?.fail_reason;
        this.tasks.set(taskId, task);
        return;
      }

      // 继续轮询
      setTimeout(poll, 2000);
    };

    poll();
  }

  /**
   * 获取任务状态
   */
  getTask(taskId: string): GenerationTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 通知任务完成
   */
  private notifyComplete(task: GenerationTask): void {
    // 可以在这里触发事件或回调
    console.log(`Task ${task.id} completed:`, task.result?.url);
  }
}

export const taskManager = new TaskManager();
