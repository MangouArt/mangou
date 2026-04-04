/**
 * Node.js Native VFS Adapter
 * 直接操作物理文件系统，不依赖 HTTP API。
 * 适用于本地文件工作区模式。
 */

import fs from 'fs/promises';
import path from 'path';
import chokidar from 'chokidar';
import type { FSWatcher } from 'chokidar';
import type { VFSAdapter } from '../adapter';
import type { VFSEvent } from '@core/types';
import { configStore } from '../../config-store';
import { buildProjectSnapshot } from '../project-snapshot';

export class NodeFSAdapter implements VFSAdapter {
  private projectId: string = '';
  private projectRoot: string = '';
  private watcher: FSWatcher | null = null;
  private callbacks: ((event: VFSEvent) => void)[] = [];

  private getWorkspaceRoot(): string {
    const envRoot = process.env.MANGOU_HOME || process.cwd();
    const workspaceDir = configStore.get('workspaceDir') || 'projects';
    return path.resolve(envRoot, workspaceDir);
  }

  async init(projectId: string): Promise<void> {
    this.projectId = projectId;
    this.projectRoot = path.join(this.getWorkspaceRoot(), projectId);
    await fs.mkdir(this.projectRoot, { recursive: true });
    console.log(`[NodeFSAdapter] Initialized for project: ${projectId} at ${this.projectRoot}`);
  }

  async loadSnapshot() {
    return buildProjectSnapshot(this.projectId, this.projectRoot);
  }

  private getPhysicalPath(vfsPath: string): string {
    // VFS 路径通常是相对于项目根目录的，例如 /storyboards/scene-001.yaml
    const relativePath = vfsPath.startsWith('/') ? vfsPath.slice(1) : vfsPath;
    return path.join(this.projectRoot, relativePath);
  }

  async readFile(vfsPath: string): Promise<string | null> {
    try {
      const physicalPath = this.getPhysicalPath(vfsPath);
      const content = await fs.readFile(physicalPath, 'utf-8');
      return content;
    } catch (error: any) {
      if (error.code === 'ENOENT') return null;
      console.warn(`[NodeFSAdapter] readFile error for ${vfsPath}:`, error);
      return null;
    }
  }

  async writeFile(vfsPath: string, content: string): Promise<void> {
    try {
      const physicalPath = this.getPhysicalPath(vfsPath);
      await fs.mkdir(path.dirname(physicalPath), { recursive: true });
      await fs.writeFile(physicalPath, content, 'utf-8');

      // 注意：watcher 会触发 file:updated 事件
    } catch (error) {
      console.error('[NodeFSAdapter] writeFile error:', error);
      throw error;
    }
  }

  async listDirectory(vfsPath: string): Promise<string[]> {
    try {
      const physicalPath = this.getPhysicalPath(vfsPath);
      const stats = await fs.stat(physicalPath).catch(() => null);
      if (!stats || !stats.isDirectory()) return [];

      const entries = await fs.readdir(physicalPath);
      return entries;
    } catch (error) {
      console.error('[NodeFSAdapter] listDirectory error:', error);
      return [];
    }
  }

  async deleteFile(vfsPath: string): Promise<void> {
    try {
      const physicalPath = this.getPhysicalPath(vfsPath);
      await fs.rm(physicalPath, { recursive: true, force: true });
    } catch (error) {
      console.error('[NodeFSAdapter] deleteFile error:', error);
      throw error;
    }
  }

  watch(callback: (event: VFSEvent) => void): () => void {
    this.callbacks.push(callback);

    if (!this.watcher) {
      this.watcher = chokidar.watch(this.projectRoot, {
        ignoreInitial: true,
        persistent: true,
      });

      this.watcher.on('all', (event: string, filePath: string) => {
        const relativePath = '/' + path.relative(this.projectRoot, filePath);
        let type: VFSEvent['type'] = 'file:updated';

        if (event === 'unlink' || event === 'unlinkDir') {
          type = 'file:deleted';
        } else if (event === 'add' || event === 'addDir') {
          type = 'file:created';
        }

        this.emit({
          type,
          path: relativePath,
          timestamp: new Date(),
        });
      });
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
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.callbacks = [];
  }
}
