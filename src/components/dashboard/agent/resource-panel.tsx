'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Asset, PendingGeneration } from '@/stores/director-agent-store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import {
  User,
  ImageIcon,
  Box,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wand2,
  Settings,
  History,
  ExternalLink
} from 'lucide-react';
import { MODEL_OPTIONS, DEFAULT_MODELS, ASPECT_RATIO_OPTIONS } from '@/lib/aigc-config';
import { getTaskRefPath, normalizeHistoryTask } from '@/lib/task-history';

interface ResourcePanelProps {
  characters: Asset[];
  scenes: Asset[];
  props: Asset[];
  projectId: string;
  readOnly?: boolean;
  onShowTaskDialog?: () => void; // 确认生成后跳转到任务管理弹窗
}

const statusIcons = {
  pending: <Clock className="w-3 h-3 text-zinc-500" />,
  generating: <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />,
  completed: <CheckCircle2 className="w-3 h-3 text-green-400" />,
  failed: <AlertCircle className="w-3 h-3 text-red-400" />,
};

function AssetCard({ asset, onGenerate, onShowHistory }: { 
  asset: Asset; 
  onGenerate?: () => void;
  onShowHistory?: () => void;
}) {
  return (
    <div className="bg-zinc-800 rounded-lg p-2 space-y-2 group">
      <div 
        className="aspect-square bg-zinc-700 rounded-md overflow-hidden relative cursor-pointer"
        onClick={onShowHistory}
      >
        {asset.imageUrl ? (
          <img
            src={asset.imageUrl}
            alt={asset.name}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {asset.type === 'character' && <User className="w-8 h-8 text-zinc-500" />}
            {asset.type === 'scene' && <ImageIcon className="w-8 h-8 text-zinc-500" />}
            {asset.type === 'prop' && <Box className="w-8 h-8 text-zinc-500" />}
          </div>
        )}

        {/* 悬浮查看历史提示 */}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <History className="w-6 h-6 text-white" />
        </div>

        {/* 状态指示 */}
        <div className="absolute top-1 right-1">
          {statusIcons[asset.status as keyof typeof statusIcons] || statusIcons.pending}
        </div>
      </div>
      
      <p className="text-sm font-medium text-white truncate text-center">{asset.name}</p>
      
      {onGenerate && (
        <Button
          size="sm"
          variant="outline"
          className="w-full border-zinc-600 text-zinc-300 hover:bg-zinc-700 text-xs"
          onClick={onGenerate}
        >
          <Wand2 className="w-3 h-3 mr-1" /> {asset.imageUrl ? '重刷' : '生成'}
        </Button>
      )}
    </div>
  );
}

function getAssetYamlPath(asset: Asset): string {
  if (asset.filePath) return asset.filePath;

  switch (asset.type) {
    case 'character':
      return `/asset_defs/chars/${asset.name}.yaml`;
    case 'scene':
      return `/asset_defs/scenes/${asset.name}.yaml`;
    case 'prop':
      return `/asset_defs/props/${asset.name}.yaml`;
    default:
      return '';
  }
}

