'use client';

import { useEffect, useMemo, useState } from 'react';
import type { TaskSnapshot, TaskStatus } from '@/types/tasks';
import { Button } from '@/components/ui/button';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ImageIcon, Video, CheckCircle, XCircle, Loader2, History } from 'lucide-react';
import { DEFAULT_MODELS } from '@/lib/aigc-config';

interface TaskManagerPanelProps {
  projectId: string;
  isOpen?: boolean;
}

type PanelTaskStatus =
  | 'submitted'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

interface PanelTask {
  id: string;
  yamlPath: string;
  type: 'image' | 'video';
  name: string;
  status: PanelTaskStatus;
  model: string;
  promptPreview: string;
  createdAt: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function getTaskParams(task: TaskSnapshot): Record<string, unknown> {
  const input = asRecord(task.input);
  const nestedParams = asRecord(input.params);
  return Object.keys(nestedParams).length > 0 ? nestedParams : input;
}

function normalizeTaskType(type: string): 'image' | 'video' {
  return type === 'video' ? 'video' : 'image';
}

function normalizeTaskStatus(status: TaskStatus): PanelTaskStatus {
  if (status === 'success' || status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  if (status === 'cancelled') return 'cancelled';
  return 'processing';
}

function getYamlPath(task: TaskSnapshot, params: Record<string, unknown>): string {
  const ref = asRecord(task.ref);
  return (
    asString(ref.yamlPath) ||
    asString(task.ref) ||
    asString(params.path) ||
    asString(params.vfsPath)
  );
}

function getTaskName(taskType: 'image' | 'video', yamlPath: string): string {
  const basename = yamlPath.split('/').pop()?.replace(/\.ya?ml$/i, '') || 'unknown';
  return `${taskType === 'image' ? '图片' : '视频'}生成 · ${basename}`;
}

function toPanelTask(task: TaskSnapshot): PanelTask {
  const params = getTaskParams(task);
  const type = normalizeTaskType(task.type);
  const yamlPath = getYamlPath(task, params);
  const prompt = asString(params.prompt);

  return {
    id: task.id,
    yamlPath,
    type,
    name: getTaskName(type, yamlPath),
    status: normalizeTaskStatus(task.status),
    model: asString(params.model) || (type === 'video' ? DEFAULT_MODELS.VIDEO : DEFAULT_MODELS.IMAGE),
    promptPreview: prompt ? prompt.slice(0, 50) : '',
    createdAt: task.createdAt || task.updatedAt || new Date().toISOString(),
  };
}

function filterTasksByStatus(tasks: PanelTask[], status: PanelTaskStatus) {
  return tasks.filter((task) => task.status === status);
}

export function TaskManagerPanel({ projectId, isOpen }: TaskManagerPanelProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'history'>('all');
  const [tasks, setTasks] = useState<PanelTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!projectId || !isOpen) return;

    let isMounted = true;
    let eventSource: EventSource | null = null;

    const loadTasks = async (showLoading = false) => {
      if (showLoading && isMounted) {
        setIsLoading(true);
      }

      try {
        const response = await fetch(`/api/projects/${projectId}/tasks`);
        const data = await response.json();
        if (isMounted && data.success) {
          const nextTasks = Array.isArray(data.tasks) ? data.tasks.map(toPanelTask) : [];
          setTasks(nextTasks);
        }
      } catch (error) {
        console.error('[TaskManagerPanel] load failed:', error);
      } finally {
        if (isMounted && showLoading) {
          setIsLoading(false);
        }
      }
    };

    void loadTasks(true);

    if (typeof window !== 'undefined' && 'EventSource' in window) {
      eventSource = new window.EventSource(`/api/vfs/events?projectId=${projectId}`);
      eventSource.addEventListener('vfs', (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse((event as MessageEvent).data) as { path?: string };
          if (data.path === '/tasks.jsonl') {
            void loadTasks(false);
          }
        } catch {
          // ignore malformed event payloads
        }
      });
    }

