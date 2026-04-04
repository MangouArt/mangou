'use client';

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';

// Project Hooks
import { useProjects } from '../hooks/use-project';

// UI
import { Button } from '@components/ui/button';

// 格式化时间显示
function formatTimeAgo(date: string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return past.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export default function AgentStartPage() {
  const navigate = useNavigate();
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [appRoot, setAppRoot] = useState<string | null>(null);
  const [dataRoot, setDataRoot] = useState<string | null>(null);

  const { data: projects = [] } = useProjects();

  useEffect(() => {
    fetch('/api/meta')
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (payload?.success && payload.data?.appRoot) {
          setAppRoot(payload.data.appRoot);
          setDataRoot(payload.data.dataRoot || null);
        } else {
          setAppRoot(null);
          setDataRoot(null);
        }
      })
      .catch(() => {
        setAppRoot(null);
        setDataRoot(null);
      });
  }, []);

  // 获取最近3个项目
  const recentProjects = projects.slice(0, 3);
  // 是否有历史项目
  const hasHistory = recentProjects.length > 0;

  // 继续历史项目
  const handleContinueProject = (projectId: string) => {
    navigate(`/dashboard/agent/${projectId}`);
  };

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Mango AI Comic</h1>
          <span className="text-zinc-500">|</span>
          <span className="text-zinc-400">副导演模式</span>
          {(dataRoot || appRoot) && (
            <>
              <span className="text-zinc-700">|</span>
              <span className="text-xs text-zinc-500 font-mono">
                MANGOU_HOME: {dataRoot || appRoot}
              </span>
            </>
          )}
        </div>
        <Button
          variant="outline"
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          onClick={() => navigate('/dashboard/agent')}
        >
          退出
        </Button>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-3xl mx-auto space-y-6 py-8 px-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-white">工作区可视化总览</h2>
            <p className="text-zinc-400">
              这里只负责浏览本地项目、素材与任务状态。创建项目和生成素材请通过 Agent Skill 或脚本完成。
            </p>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-sm text-zinc-400">当前工作区</p>
            <p className="mt-2 font-mono text-sm text-zinc-200 break-all">{dataRoot || appRoot || '未检测到工作区路径'}</p>
            <p className="mt-3 text-xs leading-6 text-zinc-500">
              前端已切换为只读模式：不再提供对话输入、项目创建、生成、导出等操作入口。
            </p>
          </div>

          {/* 历史项目列表 */}
          {hasHistory ? (
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/50">
              <div className="p-4 border-b border-zinc-800">
                <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  继续制作
                </h3>
              </div>
              
              <div className="p-2">
                {/* 项目列表 */}
                <div style={showAllProjects ? { height: 300, overflowY: 'auto', paddingRight: 8 } : undefined}>
                  {(showAllProjects ? projects : recentProjects).map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between px-3 py-2 hover:bg-zinc-800/50 rounded-md group cursor-pointer transition-colors"
                      onClick={() => handleContinueProject(project.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-zinc-300 truncate block group-hover:text-white transition-colors">
                          {project.name || '未命名项目'}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {formatTimeAgo(project.updated_at || project.updatedAt || '')}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-400/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleContinueProject(project.id);
                        }}
                      >
                        打开
                      </Button>
                    </div>
                  ))}
                </div>
                
                {/* 查看更多/收起 - 始终在列表外部 */}
                {projects.length > 3 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 text-zinc-500 hover:text-zinc-300"
                    onClick={() => setShowAllProjects(!showAllProjects)}
                  >
                    {showAllProjects ? (
                      <>
                        <ChevronUp className="w-4 h-4 mr-1" />
                        收起
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-1" />
                        查看全部项目 ({projects.length})
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center">
              <p className="text-zinc-300">当前工作区还没有可视化项目</p>
              <p className="mt-2 text-sm text-zinc-500">
                请先用 `mangou` 的脚本或 Agent Skill 在工作区根目录创建项目，再回到这里浏览。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
