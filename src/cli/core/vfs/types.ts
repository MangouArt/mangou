/**
 * VFS (Virtual File System) 类型定义
 * 基于 YAML 的虚拟文件系统
 * 
 * 核心原则：
 * 1. YAML 是 Agent 的唯一真相源
 * 2. 结构定义由 src/lib/vfs/schema.ts (Zod) 统一驱动
 */

import type { StoryboardData, AssetData, ProjectData } from './schema';

// 文件节点类型
export type VFSNodeType = 'file' | 'directory';

// VFS 节点
export interface VFSNode {
  type: VFSNodeType;
  name: string;
  path: string;
  content?: string;      // 文件内容（仅文件类型）
  children?: VFSNode[];  // 子节点（仅目录类型）
  size: number;
  updatedAt: Date;
}

// 文件条目（用于 list 返回）
export interface VFSFileEntry {
  name: string;
  type: VFSNodeType;
  size: number;
}

// read 工具返回结果
export interface VFSReadResult {
  content: string;      // 文件内容
  totalLines: number;   // 总行数
  hasMore: boolean;     // 是否还有更多内容
  nextOffset: number;   // 下一页起始行号
}

// replace 工具返回结果
export interface VFSReplaceResult {
  success: boolean;     // 操作是否成功
  replaced: boolean;    // 是否成功替换
  message?: string;     // 错误信息（如果失败）
}

// ============================================
// YAML 文件内容类型 (由 Schema 统一)
// ============================================

export type YAMLFileContent = StoryboardData | AssetData | ProjectData | any;

// ============================================
// VFS 配置和事件
// ============================================

// VFS 配置
export interface VFSConfig {
  projectId: string;
  rootPath: string;
}

// VFS 事件
export type VFSEventType = 'file:created' | 'file:updated' | 'file:deleted' | 'dir:created';

export interface VFSEvent {
  type: VFSEventType;
  path: string;
  timestamp: Date;
}

// VFS 变更回调
export type VFSChangeCallback = (event: VFSEvent) => void;
