/**
 * VFS 适配器接口
 * 支持不同存储后端（Supabase / 本地文件系统）
 */

import type { VFSEvent } from './types';

export interface VFSProjectSnapshot {
  projectId: string;
  generatedAt: string;
  files: Array<{
    path: string;
    content: string;
  }>;
}

export interface VFSAdapter {
  /**
   * 读取文件内容
   */
  readFile(path: string): Promise<string | null>;

  /**
   * 写入文件内容
   */
  writeFile(path: string, content: string): Promise<void>;

  /**
   * 列出目录内容
   */
  listDirectory(path: string): Promise<string[]>;

  /**
   * 删除文件
   */
  deleteFile(path: string): Promise<void>;

  /**
   * 监听文件变化
   */
  watch(callback: (event: VFSEvent) => void): () => void;

  /**
   * 初始化适配器
   */
  init(projectId: string): Promise<void>;

  /**
   * 批量加载项目快照
   */
  loadSnapshot?(): Promise<VFSProjectSnapshot | null>;

  /**
   * 销毁适配器
   */
  destroy(): Promise<void>;
}

/**
 * 部署模式
 */
export type DeploymentMode = 'web' | 'desktop';

/**
 * 获取当前部署模式
 */
export function getDeploymentMode(): DeploymentMode {
  if (typeof window === 'undefined') {
    return 'desktop'; // 服务器端默认本地优先
  }

  // 检测是否在 Electron 环境
  if ((window as any).electron) {
    return 'desktop';
  }
  // 检测是否在 Tauri 环境
  if ((window as any).__TAURI__) {
    return 'desktop';
  }
  
  // 检测是否为本地运行 (Mango 2.0 本地模式)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'desktop';
  }

  return 'web';
}

/**
 * 检查是否为桌面版
 */
export function isDesktop(): boolean {
  return getDeploymentMode() === 'desktop';
}

/**
 * 检查是否为网页版
 */
export function isWeb(): boolean {
  return getDeploymentMode() === 'web';
}
