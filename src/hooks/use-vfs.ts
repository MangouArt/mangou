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

  // 响应式数据状态
  const [assets, setAssets] = useState<Asset[]>([]);
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);

  const contextRef = useRef<AgentToolContext | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const refreshScheduledRef = useRef(false);
  const mountedRef = useRef(false);

  const flushReactiveData = useCallback(() => {
    refreshScheduledRef.current = false;
    if (!mountedRef.current || !contextRef.current) return;
    const data = exportToExistingData(contextRef.current);
    setAssets(data.assets);
    setStoryboards(data.storyboards);
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshScheduledRef.current) return;
    refreshScheduledRef.current = true;

    requestAnimationFrame(() => {
      flushReactiveData();
    });
  }, [flushReactiveData]);

  // 初始化 VFS
  useEffect(() => {
    mountedRef.current = true;

    if (!projectId) {
      contextRef.current = null;
      setAssets([]);
      setStoryboards([]);
      mountedRef.current = false;
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
          console.log('[useVFS] Files loaded:', contextRef.current.vfs.getAllFiles().length);
          const unsubscribeVFS = contextRef.current.vfs.subscribe((event) => {
            if (event.type === 'file:updated' || event.type === 'file:created' || event.type === 'file:deleted') {
              console.log('[useVFS] VFS changed, scheduling refresh:', event.path);
              scheduleRefresh();
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
          console.log('[useVFS] No data loaded, initializing empty structure');
          initializeProjectStructure(contextRef.current, '');
          scheduleRefresh();
        }

        // 启用自动同步
        if (autoSync) {
          unsubscribe = await vfsStorageManager.enableAutoSync(projectId);
          unsubscribeRef.current = unsubscribe;
        }

        const status = vfsStorageManager.getSyncStatus(projectId);
        setIsSyncing(status.isSyncing);
        setPendingChanges(status.pendingCount);
        scheduleRefresh();
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

    return () => {
      isMounted = false;
      mountedRef.current = false;
      refreshScheduledRef.current = false;

      if (unsubscribeRef.current) {
        vfsStorageManager.disableAutoSync(projectId);
        unsubscribeRef.current = null;
      }
    };
  }, [projectId, autoSync, scheduleRefresh]);

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
  }, []);

  // 手动同步
  const sync = useCallback(async () => {
    if (!projectId) return;
    setIsSyncing(true);
    await vfsStorageManager.forceSync(projectId);
    const status = vfsStorageManager.getSyncStatus(projectId);
    setIsSyncing(status.isSyncing);
    setPendingChanges(status.pendingCount);
    scheduleRefresh();
    setIsSyncing(false);
  }, [projectId, scheduleRefresh]);

  // 重新加载
  const reload = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    await vfsStorageManager.loadProject(projectId);
    const status = vfsStorageManager.getSyncStatus(projectId);
    setIsSyncing(status.isSyncing);
    setPendingChanges(status.pendingCount);
    scheduleRefresh();
    setIsLoading(false);
  }, [projectId, scheduleRefresh]);

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
