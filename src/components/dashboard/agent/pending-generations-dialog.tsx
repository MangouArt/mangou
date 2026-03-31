'use client';

import { PendingGeneration } from '@/stores/director-agent-store';
import { Button } from '@/components/ui/button';
import { ImageIcon, Video, CheckCircle, XCircle, Loader2, User, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

// 任务卡片组件（导出以便复用）
export function GenerationCard({ 
  generation, 
  isProcessing, 
  onExecute, 
  onCancel 
}: { 
  generation: PendingGeneration; 
  isProcessing: boolean;
  onExecute: () => void;
  onCancel: () => void;
}) {
  const { params, refs, type } = generation;

  // 格式化参数显示 - 过滤掉负面提示
  const formatParam = (key: string, value: unknown) => {
    if (value === undefined || value === null) return null;
    // 跳过负面提示
    if (key === 'negativePrompt' || key === 'negative_prompt') return null;
    
    const labels: Record<string, string> = {
      style: '风格',
      aspectRatio: '比例',
      seed: '种子',
      duration: '时长',
      fps: '帧率',
      motionStrength: '运动强度',
      model: '模型',
    };
    return (
      <div key={key} className="flex justify-between text-xs py-0.5">
        <span className="text-zinc-500">{labels[key] || key}:</span>
        <span className="text-zinc-300">{String(value)}</span>
      </div>
    );
  };

  return (
    <div className="border border-zinc-800 rounded-lg bg-zinc-950 p-4 space-y-3">
      {/* 头部：图标、名称、类型 */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {type === 'video' ? (
            <Video className="w-4 h-4 text-purple-400" />
          ) : (
            <ImageIcon className="w-4 h-4 text-blue-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-white truncate">
              {generation.name}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {type === 'video' ? '视频' : '图片'}
            </span>
          </div>
        </div>
      </div>

      {/* 提示词 */}
      <div>
        <div className="text-xs text-zinc-500 mb-1">提示词</div>
        <p className="text-xs text-zinc-300 bg-zinc-900/50 p-2 rounded leading-relaxed">
          {generation.prompt}
        </p>
      </div>

      {/* 生成参数 */}
      {Object.keys(params).length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-xs text-zinc-500 mb-1">
            <Settings className="w-3 h-3" />
            生成参数
          </div>
          <div className="bg-zinc-900/50 p-2 rounded space-y-0.5">
            {Object.entries(params).map(([key, value]) => formatParam(key, value))}
          </div>
        </div>
      )}

      {/* 关联资源 */}
      {refs && (refs.images?.length || refs.videos?.length) && (
        <div>
          <div className="flex items-center gap-1 text-xs text-zinc-500 mb-1">
            <User className="w-3 h-3" />
            参考资源
          </div>
          <div className="bg-zinc-900/50 p-2 rounded">
            <div className="flex flex-wrap gap-2">
              {refs.images?.map((url, idx) => (
                <div key={`img-${idx}`} className="w-16 h-16 rounded overflow-hidden bg-zinc-800">
                  <img src={url} alt={`参考 ${idx + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
              {refs.videos?.map((url, idx) => (
                <div key={`vid-${idx}`} className="w-16 h-16 rounded overflow-hidden bg-zinc-800">
                  <video src={url} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 操作按钮 - 右下角 */}
      <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800/50">
        {isProcessing ? (
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
        ) : (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-3 text-green-400 hover:text-green-300 hover:bg-green-400/10"
              onClick={onExecute}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              执行
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-3 text-red-400 hover:text-red-300 hover:bg-red-400/10"
              onClick={onCancel}
            >
              <XCircle className="w-4 h-4 mr-1" />
              取消
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
