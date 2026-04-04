'use client';

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, ChevronDown } from 'lucide-react';

// Components
import { TimelineOverview } from '@web/components/dashboard/agent/timeline-overview';
import { StoryboardDetail } from '@web/components/dashboard/agent/storyboard-detail';
import { ResourcePanel } from '@web/components/dashboard/agent/resource-panel';
import { ProgressIndicator } from '@web/components/dashboard/agent/progress-indicator';
import { Button } from '@web/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@web/components/ui/dropdown-menu';

// Store
import {
  useDirectorAgentStore,
  selectCharacters,
  selectScenes,
  selectProps,
  selectCurrentStoryboard,
} from '@web/stores/director-agent-store';

// Hooks
import { useVFS } from '@web/hooks/use-vfs';
import { useProjectManager } from '@web/hooks/use-project-manager';

export default function ProjectPage() {
  const navigate = useNavigate();
  const { projectId: projectIdParam } = useParams();
  const [projectId, setProjectId] = useState<string>('');
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
    assets,         // 响应式资产
    storyboards,    // 响应式分镜
    exportData,
  } = useVFS({ projectId, autoSync: true });

  // 项目重置逻辑
  useEffect(() => {
    if (projectId) {
      setSelectedStoryboardId(null);
    }
  }, [projectId, setSelectedStoryboardId]);

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

          {vfsLoading && <span className="ml-2 text-xs text-zinc-500">加载中...</span>}
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
          <ProgressIndicator projectId={projectId} exportData={exportData} isLoading={vfsLoading} />
          <div className="w-px h-6 bg-zinc-700" />
          <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800" onClick={() => navigate('/dashboard/agent')}>返回</Button>
        </div>
      </header>

      {/* Timeline Overview */}
      <div className="shrink-0">
        <TimelineOverview
          storyboards={storyboards}
          selectedStoryboardId={selectedStoryboardId}
          onSelectStoryboard={setSelectedStoryboardId}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-4 overflow-y-auto">
          <StoryboardDetail storyboard={currentStoryboard} assets={assets} projectId={projectId} readOnly />
        </div>
        <div className="w-80 shrink-0 h-full overflow-y-auto">
          <ResourcePanel characters={characters} scenes={scenes} props={props} projectId={projectId} readOnly />
        </div>
      </div>
    </div>
  );
}
