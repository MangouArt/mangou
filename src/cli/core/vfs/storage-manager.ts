/**
 * VFS 存储管理器
 * 统一管理 VFS 与存储后端的同步
 * 根据部署模式自动选择适配器（Supabase / 本地文件系统）
 */

import type { VFSAdapter, DeploymentMode } from './adapter';
import { getDeploymentMode, isWeb, isDesktop } from './adapter';
import { LocalVFSAdapter } from './adapters/local';
import { getVFS, type VirtualFileSystem } from './core';
import type { VFSEvent } from './types';
import { getContentTypeByPath } from './server-utils';
import { isMediaContentType } from '../file-type';

// 防抖时间（毫秒）
const SYNC_DEBOUNCE = 1000;

interface SyncState {
  pendingChanges: Map<string, string>; // path -> content
  syncTimer: ReturnType<typeof setTimeout> | null;
  isSyncing: boolean;
}

export class VFSStorageManager {
  private adapters: Map<string, VFSAdapter> = new Map();
  private syncStates: Map<string, SyncState> = new Map();
  private unsubscribeMap: Map<string, (() => void)[]> = new Map();
  // 标记来自 adapter 的写入，避免同步循环
  private adapterWriteMarkers: Map<string, Set<string>> = new Map();

  private async loadNodeAdapterModule(): Promise<typeof import('./adapters/node')> {
    const modulePath = './adapters/node.ts';
    return import(/* @vite-ignore */ modulePath);
  }

  /**
   * 获取或创建适配器
   */
  async getAdapter(projectId: string): Promise<VFSAdapter> {
    if (!this.adapters.has(projectId)) {
      let adapter: VFSAdapter;

      if (typeof window === 'undefined') {
        // Node.js 环境：通过 vite-ignore 避免把 chokidar 打进浏览器包
        const { NodeFSAdapter } = await this.loadNodeAdapterModule();
        adapter = new NodeFSAdapter();
      } else {
        adapter = new LocalVFSAdapter();
      }

      await adapter.init(projectId);
      this.adapters.set(projectId, adapter);
    }

    return this.adapters.get(projectId)!;
  }

  /**
   * 从存储加载项目到 VFS
   */
  async loadProject(projectId: string): Promise<boolean> {
    try {
      const vfs = getVFS(projectId);
      const adapter = await this.getAdapter(projectId);

      // 清空现有内容
      vfs.loadFromFiles([]);

      // 清理同步状态（避免旧数据残留）
      const state = this.getSyncState(projectId);
      state.pendingChanges.clear();
      if (state.syncTimer) {
        clearTimeout(state.syncTimer);
        state.syncTimer = null;
      }
      state.isSyncing = false;

      // 清理 adapter 写入标记
      this.adapterWriteMarkers.delete(projectId);

      const snapshot = await adapter.loadSnapshot?.();
      const files = snapshot?.files ? [...snapshot.files] : [];

      if (files.length === 0) {
        await this.loadDirectory(adapter, '/', files);
      }

      if (files.length > 0) {
        vfs.loadFromFiles(files);
        console.log(`[VFSStorageManager] Loaded ${files.length} files for project ${projectId}`);
      } else {
        console.log(`[VFSStorageManager] Project ${projectId} is empty or only has directories.`);
      }

      return true;
    } catch (error) {
      console.error('[VFSStorageManager] Load project failed:', error);
      return false;
    }
  }

  /**
   * 递归加载目录
   */
  private async loadDirectory(
    adapter: VFSAdapter,
    path: string,
    files: Array<{ path: string; content: string }>
  ): Promise<void> {
    const IGNORE_DIRS = ['node_modules', '.git', '.agent_logs', '.agents', 'output', '.next'];
    
    try {
      const items = await adapter.listDirectory(path);

      for (const item of items) {
        if (IGNORE_DIRS.includes(item)) {
          console.log(`[VFSStorageManager] Skipping ignored directory: ${item}`);
          continue;
        }

        const itemPath = path === '/' ? `/${item}` : `${path}/${item}`;
        
        // 尝试读取为文件
        const content = await adapter.readFile(itemPath);
        if (content !== null) {
          files.push({ path: itemPath, content });
        } else {
          // 是目录，递归加载
          await this.loadDirectory(adapter, itemPath, files);
        }
      }
    } catch (error) {
      console.warn(`[VFSStorageManager] Failed to load directory ${path}:`, error);
    }
  }

  /**
   * 启用自动同步
   * VFS 变更自动同步到存储
   */
  async enableAutoSync(projectId: string): Promise<() => void> {
    const vfs = getVFS(projectId);
    const adapter = await this.getAdapter(projectId);

    // 订阅 VFS 变更事件
    const unsubscribeVFS = vfs.subscribe((event) => {
      this.handleVFSEvent(projectId, event);
    });

    // 订阅适配器变更事件（其他设备同步）
    const unsubscribeAdapter = adapter.watch((event) => {
      this.handleAdapterEvent(projectId, event);
    });

    // 保存取消订阅函数
    const unsubscribes = [unsubscribeVFS, unsubscribeAdapter];
    this.unsubscribeMap.set(projectId, unsubscribes);

    return () => {
      this.disableAutoSync(projectId);
    };
  }

