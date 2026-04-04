'use client';

import { Progress } from '@web/components/ui/progress';
import { useMemo } from 'react';
import { Asset, Storyboard } from '@web/stores/director-agent-store';

interface ProgressIndicatorProps {
  projectId: string;
  exportData: () => {
    assets: Asset[];
    storyboards: Storyboard[];
  };
  isLoading: boolean;
}

export function ProgressIndicator({ projectId, exportData, isLoading }: ProgressIndicatorProps) {
  const { completed, total, percentage, stage } = useMemo(() => {
    if (isLoading) {
      return {
        stage: 'intake' as const,
        completed: 0,
        total: 0,
        percentage: 0,
      };
    }

    const data = exportData();
    const assets = data.assets || [];
    const storyboards = data.storyboards || [];

    const totalAssets = assets.length;
    const completedAssets = assets.filter(a => a.status === 'completed').length;
    const totalStoryboards = storyboards.length;
    const completedStoryboards = storyboards.filter(s => s.status === 'completed').length;

    const total = totalAssets + totalStoryboards;
    const completed = completedAssets + completedStoryboards;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    // 判断当前阶段
    let stage: 'intake' | 'assets' | 'storyboards' | 'completed' = 'intake';
    if (total === 0) {
      stage = 'intake';
    } else if (completedAssets < totalAssets) {
      stage = 'assets';
    } else if (completedStoryboards < totalStoryboards) {
      stage = 'storyboards';
    } else if (completed === total && total > 0) {
      stage = 'completed';
    }

    return {
      stage,
      completed,
      total,
      percentage,
    };
  }, [exportData, isLoading]);

  return (
    <div className="w-48">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-zinc-400">
          {stage === 'intake' && '等待开始'}
          {stage === 'assets' && '生成资产中...'}
          {stage === 'storyboards' && '生成分镜中...'}
          {stage === 'completed' && '制作完成'}
        </span>
        <span className="text-xs text-zinc-500">
          {percentage}%
        </span>
      </div>
      <Progress
        value={percentage}
        className="h-1 bg-zinc-800"
      />
    </div>
  );
}