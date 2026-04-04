/**
 * Agent 工具实现
 * 封装 VFS 操作，提供给 Agent 使用
 * 
 * 严格适配当前文件格式：
 * - /storyboards/*.yaml
 * - /asset_defs/chars/*.yaml
 * - /asset_defs/scenes/*.yaml
 * - /asset_defs/props/*.yaml
 */

import { VirtualFileSystem, getVFS } from './core';
import type { 
  VFSReadResult, 
  VFSReplaceResult, 
  VFSFileEntry 
} from './types';

// Agent 工具上下文
export interface AgentToolContext {
  projectId: string;
  vfs: VirtualFileSystem;
}

// 创建工具上下文
export function createToolContext(projectId: string): AgentToolContext {
  return {
    projectId,
    vfs: getVFS(projectId),
  };
}

// ========== 文件操作工具 ==========

export function read(
  context: AgentToolContext,
  path: string,
  offset?: number,
  limit?: number
): VFSReadResult {
  return context.vfs.readFile(path, offset, limit);
}

export function write_file(
  context: AgentToolContext,
  path: string,
  content: string
): { success: boolean; message: string } {
  try {
    context.vfs.writeFile(path, content);
    return { success: true, message: `文件已写入: ${path}` };
  } catch (error) {
    return { success: false, message: `写入失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export function replace(
  context: AgentToolContext,
  path: string,
  old: string,
  newStr: string
): VFSReplaceResult {
  return context.vfs.replaceInFile(path, old, newStr);
}

export function list(
  context: AgentToolContext,
  path: string = '/'
): VFSFileEntry[] {
  return context.vfs.listDirectory(path);
}

// ========== 项目管理工具 ==========

/**
 * Initialize a new project directory structure.
 * This is a pure scaffolding operation.
 */
export function initializeProjectStructure(context: AgentToolContext, script: string = '') {
  const { vfs } = context;
  
  // Ensure base directories exist
  vfs.createDirectory('/asset_defs/chars');
  vfs.createDirectory('/asset_defs/scenes');
  vfs.createDirectory('/asset_defs/props');
  vfs.createDirectory('/storyboards');
  vfs.createDirectory('/assets/images');
  vfs.createDirectory('/assets/videos');

  // Seed with a default storyboard if it doesn't exist
  if (!vfs.exists('/storyboards/main-shot.yaml')) {
    vfs.createFile('/storyboards/main-shot.yaml', `
meta:
  id: main-shot
  version: "1.0"
content:
  sequence: 1
  title: Default Shot
  story: ${script || 'A new beginning.'}
  scene: A cinematic landscape.
tasks:
  image:
    params:
      prompt: A cinematic landscape.
`);
  }
}
