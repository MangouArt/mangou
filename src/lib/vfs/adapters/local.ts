/**
 * Local VFS Adapter (Web Hub -> Local Server API)
 * 在 Mango 2.0 中，Hub 运行在本地服务器，通过 API 向物理文件系统同步 VFS 变更。
 */

import type { VFSAdapter } from '../adapter';
import type { VFSEvent } from '../types';

export class LocalVFSAdapter implements VFSAdapter {
  private projectId: string = '';
  private callbacks: ((event: VFSEvent) => void)[] = [];
  private eventSource: any = null;

  async init(projectId: string): Promise<void> {
    this.projectId = projectId;
    console.log(`[LocalVFSAdapter] Initialized for project: ${projectId}`);
  }

  async loadSnapshot() {
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(this.projectId)}/snapshot`);
      if (!response.ok) {
        throw new Error(`Failed to load snapshot: ${response.statusText}`);
      }
      const data = await response.json();
      return data.snapshot || null;
    } catch (error) {
      console.warn(`[LocalVFSAdapter] loadSnapshot error for ${this.projectId}:`, error);
      return null;
    }
  }

  private get apiUrl() {
    // 关键修复：Node.js 环境下 fetch 不支持相对路径
    if (typeof window === 'undefined') {
      const port = process.env.MANGOU_WEB_PORT || process.env.PORT || '3000';
      return `http://localhost:${port}/api/vfs`;
    }
    return '/api/vfs';
  }

  async readFile(path: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.apiUrl}?projectId=${this.projectId}&path=${encodeURIComponent(path)}&action=read`);
      if (!response.ok) {
        if (response.status === 404) return null;
        if (response.status === 415) return null;
        
        // 特殊处理目录情况
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 400 && errorData.isDirectory) {
          return null;
        }

        throw new Error(`Failed to read file: ${response.statusText}`);
      }
      const data = await response.json();
      return data.content;
    } catch (error) {
      console.warn(`[LocalVFSAdapter] readFile error for ${path}:`, error);
      return null;
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    try {
      const url = `${this.apiUrl}?projectId=${this.projectId}&path=${encodeURIComponent(path)}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: content,
      });

      if (!response.ok) {
        throw new Error(`Failed to write file: ${response.statusText}`);
      }

      this.emit({
        type: 'file:updated',
        path,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('[LocalVFSAdapter] writeFile error:', error);
      throw error;
    }
  }

  async listDirectory(path: string): Promise<string[]> {
    try {
      const url = `${this.apiUrl}?projectId=${this.projectId}&path=${encodeURIComponent(path)}&action=list`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to list directory: ${response.statusText}`);
      }
      const data = await response.json();
      const entries = data.entries || [];
      if (entries.length > 0 && typeof entries[0] === 'object') {
        return entries.map((item: { name?: string }) => item.name).filter(Boolean);
      }
      return entries;
    } catch (error) {
      console.error('[LocalVFSAdapter] listDirectory error:', error);
      return [];
    }
  }

  async deleteFile(path: string): Promise<void> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: this.projectId,
          path,
          action: 'delete'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to delete file: ${response.statusText}`);
      }

      this.emit({
        type: 'file:deleted',
        path,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('[LocalVFSAdapter] deleteFile error:', error);
      throw error;
    }
  }

  watch(callback: (event: VFSEvent) => void): () => void {
    this.callbacks.push(callback);
    
    // 仅在浏览器环境建立 SSE 连接，服务器端不需要
    if (typeof window !== 'undefined' && !this.eventSource) {
      console.log(`[LocalVFSAdapter] Connecting to SSE for project: ${this.projectId}`);
      const EventSourceClass = (window as any).EventSource;
      if (EventSourceClass) {
        this.eventSource = new EventSourceClass(`${this.apiUrl}/events?projectId=${this.projectId}`);

        const handleMessage = (e: any) => {
          try {
            const data = JSON.parse(e.data);
            this.emit({
              type: data.type === 'deleted' ? 'file:deleted' : 'file:updated',
              path: data.path,
              timestamp: new Date(data.timestamp),
            });
          } catch (err) {}
        };

        if (typeof this.eventSource.addEventListener === 'function') {
          this.eventSource.addEventListener('vfs', handleMessage);
        } else {
          this.eventSource.onmessage = handleMessage;
        }
      }
    }

    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  private emit(event: VFSEvent): void {
    this.callbacks.forEach((cb) => cb(event));
  }

  async destroy(): Promise<void> {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.callbacks = [];
  }
}