export function ResourcePanel({ characters, scenes, props, projectId, readOnly = false, onShowTaskDialog }: ResourcePanelProps) {
  const [activeTab, setActiveTab] = useState('characters');
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [historyTasks, setHistoryTasks] = useState<any[]>([]);
  const [selectedHistoryUrl, setSelectedHistoryUrl] = useState<string | null>(null);

  const [pendingGeneration, setPendingGeneration] = useState<PendingGeneration | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { success: toastSuccess, error: toastError } = useToast();

  // 派生数据替代从 Store 读取
  const allAssets = [...characters, ...scenes, ...props];
  const completedCount = allAssets.filter(a => a.status === 'completed').length;
  const totalCount = allAssets.length;

  // 加载历史任务
  const loadHistory = useCallback(async (asset: Asset | null) => {
    if (!projectId || !asset) return;
    
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`);
      const data = await res.json();
      if (data.success) {
        // 过滤出与当前资产相关的任务
        const currentPath = getAssetYamlPath(asset);

        const filtered = data.tasks.filter((t: any) => {
          const taskPath = getTaskRefPath(t);
          return taskPath === currentPath || taskPath.endsWith(currentPath);
        });
        const normalized = filtered
          .map((task: any) => normalizeHistoryTask(projectId, task))
          .filter((task: any) => !!task.outputUrl);
        setHistoryTasks(normalized);
      }
    } catch (err) {
      console.error('[ResourcePanel] History load failed:', err);
    }
  }, [projectId]);

  // 查看历史记录
  const showHistory = (asset: Asset) => {
    setSelectedAsset(asset);
    setSelectedHistoryUrl(null);
    loadHistory(asset);
    setHistoryDialogOpen(true);
  };

  // 打开参数确认弹窗
  const openGenerationReview = (asset: Asset) => {
    const filePath = getAssetYamlPath(asset);

    const generation: PendingGeneration = {
      id: `asset-${asset.id}-${Date.now()}`,
      path: filePath,
      type: 'image',
      name: `${asset.type === 'character' ? '角色' : asset.type === 'scene' ? '场景' : '道具'}: ${asset.name}`,
      prompt: asset.description || '',
      params: {
        model: DEFAULT_MODELS.IMAGE,
        aspect_ratio: '1:1',
      },
      refs: undefined,
      timestamp: Date.now(),
    };

    setPendingGeneration(generation);
    setReviewDialogOpen(true);
  };

  // 执行生成
  const executeGeneration = async () => {
    if (!pendingGeneration) return;

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: pendingGeneration.type,
          status: 'submitted',
          ref: pendingGeneration.path,
          input: {
            ...pendingGeneration.params,
            prompt: pendingGeneration.prompt,
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        toastSuccess(`已启动 ${pendingGeneration.name} 的图片生成`);
        setReviewDialogOpen(false);
        setPendingGeneration(null);
        onShowTaskDialog?.();
      } else {
        toastError(`生成失败: ${result.error || '未知错误'}`);
      }
    } catch (error) {
      toastError(`请求失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 取消生成
  const cancelGeneration = () => {
    setReviewDialogOpen(false);
    setPendingGeneration(null);
  };

  // 批量生成
  const handleBatchGenerate = () => {
    const pendingAssets = allAssets.filter(a => a.status === 'pending' && !a.imageUrl);
    if (pendingAssets.length > 0) {
      openGenerationReview(pendingAssets[0]);
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-900 border-l border-zinc-800">
      {/* 标题栏 */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">资源库</h3>
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
            {completedCount}/{totalCount}
          </Badge>
        </div>
        <p className="text-xs text-zinc-500 mt-1">
          已生成 {completedCount} 个资源
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start rounded-none bg-zinc-900 border-b border-zinc-800 p-0 h-10 shrink-0">
          <TabsTrigger 
            value="characters" 
            className="flex-1 rounded-none data-[state=active]:bg-zinc-800 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500"
          >
            角色 ({characters.length})
          </TabsTrigger>
          <TabsTrigger 
            value="scenes"
            className="flex-1 rounded-none data-[state=active]:bg-zinc-800 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500"
          >
            场景 ({scenes.length})
          </TabsTrigger>
          <TabsTrigger 
            value="props"
            className="flex-1 rounded-none data-[state=active]:bg-zinc-800 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500"
          >
            道具 ({props.length})
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 relative">
          <TabsContent value="characters" className="absolute inset-0 m-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4">
                {characters.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-sm">暂无角色数据</div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {characters.map((char, index) => (
                      <AssetCard
                        key={`${char.id}-${index}`}
                        asset={char}
                        onGenerate={readOnly ? undefined : () => openGenerationReview(char)}
                        onShowHistory={() => showHistory(char)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="scenes" className="absolute inset-0 m-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4">
                {scenes.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-sm">暂无场景数据</div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {scenes.map((scene, index) => (
                      <AssetCard
                        key={`${scene.id}-${index}`}
                        asset={scene}
                        onGenerate={readOnly ? undefined : () => openGenerationReview(scene)}
                        onShowHistory={() => showHistory(scene)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="props" className="absolute inset-0 m-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4">
                {props.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-sm">暂无道具数据</div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {props.map((prop, index) => (
                      <AssetCard
                        key={`${prop.id}-${index}`}
                        asset={prop}
                        onGenerate={readOnly ? undefined : () => openGenerationReview(prop)}
                        onShowHistory={() => showHistory(prop)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>

      {!readOnly && (
        <div className="p-4 border-t border-zinc-800">
          <Button
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            disabled={allAssets.every(a => a.status === 'completed' || a.imageUrl)}
            onClick={handleBatchGenerate}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            批量生成剩余资源
          </Button>
        </div>
      )}

      {!readOnly && (
        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] p-0 bg-zinc-900 border-zinc-800 text-white overflow-hidden">
            <DialogTitle className="sr-only">{pendingGeneration?.name || '生成任务配置'}</DialogTitle>
            {pendingGeneration && (
              <div className="flex flex-col h-full max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
                  <h2 className="text-lg font-medium text-white">{pendingGeneration.name}</h2>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2"><Settings className="w-4 h-4" /> 生成参数</h3>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <label className="w-24 shrink-0 text-sm text-zinc-400 pt-2">提示词</label>
                      <textarea
                        className="flex-1 h-24 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-white resize-none focus:outline-none focus:border-indigo-500"
                        value={pendingGeneration.prompt}
                        onChange={(e) => setPendingGeneration({ ...pendingGeneration, prompt: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-4 items-center">
                      <label className="w-24 shrink-0 text-sm text-zinc-400">模型</label>
                      <select
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                        value={pendingGeneration.params.model as string}
                        onChange={(e) => setPendingGeneration({ ...pendingGeneration, params: { ...pendingGeneration.params, model: e.target.value } })}
                      >
                        {MODEL_OPTIONS.IMAGE.map(m => <option key={m.value} value={m.value as string}>{m.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="border-t border-zinc-800 px-6 py-4 flex justify-end gap-3 bg-zinc-950">
                  <Button variant="outline" className="border-zinc-700 text-zinc-300" onClick={cancelGeneration} disabled={isProcessing}>取消</Button>
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={executeGeneration} disabled={isProcessing}>
                    {isProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 生成中...</> : <><Wand2 className="w-4 h-4 mr-2" /> 确认生成</>}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* 历史记录查看弹窗 */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-4xl h-[80vh] bg-zinc-900 border-zinc-800 text-white flex flex-col p-0 overflow-hidden">
          <DialogTitle className="sr-only">资产历史记录 - {selectedAsset?.name}</DialogTitle>
          {selectedAsset && (
            <div className="flex flex-col h-full">
              <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-950 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-lg">
                    <History className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-medium">{selectedAsset.name}</h2>
                    <p className="text-xs text-zinc-500">生成历史记录</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* 预览区 */}
                <div className="flex-1 bg-zinc-950 p-6 flex flex-col gap-4">
                   <div className="flex-1 bg-zinc-900 rounded-xl overflow-hidden relative">
                      {selectedHistoryUrl || selectedAsset.imageUrl ? (
                        <img 
                          src={selectedHistoryUrl || selectedAsset.imageUrl || ''} 
                          className="w-full h-full object-contain"
                          key={selectedHistoryUrl || selectedAsset.imageUrl}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600">
                          <ImageIcon className="w-16 h-16 mb-2" />
                          <p>暂无素材</p>
                        </div>
                      )}
                      
                      {selectedHistoryUrl && (
                        <div className="absolute top-4 right-4 flex gap-2">
                          <Button
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700"
                            onClick={() => window.open(selectedHistoryUrl, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4 mr-1" /> 新窗口打开
                          </Button>
                        </div>
                      )}
                   </div>
                   
                   {/* 选中的参数详情 */}
                   {selectedHistoryUrl && (
                     <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
                       <h4 className="text-xs font-medium text-zinc-400 mb-2">生成参数</h4>
                       <div className="text-xs text-zinc-300 line-clamp-2">
                         {historyTasks.find(t => t.outputUrl === selectedHistoryUrl)?.params?.prompt}
                       </div>
                     </div>
                   )}
                </div>

                {/* 列表区 */}
                <div className="w-64 border-l border-zinc-800 flex flex-col">
                  <div className="p-3 border-b border-zinc-800 bg-zinc-900/50">
                    <span className="text-xs font-medium text-zinc-400">所有版本 ({historyTasks.length})</span>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-3 space-y-3">
                      {/* 当前版本 */}
                      {selectedAsset.imageUrl && (
                        <div 
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer ${!selectedHistoryUrl ? 'border-indigo-500' : 'border-zinc-800'}`}
                          onClick={() => setSelectedHistoryUrl(null)}
                        >
                          <img src={selectedAsset.imageUrl} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <span className="text-[10px] text-white">当前</span>
                          </div>
                        </div>
                      )}
                      {/* 历史记录 */}
                      {historyTasks.map((task: any) => (
                        <div 
                          key={task.id}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer ${selectedHistoryUrl === task.outputUrl ? 'border-indigo-500' : 'border-zinc-800'}`}
                          onClick={() => setSelectedHistoryUrl(task.outputUrl)}
                        >
                          <img src={task.outputUrl} className="w-full h-full object-cover" />
                          <div className="absolute bottom-1 right-1">
                            <CheckCircle2 className="w-3 h-3 text-green-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