  /**
   * 禁用自动同步
   */
  async disableAutoSync(projectId: string): Promise<void> {
    const unsubscribes = this.unsubscribeMap.get(projectId);
    if (unsubscribes) {
      unsubscribes.forEach((unsub) => unsub());
      this.unsubscribeMap.delete(projectId);
    }

    // 立即同步剩余变更
    await this.forceSync(projectId);

    // 销毁适配器
    const adapter = this.adapters.get(projectId);
    if (adapter) {
      await adapter.destroy();
      this.adapters.delete(projectId);
    }
  }

  /**
   * 处理 VFS 变更事件（同步到存储）
   */
  private handleVFSEvent(projectId: string, event: VFSEvent): void {
    const vfs = getVFS(projectId);
    const state = this.getSyncState(projectId);
    const isBinaryPath = isMediaContentType(getContentTypeByPath(event.path));

    switch (event.type) {
      case 'file:created':
      case 'file:updated': {
        if (isBinaryPath) {
          return;
        }
        // 检查是否来自 adapter 的写入，避免同步循环
        const markers = this.adapterWriteMarkers.get(projectId);
        if (markers && markers.has(event.path)) {
          markers.delete(event.path);
          console.log(`[VFSStorageManager] Skipping sync for adapter write: ${event.path}`);
          return;
        }

        const content = vfs.getFileContent(event.path);
        if (content !== null) {
          state.pendingChanges.set(event.path, content);
          this.scheduleSync(projectId);
        }
        break;
      }

      case 'file:deleted': {
        // 立即删除，不加入待处理队列
        this.deleteFromStorage(projectId, event.path);
        break;
      }

      case 'dir:created':
        // 目录创建不需要同步
        break;
    }
  }

  /**
   * 处理适配器变更事件（从存储同步到 VFS）
   */
  private async handleAdapterEvent(projectId: string, event: VFSEvent): Promise<void> {
    const vfs = getVFS(projectId);
    const adapter = await this.getAdapter(projectId);
    const isBinaryPath = isMediaContentType(getContentTypeByPath(event.path));

    switch (event.type) {
      case 'file:updated': {
        if (isBinaryPath) {
          return;
        }
        const content = await adapter.readFile(event.path);
        if (content !== null) {
          // 标记为 adapter 写入，避免同步循环
          let markers = this.adapterWriteMarkers.get(projectId);
          if (!markers) {
            markers = new Set();
            this.adapterWriteMarkers.set(projectId, markers);
          }
          markers.add(event.path);

          // 更新 VFS（不会触发同步回存储）
          vfs.writeFile(event.path, content);
        }
        break;
      }

      case 'file:deleted': {
        vfs.delete(event.path);
        break;
      }
    }
  }

  /**
   * 安排同步任务（防抖）
   */
  private scheduleSync(projectId: string): void {
    const state = this.getSyncState(projectId);

    if (state.syncTimer) {
      clearTimeout(state.syncTimer);
    }

    state.syncTimer = setTimeout(() => {
      this.syncToStorage(projectId);
    }, SYNC_DEBOUNCE);
  }

  /**
   * 同步到存储
   */
  private async syncToStorage(projectId: string): Promise<void> {
    const state = this.getSyncState(projectId);

    if (state.isSyncing || state.pendingChanges.size === 0) {
      return;
    }

    state.isSyncing = true;

    try {
      const adapter = await this.getAdapter(projectId);
      const changes = Array.from(state.pendingChanges.entries());
      state.pendingChanges.clear();

      // 批量写入
      for (const [path, content] of changes) {
        try {
          await adapter.writeFile(path, content);
        } catch (error) {
          console.error(`[VFSStorageManager] Failed to sync ${path}:`, error);
          // 重新加入队列稍后重试
          state.pendingChanges.set(path, content);
        }
      }
    } catch (error) {
      console.error('[VFSStorageManager] Sync failed:', error);
    } finally {
      state.isSyncing = false;

      // 如果还有未处理的变更，继续同步
      if (state.pendingChanges.size > 0) {
        this.scheduleSync(projectId);
      }
    }
  }

  /**
   * 从存储删除文件
   */
  private async deleteFromStorage(projectId: string, path: string): Promise<void> {
    try {
      const adapter = await this.getAdapter(projectId);
      await adapter.deleteFile(path);
    } catch (error) {
      console.error(`[VFSStorageManager] Failed to delete ${path}:`, error);
    }
  }

  /**
   * 获取同步状态
   */
  private getSyncState(projectId: string): SyncState {
    if (!this.syncStates.has(projectId)) {
      this.syncStates.set(projectId, {
        pendingChanges: new Map(),
        syncTimer: null,
        isSyncing: false,
      });
    }
    return this.syncStates.get(projectId)!;
  }

  /**
   * 强制同步（立即执行）
   */
  async forceSync(projectId: string): Promise<boolean> {
    const state = this.getSyncState(projectId);

    // 取消待处理的定时器
    if (state.syncTimer) {
      clearTimeout(state.syncTimer);
      state.syncTimer = null;
    }

    // 立即同步
    await this.syncToStorage(projectId);
    return true;
  }

  /**
   * 获取同步状态
   */
  getSyncStatus(projectId: string): {
    pendingCount: number;
    isSyncing: boolean;
  } {
    const state = this.getSyncState(projectId);
    return {
      pendingCount: state.pendingChanges.size,
      isSyncing: state.isSyncing,
    };
  }
}

// 导出单例
export const vfsStorageManager = new VFSStorageManager();
