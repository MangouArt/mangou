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
import { parseYAMLQuiet } from './yaml';
import type { Storyboard, Asset } from '@/stores/director-agent-store';
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

// ========== 导出辅助工具 (核心) ==========

/**
 * 导出 VFS 数据到 UI 格式
 * 严格对齐你定义的分散 YAML 结构
 */
export function exportToExistingData(context: AgentToolContext): {
  assets: Asset[];
  storyboards: Storyboard[];
} {
  const { vfs } = context;
  const assets: Asset[] = [];
  const storyboards: Storyboard[] = [];
  const projectId = context.projectId;

  const resolveVfsUrl = (value?: string): string | undefined => {
    if (!value || typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (trimmed.startsWith('/api/')) return trimmed;
    const normalized = trimmed.startsWith('/') || trimmed.startsWith('./')
      ? trimmed
      : `./${trimmed}`;
    return `/api/vfs?projectId=${projectId}&path=${encodeURIComponent(normalized)}`;
  };

  // 1. 导出资产定义
  const assetTypes = [
    { folder: '/asset_defs/chars', type: 'character' as const },
    { folder: '/asset_defs/scenes', type: 'scene' as const },
    { folder: '/asset_defs/props', type: 'prop' as const },
    { folder: '/asset_defs', type: 'character' as const }, // 支持扁平结构，默认为角色
  ];

  const processedFiles = new Set<string>();

  for (const mapping of assetTypes) {
    if (!vfs.exists(mapping.folder)) continue;
    const files = vfs.listDirectory(mapping.folder);

    for (const file of files) {
      if (file.type === 'file' && file.name.endsWith('.yaml')) {
        const path = mapping.folder === '/' ? `/${file.name}` : `${mapping.folder}/${file.name}`;
        const normalizedPath = path.replace(/\/+/g, '/');
        
        if (processedFiles.has(normalizedPath)) continue;
        const content = vfs.getFileContent(normalizedPath);
        if (!content) continue;

        try {
          const data = parseYAMLQuiet(content) as any;
          if (!data) {
            console.warn(`[VFS Export Asset Skip] ${normalizedPath}: YAML 解析失败`);
            continue;
          }
          const { meta, content: assetContent, tasks } = data;
          const fallbackId = file.name.replace('.yaml', '');

          // 严格使用 YAML 中的 meta.type 作为唯一真相来源
          const metaType = data.meta?.type?.toLowerCase();
          if (metaType !== 'character' && metaType !== 'scene' && metaType !== 'prop') {
            console.warn(`[VFS Export Asset Skip] ${normalizedPath}: 缺失或无效的 meta.type`);
            continue;
          }
          const assetType = metaType as Asset['type'];

          assets.push({
            id: meta?.id || fallbackId,
            type: assetType,
            name: assetContent?.name || fallbackId,
            description: assetContent?.description || '',
            status: tasks?.image?.latest?.status || 'pending',
            imageUrl: resolveVfsUrl(tasks?.image?.latest?.output),
            filePath: normalizedPath,
          });
          processedFiles.add(normalizedPath);
        } catch (e) {
          console.error(`[VFS Export Asset Error] ${normalizedPath}:`, e);
        }
      }
    }
  }

  // 2. 导出分镜 (/storyboards/*.yaml)
  if (vfs.exists('/storyboards')) {
    const files = vfs.listDirectory('/storyboards');
    for (const file of files) {
      if (file.type === 'file' && file.name.endsWith('.yaml')) {
        const path = `/storyboards/${file.name}`;
        const content = vfs.getFileContent(path);
        if (!content) continue;

        try {
          const data = parseYAMLQuiet(content) as any;
          if (!data) {
            console.warn(`[VFS Export Storyboard Skip] ${path}: YAML 解析失败`);
            continue;
          }
          const { meta, content: sbContent, tasks } = data;
          const fallbackId = file.name.replace('.yaml', '');

          const imageTask = tasks?.image;
          const videoTask = tasks?.video;

          // 状态聚合
          let status: Storyboard['status'] = 'pending';
          if (videoTask?.latest?.status === 'completed' || videoTask?.latest?.output) {
            status = 'completed';
          } else if (imageTask?.latest?.status === 'completed' || imageTask?.latest?.output) {
            status = 'completed';
          } else if (imageTask?.latest?.status === 'running') {
            status = 'generating_image';
          }

          const rawRefs = data.refs;
          const refAssetIds = Array.isArray(rawRefs)
            ? rawRefs.filter(Boolean)
            : rawRefs && typeof rawRefs === 'object'
              ? Object.values(rawRefs).flatMap((value) => Array.isArray(value) ? value : value ? [value] : []).filter(Boolean) as string[]
              : [];
          const script = sbContent?.story || sbContent?.script || '';

          storyboards.push({
            id: fallbackId, // 优先使用文件名，它是 VFS 路径中绝对唯一的
            sequenceNumber: sbContent?.sequence || 0,
            title: sbContent?.title || meta?.id || fallbackId,
            description: script || '',
            script: script || '',
            prompt: imageTask?.params?.prompt || '',
            videoPrompt: videoTask?.params?.prompt || '',
            imageUrl: resolveVfsUrl(imageTask?.latest?.output),
            videoUrl: resolveVfsUrl(videoTask?.latest?.output),
            status,
            refAssetIds,
            filePath: path,
            grid: meta?.grid, // 从 YAML 提取，例如 "2x2"
            parentId: meta?.parent, // 从 YAML 提取，关联主宫格
          });
        } catch (e) {
          console.error(`[VFS Export Storyboard Error] ${path}:`, e);
        }
      }
    }
  }

  // 排序
  // 排序
  assets.sort((a, b) => a.id.localeCompare(b.id));
  
  storyboards.sort((a, b) => {
    const seqA = a.sequenceNumber || 0;
    const seqB = b.sequenceNumber || 0;
    if (seqA !== seqB) return seqA - seqB;
    
    // 1. 处理显式的父子层级关系 (parentId)
    if (a.parentId === b.id) return 1;  // a 是 b 的子分镜，排在后
    if (b.parentId === a.id) return -1; // b 是 a 的子分镜，排在前
    
    // 2. 优先排宫格图 (基于显式的 grid 字段)
    if (a.grid && !b.grid) return -1;
    if (!a.grid && b.grid) return 1;
    
    // 3. 最后以 ID 字母顺序作为兜底
    return a.id.localeCompare(b.id);
  });

  return { assets, storyboards };
}

// 初始化项目
export function initializeProjectStructure(context: AgentToolContext, script: string) {
  const { vfs } = context;
  vfs.createDirectory('/asset_defs/chars');
  vfs.createDirectory('/asset_defs/scenes');
  vfs.createDirectory('/asset_defs/props');
  vfs.createDirectory('/assets/images');
  vfs.createDirectory('/assets/videos');
  vfs.createDirectory('/storyboards');
}
