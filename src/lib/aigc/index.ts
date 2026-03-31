import { PROVIDERS } from './constants';
import { BLTAIProvider } from './providers/bltai';
import { AIGCProvider } from './types';
import { configStore } from '../config-store';

export * from './types';
export * from './constants';
export * from './providers/bltai';

export class AIGCFactory {
  private static providers: Map<string, AIGCProvider> = new Map();

  static getProvider(name: string = PROVIDERS.BLTAI): AIGCProvider {
    // 强制每次获取时检查配置更新，或者简单地在第一次加载后缓存。
    // 在本地模式下，用户可能在 UI 修改配置，因此建议不缓存或在配置变更时清除缓存。
    if (this.providers.has(name)) {
      return this.providers.get(name)!;
    }

    let provider: AIGCProvider;
    const config = configStore.getAll();

    switch (name.toLowerCase()) {
      case PROVIDERS.BLTAI: {
        const apiKey = config.bltai?.apiKey || process.env.BLTAI_API_KEY || '';
        const baseUrl = config.bltai?.baseUrl || process.env.BLTAI_BASE_URL || 'https://api.bltcy.ai';
        provider = new BLTAIProvider(apiKey, baseUrl);
        break;
      }
      default:
        throw new Error(`Provider ${name} not supported`);
    }

    this.providers.set(name, provider);
    return provider;
  }

  static clearCache(): void {
    this.providers.clear();
  }
}

// 获取 Provider 的辅助函数，支持动态刷新
export const getAIGC = (name?: string) => AIGCFactory.getProvider(name);

// 保持兼容性的默认导出，但注意它在模块加载时就确定了
export const aigc = AIGCFactory.getProvider();

// 本地客户端（桌面版）
export type { LocalAIGCConfig } from './local-client';
export { LocalAIGCClient } from './local-client';

// 任务管理器（统一接口）
export type { GenerationTask } from './task-manager';
export { taskManager } from './task-manager';
