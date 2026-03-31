/**
 * VFS React Hook
 * 在 React 组件中使用虚拟文件系统
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getVFS,
  clearVFS,
  createToolContext,
  read,
  replace,
  list,
  exportToExistingData,
  initializeProjectStructure,
  vfsStorageManager,
} from '@/lib/vfs';
import type {
  VFSReadResult,
  VFSReplaceResult,
  VFSFileEntry,
  AgentToolContext,
} from '@/lib/vfs';

import { Asset, Storyboard } from '@/stores/director-agent-store';

interface UseVFSOptions {
  projectId: string;
  autoSync?: boolean;
}

interface UseVFSReturn {
  // 状态
  isLoading: boolean;
  isSyncing: boolean;
  pendingChanges: number;
  error: string | null;

  // 响应式数据
  assets: Asset[];
  storyboards: Storyboard[];

  // 工具函数
  readFile: (path: string, offset?: number, limit?: number) => VFSReadResult;
  replaceInFile: (path: string, oldStr: string, newStr: string) => VFSReplaceResult;
  listDirectory: (path?: string) => VFSFileEntry[];
  // 数据操作
  exportData: () => {
    assets: UseVFSReturn['assets'];
    storyboards: UseVFSReturn['storyboards'];
  };

  // 同步控制
  sync: () => Promise<void>;
  reload: () => Promise<void>;

  // 初始化
  initProject: (script: string) => void;
}

export function useVFS({ projectId, autoSync = true }: UseVFSOptions): UseVFSReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // 响应式数据状态
  const [assets, setAssets] = useState<Asset[]>([]);
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);

  const contextRef = useRef<AgentToolContext | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastFileCountRef = useRef<number>(0);

  // 初始化 VFS
  useEffect(() => {
    if (!projectId) {
      // 清空上下文当没有项目时
      contextRef.current = null;
      return;
    }

    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    async function init() {
      try {
        console.log('[useVFS] Starting init for project:', projectId);
        setIsLoading(true);
        setError(null);

        // 先禁用旧项目的自动同步
        if (unsubscribeRef.current) {
          await vfsStorageManager.disableAutoSync(projectId);
          unsubscribeRef.current = null;
        }

        // 清空 VFS 缓存，确保项目切换时数据干净
        clearVFS(projectId);

        // 创建新的工具上下文
        contextRef.current = createToolContext(projectId);
        console.log('[useVFS] Context created');

        // 使用新的 storage-manager 加载项目
        const loaded = await vfsStorageManager.loadProject(projectId);
        console.log('[useVFS] loadProject result:', loaded);

        if (!isMounted) return;

        if (loaded && contextRef.current) {
          // 数据加载成功，更新文件计数并触发刷新
          const files = contextRef.current.vfs.getAllFiles();
          console.log('[useVFS] Files loaded:', files.length);
          lastFileCountRef.current = files.length;
          // 强制刷新，确保数据被正确导出
          setReloadTrigger(Date.now());

          // 订阅 VFS 变更事件（用于实时同步）
          const unsubscribeVFS = contextRef.current.vfs.subscribe((event) => {
            if (event.type === 'file:updated') {
              console.log('[useVFS] VFS file updated, triggering reload:', event.path);
              setReloadTrigger(Date.now());
            }
          });

          // 将 VFS 取消订阅函数保存到 ref
          if (unsubscribeRef.current) {
            const originalUnsubscribe = unsubscribeRef.current as () => void;
            unsubscribeRef.current = () => {
              originalUnsubscribe();
              unsubscribeVFS();
            };
          } else {
            unsubscribeRef.current = unsubscribeVFS;
          }
        } else if (!loaded) {
          // 如果没有数据，初始化空结构
          console.log('[useVFS] No data loaded, initializing empty structure');
          initializeProjectStructure(contextRef.current, '');
        }

        // 启用自动同步
        if (autoSync) {
          unsubscribe = await vfsStorageManager.enableAutoSync(projectId);
          unsubscribeRef.current = unsubscribe;
        }

        // 最终强制刷新一次，确保 UI 能够渲染
        setReloadTrigger(Date.now());
        setIsLoading(false);
        console.log('[useVFS] Init complete, trigger reload');
      } catch (err) {
        if (!isMounted) return;
        console.error('[useVFS] Init error:', err);
        setError(err instanceof Error ? err.message : '初始化失败');
        setIsLoading(false);
      }
    }

    init();

    // 定期更新同步状态
    const statusInterval = setInterval(() => {
      if (isMounted) {
        const status = vfsStorageManager.getSyncStatus(projectId);
        setIsSyncing(status.isSyncing);
        setPendingChanges(status.pendingCount);

        // 如果不在同步中且没有待处理变更，检查文件数量是否变化
        if (!status.isSyncing && status.pendingCount === 0 && contextRef.current) {
          const currentFiles = contextRef.current.vfs.getAllFiles();
          if (currentFiles.length !== lastFileCountRef.current) {
            lastFileCountRef.current = currentFiles.length;
            setReloadTrigger(prev => prev + 1);
          }
        }
      }
    }, 500);

    return () => {
      isMounted = false;
      clearInterval(statusInterval);

      // 禁用自动同步
      if (unsubscribeRef.current) {
        vfsStorageManager.disableAutoSync(projectId);
        unsubscribeRef.current = null;
      }
    };
  }, [projectId, autoSync]);

  // 读取文件
  const readFile = useCallback(
    (path: string, offset?: number, limit?: number): VFSReadResult => {
      if (!contextRef.current) {
        return { content: '', totalLines: 0, hasMore: false, nextOffset: 0 };
      }
      return read(contextRef.current, path, offset, limit);
    },
    []
  );

  // 替换内容
  const replaceInFile = useCallback(
    (path: string, oldStr: string, newStr: string): VFSReplaceResult => {
      if (!contextRef.current) {
        return { success: false, replaced: false, message: 'VFS 未初始化' };
      }
      return replace(contextRef.current, path, oldStr, newStr);
    },
    []
  );

  // 列出目录
  const listDirectory = useCallback(
    (path: string = '/'): VFSFileEntry[] => {
      if (!contextRef.current) {
        return [];
      }
      return list(contextRef.current, path);
    },
    []
  );

  // 导出数据
  const exportData = useCallback(() => {
    if (!contextRef.current) {
      return { assets: [], storyboards: [] };
    }
    return exportToExistingData(contextRef.current);
  }, []); // 不再依赖 reloadTrigger，因为我们手动触发刷新

  // 当 reloadTrigger 变化时，自动刷新暴露出的 assets 和 storyboards
  useEffect(() => {
    if (!contextRef.current || isLoading) return;
    
    console.log('[useVFS] Reloading reactive data due to trigger');
    const data = exportData();
    
    // 使用 requestAnimationFrame 延迟更新，避免 React 级联渲染警告
    requestAnimationFrame(() => {
      setAssets(data.assets);
      setStoryboards(data.storyboards);
    });
  }, [reloadTrigger, isLoading, exportData]);

  // 手动同步
  const sync = useCallback(async () => {
    if (!projectId) return;
    setIsSyncing(true);
    await vfsStorageManager.forceSync(projectId);
    setIsSyncing(false);
  }, [projectId]);

  // 重新加载
  const reload = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    await vfsStorageManager.loadProject(projectId);
    setIsLoading(false);
  }, [projectId]);

  // 初始化项目
  const initProject = useCallback(
    (script: string) => {
      if (!contextRef.current) return;
      initializeProjectStructure(contextRef.current, script);
    },
    []
  );

  return {
    isLoading,
    isSyncing,
    pendingChanges,
    error,
    assets,
    storyboards,
    readFile,
    replaceInFile,
    listDirectory,
    exportData,
    sync,
    reload,
    initProject,
  };
}
