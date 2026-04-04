/**
 * VFS (Virtual File System) 模块入口
 * 导出所有 VFS 相关功能
 */

// 核心
export { VirtualFileSystem, getVFS, clearVFS } from './core';

// 类型
export type {
  VFSNode,
  VFSNodeType,
  VFSFileEntry,
  VFSReadResult,
  VFSReplaceResult,
  YAMLFileContent,
  VFSConfig,
  VFSEvent,
  VFSEventType,
} from './types';

// YAML 工具
export {
  parseYAML,
  stringifyYAML,
  validateYAMLFile,
  updateGenerationStatus,
  formatYAMLError,
} from './yaml';

// Agent 工具
export {
  createToolContext,
  read,
  replace,
  list,
  initializeProjectStructure,
} from './tools';
export type { AgentToolContext } from './tools';

// 同步
export {
  loadProjectFromSupabase,
  saveProjectToSupabase,
  enableAutoSync,
  disableAutoSync,
  forceSync,
  getSyncStatus,
} from './sync';

// 适配器
export type { VFSAdapter } from './adapter';
export { getDeploymentMode, isDesktop, isWeb } from './adapter';
export { LocalVFSAdapter } from './adapters/local';

// 存储管理器（新的统一接口）
export { vfsStorageManager } from './storage-manager';
