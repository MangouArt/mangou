/**
 * VFS (Virtual File System) 核心实现
 * 内存中的文件系统，支持 YAML 文件操作
 */

import type {
  VFSNode,
  VFSNodeType,
  VFSFileEntry,
  VFSReadResult,
  VFSReplaceResult,
  VFSEvent,
  VFSEventType,
  VFSChangeCallback,
} from './types';

export class VirtualFileSystem {
  private root: VFSNode;
  private callbacks: VFSChangeCallback[] = [];

  constructor(projectId: string) {
    this.root = {
      type: 'directory',
      name: '',
      path: '/',
      children: [],
      size: 0,
      updatedAt: new Date(),
    };
  }

  // 订阅变更事件
  subscribe(callback: VFSChangeCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  // 触发事件
  private emit(event: VFSEvent): void {
    this.callbacks.forEach((cb) => cb(event));
  }

  // 规范化路径
  private normalizePath(path: string): string {
    // 确保路径以 / 开头
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    // 移除末尾的 /
    path = path.replace(/\/+$/, '');
    // 处理连续的 /
    path = path.replace(/\/+/g, '/');
    return path || '/';
  }

  // 分割路径
  private splitPath(path: string): string[] {
    const normalized = this.normalizePath(path);
    if (normalized === '/') return [];
    return normalized.slice(1).split('/');
  }

  // 查找节点
  private findNode(path: string): VFSNode | null {
    const parts = this.splitPath(path);
    let current = this.root;

    for (const part of parts) {
      if (current.type !== 'directory' || !current.children) {
        return null;
      }
      const child = current.children.find((c) => c.name === part);
      if (!child) return null;
      current = child;
    }

    return current;
  }

  // 查找父节点
  private findParentNode(path: string): VFSNode | null {
    const parts = this.splitPath(path);
    if (parts.length === 0) return null;

    const parentPath = '/' + parts.slice(0, -1).join('/');
    return this.findNode(parentPath);
  }

  // 创建文件
  createFile(path: string, content: string = ''): VFSNode | null {
    const normalizedPath = this.normalizePath(path);
    const parts = this.splitPath(normalizedPath);

    if (parts.length === 0) return null;

    // 自动创建父目录
    const parentPath = '/' + parts.slice(0, -1).join('/');
    if (parentPath !== '/' && !this.exists(parentPath)) {
      this.createDirectory(parentPath);
    }

    const parent = this.findParentNode(normalizedPath);
    if (!parent || parent.type !== 'directory') return null;

    const fileName = parts[parts.length - 1];

    // 检查是否已存在
    if (parent.children?.some((c) => c.name === fileName)) {
      return null;
    }

    const newFile: VFSNode = {
      type: 'file',
      name: fileName,
      path: normalizedPath,
      content,
      size: new Blob([content]).size,
      updatedAt: new Date(),
    };

    parent.children = parent.children || [];
    parent.children.push(newFile);
    parent.updatedAt = new Date();

    this.emit({
      type: 'file:created',
      path: normalizedPath,
      timestamp: new Date(),
    });

    return newFile;
  }

  // 创建目录
  createDirectory(path: string): VFSNode | null {
    const normalizedPath = this.normalizePath(path);
    const parts = this.splitPath(normalizedPath);

    if (parts.length === 0) return this.root;

    let current = this.root;

    for (const part of parts) {
      if (current.type !== 'directory') return null;

      let child = current.children?.find((c) => c.name === part);

      if (!child) {
        child = {
          type: 'directory',
          name: part,
          path: current.path === '/' ? `/${part}` : `${current.path}/${part}`,
          children: [],
          size: 0,
          updatedAt: new Date(),
        };
        current.children = current.children || [];
        current.children.push(child);
        current.updatedAt = new Date();

        this.emit({
          type: 'dir:created',
          path: child.path,
          timestamp: new Date(),
        });
      }

      current = child;
    }

    return current;
  }

  // 读取文件（带分页）
  readFile(path: string, offset: number = 0, limit: number = 100): VFSReadResult {
    const normalizedPath = this.normalizePath(path);
    const node = this.findNode(normalizedPath);

    if (!node || node.type !== 'file') {
      return {
        content: '',
        totalLines: 0,
        hasMore: false,
        nextOffset: 0,
      };
    }

    const content = node.content || '';
    const lines = content.split('\n');
    const totalLines = lines.length;

    // 计算实际读取范围
    const startLine = Math.max(0, offset);
    const endLine = Math.min(totalLines, startLine + limit);

    // 提取内容
    const selectedLines = lines.slice(startLine, endLine);
    const resultContent = selectedLines.join('\n');

    return {
      content: resultContent,
      totalLines,
      hasMore: endLine < totalLines,
      nextOffset: endLine,
    };
  }

  // 替换文件内容
  replaceInFile(path: string, oldStr: string, newStr: string): VFSReplaceResult {
    const normalizedPath = this.normalizePath(path);
    const node = this.findNode(normalizedPath);

    if (!node || node.type !== 'file') {
      return {
        success: false,
        replaced: false,
        message: '文件不存在',
      };
    }

    const content = node.content || '';

    // 检查 oldStr 是否存在
    if (!content.includes(oldStr)) {
      return {
        success: false,
        replaced: false,
        message: '未找到要替换的字符串',
      };
    }

    // 执行替换（只替换第一个匹配）
    const newContent = content.replace(oldStr, newStr);

    // 更新节点
    node.content = newContent;
    node.size = new Blob([newContent]).size;
    node.updatedAt = new Date();

    this.emit({
      type: 'file:updated',
      path: normalizedPath,
      timestamp: new Date(),
    });

    return {
      success: true,
      replaced: true,
    };
  }

  // 列出目录内容
  listDirectory(path: string = '/'): VFSFileEntry[] {
    const normalizedPath = this.normalizePath(path);
    const node = this.findNode(normalizedPath);

    if (!node || node.type !== 'directory') {
      return [];
    }

    return (node.children || []).map((child) => ({
      name: child.name,
      type: child.type,
      size: child.size,
    }));
  }

  // 写入文件（完整覆盖）
  writeFile(path: string, content: string): VFSNode | null {
    const normalizedPath = this.normalizePath(path);
    const node = this.findNode(normalizedPath);

    if (node && node.type === 'file') {
      // 更新现有文件
      node.content = content;
      node.size = new Blob([content]).size;
      node.updatedAt = new Date();

      this.emit({
        type: 'file:updated',
        path: normalizedPath,
        timestamp: new Date(),
      });

      return node;
    }

    // 创建新文件
    return this.createFile(path, content);
  }

  // 删除文件或目录
  delete(path: string): boolean {
    const normalizedPath = this.normalizePath(path);
    const parent = this.findParentNode(normalizedPath);

    if (!parent || parent.type !== 'directory') return false;

    const parts = this.splitPath(normalizedPath);
    const name = parts[parts.length - 1];

    const index = parent.children?.findIndex((c) => c.name === name) ?? -1;
    if (index === -1) return false;

    parent.children?.splice(index, 1);
    parent.updatedAt = new Date();

    this.emit({
      type: 'file:deleted',
      path: normalizedPath,
      timestamp: new Date(),
    });

    return true;
  }

  // 检查路径是否存在
  exists(path: string): boolean {
    return this.findNode(this.normalizePath(path)) !== null;
  }

  // 获取文件内容（不分页）
  getFileContent(path: string): string | null {
    const node = this.findNode(this.normalizePath(path));
    if (node && node.type === 'file') {
      return node.content || '';
    }
    return null;
  }

  // 获取所有文件（用于同步到 Supabase）
  getAllFiles(): Array<{ path: string; content: string }> {
    const files: Array<{ path: string; content: string }> = [];

    const traverse = (node: VFSNode) => {
      if (node.type === 'file' && node.content !== undefined) {
        files.push({
          path: node.path,
          content: node.content,
        });
      } else if (node.type === 'directory' && node.children) {
        node.children.forEach(traverse);
      }
    };

    traverse(this.root);
    return files;
  }

  // 从文件列表加载（从 Supabase 恢复）
  loadFromFiles(files: Array<{ path: string; content: string }>): void {
    // 清空现有内容
    this.root.children = [];

    for (const file of files) {
      const normalizedPath = this.normalizePath(file.path);
      const parts = this.splitPath(normalizedPath);

      if (parts.length === 0) continue;

      // 创建父目录
      const parentPath = '/' + parts.slice(0, -1).join('/');
      if (parentPath !== '/') {
        this.createDirectory(parentPath);
      }

      // 创建文件
      this.createFile(normalizedPath, file.content);
    }
  }
}

// 单例管理器
const vfsInstances = new Map<string, VirtualFileSystem>();

export function getVFS(projectId: string): VirtualFileSystem {
  if (!vfsInstances.has(projectId)) {
    vfsInstances.set(projectId, new VirtualFileSystem(projectId));
  }
  return vfsInstances.get(projectId)!;
}

export function clearVFS(projectId: string): void {
  vfsInstances.delete(projectId);
}