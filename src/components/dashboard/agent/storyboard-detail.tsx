'use client';

import { useMemo, useState } from 'react';
import { Asset, Storyboard } from '@/stores/director-agent-store';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImageIcon, MapPin, User, Video, Wand2 } from 'lucide-react';

interface StoryboardDetailProps {
  storyboard: Storyboard | undefined;
  assets: Asset[];
  projectId: string;
  readOnly?: boolean;
}

export function StoryboardDetail({ storyboard, assets }: StoryboardDetailProps) {
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');

  const relatedAssets = useMemo(() => {
    if (!storyboard) return [];
    const refSet = new Set((storyboard.refAssetIds || []).filter(Boolean));
    return assets.filter((asset) => refSet.has(asset.id));
  }, [storyboard, assets]);

  if (!storyboard) {
    return (
      <Card className="h-full bg-zinc-900 border-zinc-800">
        <CardContent className="flex items-center justify-center h-full">
          <p className="text-zinc-500">请选择一个分镜查看详情</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full bg-zinc-900 border-zinc-800 flex flex-col">
      <CardContent className="flex-1 p-4 flex flex-col gap-4 overflow-hidden">
        <div className="shrink-0">
          <h3 className="text-sm font-medium text-zinc-400 mb-1">原剧本</h3>
          <p className="text-sm text-zinc-300 leading-relaxed">
            {storyboard.script || storyboard.description || ''}
          </p>
        </div>

        {relatedAssets.length > 0 && (
          <div className="shrink-0">
            <h3 className="text-sm font-medium text-zinc-400 mb-2">参考资产</h3>
            <div className="flex gap-2 flex-wrap">
              {relatedAssets.map((asset) => (
                <div key={asset.id} className="flex items-center gap-1.5 bg-zinc-800 px-2 py-1 rounded text-xs">
                  {asset.type === 'character' ? (
                    <User className="w-3 h-3 text-indigo-400" />
                  ) : asset.type === 'scene' ? (
                    <MapPin className="w-3 h-3 text-amber-400" />
                  ) : (
                    <ImageIcon className="w-3 h-3 text-zinc-400" />
                  )}
                  <span className="text-zinc-300">{asset.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'image' | 'video')} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2 bg-zinc-800 rounded-lg p-1 shrink-0">
            <TabsTrigger value="image" className="data-[state=active]:bg-zinc-700 h-8">
              <ImageIcon className="w-4 h-4 mr-1.5" />
              分镜图
            </TabsTrigger>
            <TabsTrigger value="video" className="data-[state=active]:bg-zinc-700 h-8">
              <Video className="w-4 h-4 mr-1.5" />
              分镜视频
            </TabsTrigger>
          </TabsList>

          <TabsContent value="image" className="flex-1 flex flex-col min-h-0 mt-4 overflow-hidden">
            <div className="flex-1 bg-zinc-800 rounded-lg overflow-hidden relative">
              {storyboard.imageUrl ? (
                <img
                  src={storyboard.imageUrl}
                  alt={storyboard.title}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                  <ImageIcon className="w-12 h-12 text-zinc-600" />
                  <span className="text-xs text-zinc-500">暂无图片</span>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="video" className="flex-1 flex flex-col min-h-0 mt-4 overflow-hidden">
            <div className="flex-1 bg-zinc-800 rounded-lg overflow-hidden relative">
              {storyboard.videoUrl ? (
                <video
                  src={storyboard.videoUrl}
                  controls
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                  <Video className="w-12 h-12 text-zinc-600" />
                  <span className="text-xs text-zinc-500">
                    {storyboard.imageUrl ? '暂无视频' : '暂无分镜图'}
                  </span>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {storyboard.prompt && (
          <div className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm text-zinc-400">
              <Wand2 className="w-4 h-4" />
              当前提示词
            </div>
            <p className="text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">
              {activeTab === 'video' ? storyboard.videoPrompt || storyboard.prompt : storyboard.prompt}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
