'use client';

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, ChevronDown } from 'lucide-react';

// Components
import { TimelineOverview } from '@/components/dashboard/agent/timeline-overview';
import { StoryboardDetail } from '@/components/dashboard/agent/storyboard-detail';
import { ResourcePanel } from '@/components/dashboard/agent/resource-panel';
import { ProgressIndicator } from '@/components/dashboard/agent/progress-indicator';
import { TaskManagerPanel } from '@/components/dashboard/agent/task-manager-panel';
import { 
  Dialog, 
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Store
import {
  useDirectorAgentStore,
  selectCharacters,
  selectScenes,
  selectProps,
  selectCurrentStoryboard,
} from '@/stores/director-agent-store';

// Hooks
import { useVFS } from '@/hooks/use-vfs';
import { useProjectManager } from '@/hooks/use-project-manager';

export default function ProjectPage() {
  const navigate = useNavigate();
  const { projectId: projectIdParam } = useParams();
  const [projectId, setProjectId] = useState<string>('');
  const [showPendingDialog, setShowPendingDialog] = useState(false);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);

  // 1. 解析 Params
  useEffect(() => {
    if (!projectIdParam) return;
    if (projectIdParam === 'new') {
      navigate('/dashboard/agent');
      return;
    }
    setProjectId(projectIdParam);
  }, [projectIdParam, navigate]);

  // 2. Store & Selector
  const store = useDirectorAgentStore();
  const {
    selectedStoryboardId,
    setSelectedStoryboardId,
    setCurrentStage,
  } = store;

  // 3. Project Manager
  const {
    projects,
    projectsLoading,
    currentProject,
    handleProjectChange,
  } = useProjectManager({ projectId });

  // 4. VFS & Sync Logic (唯一数据源)
  const {
    isLoading: vfsLoading,
    isSyncing,
    pendingChanges,
    assets,         // 响应式资产
    storyboards,    // 响应式分镜
    exportData,
  } = useVFS({ projectId, autoSync: true });

  const syncStatus = vfsLoading ? 'loading' : isSyncing ? 'syncing' : pendingChanges > 0 ? 'pending' : 'synced';

  // 项目重置逻辑
  useEffect(() => {
    if (projectId) {
      setSelectedStoryboardId(null);
      setCurrentStage('planning');
    }
  }, [projectId, setSelectedStoryboardId, setCurrentStage]);

  useEffect(() => {
    fetch('/api/meta')
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (payload?.success) {
          setWorkspacePath(payload.data?.dataRoot || payload.data?.appRoot || null);
        } else {
          setWorkspacePath(null);
        }
      })
      .catch(() => {
        setWorkspacePath(null);
      });
  }, []);

  // 7. UI 数据派生 (基于 VFS 原始数据)
  const characters = useMemo(() => selectCharacters({ assets }), [assets]);
  const scenes = useMemo(() => selectScenes({ assets }), [assets]);
  const props = useMemo(() => selectProps({ assets }), [assets]);
  const currentStoryboard = useMemo(() => selectCurrentStoryboard({
    storyboards,
    selectedStoryboardId,
  }), [storyboards, selectedStoryboardId]);

  if (!projectId) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/50 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Mango AI Comic</h1>
          <span className="text-zinc-500">|</span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="text-zinc-300 hover:text-white hover:bg-zinc-800 px-2 group relative" 
                disabled={projectsLoading}
                title="点击切换项目"
              >
                {projectsLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <>
                    <span className="max-w-[200px] truncate font-bold text-white group-hover:text-indigo-400">
                      {currentProject?.name || '选择项目'}
                    </span>
                    <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 bg-zinc-900 border-zinc-700">
              {projects.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => handleProjectChange(p.id)}
                  className={`cursor-pointer ${p.id === projectId ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-300'}`}
                >
                  <span className="truncate">{p.name || '未命名项目'}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="text-zinc-500">|</span>
          <span className="text-zinc-400">只读可视化</span>
          {workspacePath && (
            <>
              <span className="text-zinc-700">|</span>
              <span className="max-w-[360px] truncate text-xs text-zinc-500 font-mono">
                {workspacePath}
              </span>
            </>
          )}

          {/* Sync Status Badge */}
          <div className="ml-2">
            {syncStatus === 'loading' && <span className="text-xs text-zinc-500">加载中...</span>}
            {syncStatus === 'syncing' && <span className="text-xs text-blue-400">同步中...</span>}
            {syncStatus === 'pending' && <span className="text-xs text-orange-400">{pendingChanges} 待同步</span>}
            {syncStatus === 'synced' && <span className="text-xs text-green-400">已同步</span>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentProject?.video_url && (
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-300 hover:text-white hover:bg-zinc-800"
              onClick={() => window.open(currentProject.video_url as string, '_blank')}
            >
              查看成片
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-zinc-400 hover:text-white hover:bg-zinc-800"
            onClick={() => setShowPendingDialog(true)}
          >
            任务列表
          </Button>
          <div className="w-px h-4 bg-zinc-700 mx-1" />
          <ProgressIndicator projectId={projectId} exportData={exportData} isLoading={vfsLoading} />
          <div className="w-px h-6 bg-zinc-700" />
          <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800" onClick={() => navigate('/dashboard/agent')}>返回</Button>
        </div>
      </header>

      {/* Timeline Overview */}
      <div className="shrink-0"><TimelineOverview storyboards={storyboards} /></div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-4 overflow-y-auto">
          <StoryboardDetail storyboard={currentStoryboard} assets={assets} projectId={projectId} readOnly />
        </div>
        <div className="w-80 shrink-0 h-full overflow-y-auto">
          <ResourcePanel characters={characters} scenes={scenes} props={props} projectId={projectId} readOnly />
        </div>
      </div>

      <Dialog open={showPendingDialog} onOpenChange={setShowPendingDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] bg-zinc-900 border-zinc-700 text-white p-0">
          {showPendingDialog && <TaskManagerPanel projectId={projectId} isOpen={showPendingDialog} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