    return () => {
      isMounted = false;
      eventSource?.close();
    };
  }, [projectId, isOpen]);

  const orderedTasks = useMemo(
    () => [...tasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [tasks]
  );
  const submittedTasks = useMemo(() => filterTasksByStatus(orderedTasks, 'submitted'), [orderedTasks]);
  const runningTasks = useMemo(() => filterTasksByStatus(orderedTasks, 'processing'), [orderedTasks]);
  const completedTasks = useMemo(() => filterTasksByStatus(orderedTasks, 'completed').slice(0, 50), [orderedTasks]);
  const failedTasks = useMemo(() => filterTasksByStatus(orderedTasks, 'failed'), [orderedTasks]);
  const totalActiveCount = submittedTasks.length + runningTasks.length;

  const renderTaskCard = (task: PanelTask) => (
    <div
      key={task.id}
      className="flex items-center justify-between p-3 border border-zinc-800 rounded-lg bg-zinc-900/50 hover:bg-zinc-900 transition-colors"
    >
      <div className="flex items-center gap-3">
        {task.type === 'video' ? (
          <Video className="w-4 h-4 text-purple-400" />
        ) : (
          <ImageIcon className="w-4 h-4 text-blue-400" />
        )}
        <div>
          <div className="text-sm text-white">{task.name}</div>
          <div className="text-xs text-zinc-500">
            {task.model}
            {task.promptPreview ? ` · ${task.promptPreview}` : ''}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {task.status === 'processing' && (
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
        )}
        {task.status === 'completed' && (
          <CheckCircle className="w-4 h-4 text-green-400" />
        )}
        {task.status === 'failed' && (
          <XCircle className="w-4 h-4 text-red-400" />
        )}
      </div>
    </div>
  );

  const renderEmpty = (label: string) => (
    <div className="text-center py-8 text-zinc-500">{label}</div>
  );

  return (
    <div className="p-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-white mb-4">
          任务管理
          {totalActiveCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
              {totalActiveCount} 进行中
            </span>
          )}
        </DialogTitle>
      </DialogHeader>

      <div className="flex gap-2 mb-4">
        <Button
          variant={activeTab === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('all')}
        >
          全部 ({orderedTasks.length})
        </Button>
        <Button
          variant={activeTab === 'active' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('active')}
        >
          进行中 ({totalActiveCount})
        </Button>
        <Button
          variant={activeTab === 'history' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('history')}
        >
          <History className="w-4 h-4 mr-1" />
          历史 ({completedTasks.length})
        </Button>
      </div>

      <ScrollArea className="h-[400px]">
        {isLoading ? (
          <div className="text-center py-8 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            加载中...
          </div>
        ) : activeTab === 'all' ? (
          <div className="space-y-4">
            {submittedTasks.length > 0 && (
              <div>
                <div className="text-xs text-cyan-500 mb-2 font-medium">已提交 ({submittedTasks.length})</div>
                {submittedTasks.map(renderTaskCard)}
              </div>
            )}

            {runningTasks.length > 0 && (
              <div>
                <div className="text-xs text-blue-500 mb-2 font-medium">运行中 ({runningTasks.length})</div>
                {runningTasks.map(renderTaskCard)}
              </div>
            )}

            {completedTasks.length > 0 && (
              <div>
                <div className="text-xs text-green-500 mb-2 font-medium">已完成 ({completedTasks.length})</div>
                {completedTasks.map(renderTaskCard)}
              </div>
            )}

            {failedTasks.length > 0 && (
              <div>
                <div className="text-xs text-red-500 mb-2 font-medium">失败 ({failedTasks.length})</div>
                {failedTasks.map(renderTaskCard)}
              </div>
            )}

            {orderedTasks.length === 0 && renderEmpty('暂无任务')}
          </div>
        ) : activeTab === 'active' ? (
          <div className="space-y-4">
            {submittedTasks.length > 0 && (
              <div>
                <div className="text-xs text-zinc-500 mb-2">已提交 ({submittedTasks.length})</div>
                {submittedTasks.map(renderTaskCard)}
              </div>
            )}

            {runningTasks.length > 0 && (
              <div>
                <div className="text-xs text-zinc-500 mb-2">运行中 ({runningTasks.length})</div>
                {runningTasks.map(renderTaskCard)}
              </div>
            )}

            {totalActiveCount === 0 && renderEmpty('暂无进行中的任务')}
          </div>
        ) : (
          <div className="space-y-2">
            {completedTasks.length > 0 ? completedTasks.map(renderTaskCard) : renderEmpty('暂无历史任务')}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
