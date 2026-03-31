'use client';

import { useDirectorAgentStore, Storyboard } from '@/stores/director-agent-store';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { CheckCircle2, ImageIcon, Video, Loader2, Clock } from 'lucide-react';

interface TimelineOverviewProps {
  storyboards: Storyboard[];
  selectedStoryboardId?: string | null;
  onSelectStoryboard?: (id: string) => void;
}

const statusIcons = {
  pending: <Clock className="w-4 h-4 text-zinc-500" />,
  generating_image: <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />,
  generating_video: <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />,
  completed: <CheckCircle2 className="w-4 h-4 text-green-400" />,
  failed: <span className="text-red-400 text-xs">!</span>,
};

const statusLabels = {
  pending: '待生成',
  generating_image: '生图中',
  generating_video: '生视频中',
  completed: '完成',
  failed: '失败',
};

export function TimelineOverview({ 
  storyboards, 
  selectedStoryboardId: externalSelectedId,
  onSelectStoryboard 
}: TimelineOverviewProps) {
  const store = useDirectorAgentStore();
  
  // 优先使用外部传入的 props，否则使用 store
  const selectedStoryboardId = externalSelectedId ?? store.selectedStoryboardId;
  const setSelectedStoryboardId = onSelectStoryboard ?? store.setSelectedStoryboardId;

  if (storyboards.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center bg-zinc-900/50 border-b border-zinc-800">
        <p className="text-zinc-500 text-sm">暂无分镜数据，请先解析剧本</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 border-b border-zinc-800 py-4">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-3 px-4">
          {storyboards.map((storyboard, index) => (
            <button
              key={`${storyboard.id}-${index}`}
              onClick={() => setSelectedStoryboardId(storyboard.id)}
              className={cn(
                'flex-shrink-0 w-32 text-left transition-all duration-200',
                'group relative',
                selectedStoryboardId === storyboard.id
                  ? 'ring-2 ring-indigo-500 rounded-lg'
                  : 'hover:opacity-80'
              )}
            >
              {/* 缩略图 */}
              <div className="aspect-video bg-zinc-800 rounded-lg overflow-hidden mb-2 relative">
                {storyboard.imageUrl ? (
                  <img
                    src={storyboard.imageUrl}
                    alt={storyboard.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-zinc-600" />
                  </div>
                )}

                {/* 状态指示器 */}
                <div className="absolute top-1 right-1 flex items-center gap-1 bg-black/60 rounded px-1.5 py-0.5">
                  {statusIcons[storyboard.status]}
                </div>

                {/* 序号 */}
                <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1.5 py-0.5 text-xs text-white">
                  {index + 1}
                </div>

                {/* 视频标记 */}
                {storyboard.videoUrl && (
                  <div className="absolute bottom-1 right-1 bg-green-500/80 rounded p-0.5">
                    <Video className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>

              {/* 标题 */}
              <p className="text-xs text-zinc-300 truncate px-1">
                {storyboard.title}
              </p>

              {/* 状态文字 */}
              <p className="text-[10px] text-zinc-500 px-1">
                {statusLabels[storyboard.status]}
              </p>

              {/* 箭头连接 */}
              {index < storyboards.length - 1 && (
                <div className="absolute -right-2 top-1/2 -translate-y-1/2 text-zinc-600">
                  →
                </div>
              )}
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
