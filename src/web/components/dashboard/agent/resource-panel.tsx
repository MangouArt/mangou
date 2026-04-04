'use client';

import { useMemo, useState } from 'react';
import { Asset } from '@web/stores/director-agent-store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@web/components/ui/tabs';
import { Badge } from '@web/components/ui/badge';
import { ScrollArea } from '@web/components/ui/scroll-area';
import { Box, ImageIcon, User } from 'lucide-react';

interface ResourcePanelProps {
  characters: Asset[];
  scenes: Asset[];
  props: Asset[];
  projectId: string;
  readOnly?: boolean;
}

function AssetCard({ asset }: { asset: Asset }) {
  return (
    <div className="bg-zinc-800 rounded-lg p-2 space-y-2">
      <div className="aspect-square bg-zinc-700 rounded-md overflow-hidden relative">
        {asset.imageUrl ? (
          <img
            src={asset.imageUrl}
            alt={asset.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {asset.type === 'character' && <User className="w-8 h-8 text-zinc-500" />}
            {asset.type === 'scene' && <ImageIcon className="w-8 h-8 text-zinc-500" />}
            {asset.type === 'prop' && <Box className="w-8 h-8 text-zinc-500" />}
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="text-sm font-medium text-white truncate">{asset.name}</p>
        <p className="text-[11px] text-zinc-500 truncate">{asset.description || '暂无描述'}</p>
      </div>
    </div>
  );
}

export function ResourcePanel({ characters, scenes, props }: ResourcePanelProps) {
  const [activeTab, setActiveTab] = useState('characters');

  const allAssets = useMemo(() => [...characters, ...scenes, ...props], [characters, scenes, props]);
  const completedCount = allAssets.filter((asset) => asset.imageUrl).length;
  const totalCount = allAssets.length;

  return (
    <div className="h-full flex flex-col bg-zinc-900 border-l border-zinc-800">
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">资源库</h3>
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
            {completedCount}/{totalCount}
          </Badge>
        </div>
        <p className="text-xs text-zinc-500 mt-1">
          当前 YAML 投影出的资源预览
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start rounded-none bg-zinc-900 border-b border-zinc-800 p-0 h-10 shrink-0">
          <TabsTrigger value="characters" className="flex-1 rounded-none data-[state=active]:bg-zinc-800 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500">
            角色 ({characters.length})
          </TabsTrigger>
          <TabsTrigger value="scenes" className="flex-1 rounded-none data-[state=active]:bg-zinc-800 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500">
            场景 ({scenes.length})
          </TabsTrigger>
          <TabsTrigger value="props" className="flex-1 rounded-none data-[state=active]:bg-zinc-800 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500">
            道具 ({props.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="characters" className="flex-1 min-h-0 m-0">
          <ScrollArea className="h-full">
            <div className="grid grid-cols-2 gap-3 p-4">
              {characters.map((asset) => <AssetCard key={asset.id} asset={asset} />)}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="scenes" className="flex-1 min-h-0 m-0">
          <ScrollArea className="h-full">
            <div className="grid grid-cols-2 gap-3 p-4">
              {scenes.map((asset) => <AssetCard key={asset.id} asset={asset} />)}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="props" className="flex-1 min-h-0 m-0">
          <ScrollArea className="h-full">
            <div className="grid grid-cols-2 gap-3 p-4">
              {props.map((asset) => <AssetCard key={asset.id} asset={asset} />)}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
