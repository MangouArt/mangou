'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useDirectorAgentStore, Storyboard, Asset, PendingGeneration } from '@/stores/director-agent-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { GenerationCard } from './pending-generations-dialog';
import { useToast } from '@/components/ui/toast';
import { 
  ImageIcon, 
  Video, 
  Play,
  User,
  MapPin,
  Wand2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  History,
  ExternalLink
} from 'lucide-react';
import { MODEL_OPTIONS, DEFAULT_MODELS } from '@/lib/aigc-config';
import { getTaskRefPath, normalizeHistoryTask } from '@/lib/task-history';

interface StoryboardDetailProps {
  storyboard: Storyboard | undefined;
  assets: Asset[];
  projectId: string;
  readOnly?: boolean;
  onShowTaskDialog?: () => void; // 确认生成后跳转到任务管理弹窗
}

export function StoryboardDetail({ storyboard, assets, projectId, readOnly = false, onShowTaskDialog }: StoryboardDetailProps) {
  const [activeTab, setActiveTab] = useState('image');
  const [historyTasks, setHistoryTasks] = useState<any[]>([]);
  const [selectedHistoryUrl, setSelectedHistoryUrl] = useState<string | null>(null);

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [pendingGenerations, setPendingGenerations] = useState<PendingGeneration[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const { success: toastSuccess, error: toastError } = useToast();

  // 加载历史任务
  const loadHistory = useCallback(async () => {
    if (!projectId || !storyboard) return;
    
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`);
      const data = await res.json();
      if (data.success) {
        // 使用明确的 path 进行过滤
        const sbFile = (storyboard.filePath || '').toLowerCase();
        const sbId = (storyboard.id || '').toLowerCase();

        const filtered = data.tasks.filter((t: any) => {
          const taskPath = getTaskRefPath(t).toLowerCase();
          
          if (!taskPath) return false;

          // 1. 优先匹配明确的 filePath
          if (sbFile && (taskPath.includes(sbFile) || sbFile.includes(taskPath))) return true;
          // 2. 备选匹配 storyboard ID
          if (sbId && taskPath.includes(sbId)) return true;

          return false;
        });
        const normalized = filtered
          .map((task: any) => normalizeHistoryTask(projectId, task))
          .filter((task: any) => !!task.outputUrl);
        setHistoryTasks(normalized);
      }
    } catch (err) {
      console.error('[StoryboardDetail] History load failed:', err);
    }
  }, [projectId, storyboard]);

  useEffect(() => {
    loadHistory();
    setSelectedHistoryUrl(null); // 切换分镜时重置选中历史
  }, [loadHistory, activeTab]); // activeTab 变化时也刷新，确保计数准确

  // 筛选当前 Tab 的历史记录
  const currentTabHistory = useMemo(() => {
    return historyTasks
      .filter(t => t.type === activeTab && !!t.outputUrl)
      .map(t => ({
        ...t,
        displayUrl: t.outputUrl
      }));
  }, [historyTasks, activeTab]);

  // 当前显示的任务
  const pendingGeneration = pendingGenerations[currentIndex] || null;

  // 表单数据状态 - 用于受控表单
  const [formData, setFormData] = useState<PendingGeneration | null>(null);

  // 当 pendingGeneration 变化时，同步更新表单数据
  useEffect(() => {
    setFormData(pendingGeneration);
  }, [pendingGeneration]);

  // 获取关联的资产（基于 ID，兼容旧字段）
  const relatedAssets = useMemo(() => {
    if (!storyboard) return [];
    const refSet = new Set((storyboard.refAssetIds || []).filter(Boolean));
    return assets.filter(asset => refSet.has(asset.id));
  }, [storyboard, assets]);

  // 获取分镜支持的任务类型（从 YAML 解析得到的 tasks 对象）
  const taskTypes = useMemo(() => {
    // 强制包含 image 和 video
    const types = ['image', 'video'];
    
    // 如果有其他自定义任务，也加入
    if (storyboard?.tasks) {
      Object.keys(storyboard.tasks).forEach(type => {
        if (!types.includes(type)) types.push(type);
      });
    }

    // 添加历史记录入口
    // types.push('history');
    
    return types;
  }, [storyboard?.tasks]);

  useEffect(() => {
    if (!taskTypes.includes(activeTab)) {
      setActiveTab(taskTypes[0]);
    }
  }, [taskTypes, activeTab]);

  const openHistory = () => {
    setHistoryDialogOpen(true);
  };

  if (!storyboard) {
    return (
      <Card className="h-full bg-zinc-900 border-zinc-800">
        <CardContent className="flex items-center justify-center h-full">
          <p className="text-zinc-500">请选择一个分镜查看详情</p>
        </CardContent>
      </Card>
    );
  }

  // 显示图片生成审阅弹窗
  const handleGenerateImage = () => {
    if (!storyboard) return;
    const filePath = storyboard.filePath || `/storyboards/${String(storyboard.sequenceNumber).padStart(3, '0')}.yaml`;
    
    const generation: PendingGeneration = {
      id: `sb-${storyboard.sequenceNumber}-image-${Date.now()}`,
      path: filePath,
      type: 'image',
      name: `分镜 ${storyboard.sequenceNumber}: ${storyboard.title}`,
      prompt: storyboard.prompt,
      timestamp: Date.now(),
      params: {
        model: DEFAULT_MODELS.IMAGE,
        aspect_ratio: '16:9',
        path: filePath, // 冗余一份在 params 中，兼容旧逻辑
      },
    };
    const newIndex = pendingGenerations.length;
    setPendingGenerations(prev => [...prev, generation]);
    setCurrentIndex(newIndex);
    setReviewDialogOpen(true);
  };

  // 显示视频生成审阅弹窗
  const handleGenerateVideo = () => {
    if (!storyboard) return;
    const filePath = storyboard.filePath || `/storyboards/${String(storyboard.sequenceNumber).padStart(3, '0')}.yaml`;
    
    const generation: PendingGeneration = {
      id: `sb-${storyboard.sequenceNumber}-video-${Date.now()}`,
      path: filePath,
      type: 'video',
      name: `分镜 ${storyboard.sequenceNumber}: ${storyboard.title}`,
      prompt: storyboard.videoPrompt || storyboard.prompt,
      timestamp: Date.now(),
      params: {
        model: DEFAULT_MODELS.VIDEO,
        aspect_ratio: '16:9',
        duration: 4,
        path: filePath, // 冗余一份在 params 中，兼容旧逻辑
      },
    };
    const newIndex = pendingGenerations.length;
    setPendingGenerations(prev => [...prev, generation]);
    setCurrentIndex(newIndex);
    setReviewDialogOpen(true);
  };

  // 执行生成任务
  const executeGeneration = async () => {
    console.log('[StoryboardDetail] executeGeneration called, formData:', formData);
    // 使用 formData 而不是 pendingGeneration，确保提交的是用户修改后的数据
    if (!formData) {
      console.log('[StoryboardDetail] No form data, returning');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('[StoryboardDetail] Calling API with:', {
        projectId,
        path: formData.path,
        type: formData.type,
      });
      const response = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.type,
          status: 'submitted',
          ref: formData.path,
          input: {
            ...formData.params,
            prompt: formData.prompt,
          },
        }),
      });
      console.log('[StoryboardDetail] API response status:', response.status);

      const result = await response.json();

      if (result.success) {
        toastSuccess(`已启动 ${formData.name} 的${formData.type === 'video' ? '视频' : '图片'}生成`);
        // 从队列中移除当前任务
        removeCurrentGeneration();

        // 跳转到任务管理弹窗（SPEC P1-3 约束）
        onShowTaskDialog?.();
        
        // 刷新历史
        loadHistory();
      } else {
        toastError(`生成失败: ${result.error}`);
      }
    } catch (error) {
      console.error('Generation error:', error);
      toastError('生成失败，请检查网络连接后重试');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // 从队列中移除当前任务
  const removeCurrentGeneration = () => {
    setPendingGenerations(prev => {
      const newList = prev.filter((_, i) => i !== currentIndex);
      if (newList.length === 0) {
        setReviewDialogOpen(false);
        setCurrentIndex(0);
      } else if (currentIndex >= newList.length) {
        setCurrentIndex(newList.length - 1);
      }
      return newList;
    });
  };

  // 取消生成
  const cancelGeneration = () => {
    setReviewDialogOpen(false);
  };

  return (
    <Card className="h-full bg-zinc-900 border-zinc-800 flex flex-col">
      <CardContent className="flex-1 p-4 flex flex-col gap-4 overflow-hidden">
        {/* 原剧本 */}
        <div className="shrink-0">
          <h3 className="text-sm font-medium text-zinc-400 mb-1">原剧本</h3>
          <p className="text-sm text-zinc-300 leading-relaxed">
            {storyboard.script || storyboard.description || ''}
          </p>
        </div>

        {/* 参考资产 */}
        {relatedAssets.length > 0 && (
          <div className="shrink-0">
            <h3 className="text-sm font-medium text-zinc-400 mb-2">参考资产</h3>
            <div className="flex gap-2 flex-wrap">
              {relatedAssets.map(asset => (
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2 bg-zinc-800 p-1 rounded-lg shrink-0">
            <TabsList className="flex-1 grid bg-transparent border-none p-0" style={{ gridTemplateColumns: `repeat(${taskTypes.length}, minmax(0, 1fr))` }}>
              {taskTypes.map(type => (
                <TabsTrigger key={type} value={type} className="data-[state=active]:bg-zinc-700 h-8">
                  {type === 'image' ? <ImageIcon className="w-4 h-4 mr-1.5" /> : 
                  type === 'video' ? <Video className="w-4 h-4 mr-1.5" /> : 
                  <Wand2 className="w-4 h-4 mr-1.5" />}
                  {type === 'image' ? '分镜图' : type === 'video' ? '分镜视频' : type}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="w-[1px] h-4 bg-zinc-700 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
              onClick={openHistory}
            >
              <History className="w-4 h-4 text-amber-400" />
              <span>历史记录</span>
              {currentTabHistory.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-zinc-900 text-[10px] font-bold text-amber-400">
                  {currentTabHistory.length}
                </span>
              )}
            </Button>
          </div>

          {/* 分镜图 Tab */}
          <TabsContent value="image" className="flex-1 flex flex-col min-h-0 mt-4 overflow-hidden">
            <div className="flex-1 bg-zinc-800 rounded-lg overflow-hidden relative group">
              {selectedHistoryUrl || storyboard.imageUrl ? (
                <img
                  src={selectedHistoryUrl || storyboard.imageUrl || ''}
                  alt={storyboard.title}
                  className="w-full h-full object-contain"
                  key={selectedHistoryUrl || storyboard.imageUrl}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                  <ImageIcon className="w-12 h-12 text-zinc-600" />
                  <span className="text-xs text-zinc-500">暂无图片</span>
                </div>
              )}
            </div>

            {!readOnly && (
              <div className="mt-4 shrink-0 flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-indigo-400 h-12 text-lg font-bold"
                  onClick={handleGenerateImage}
                  disabled={!storyboard.prompt}
                >
                  <Wand2 className="w-5 h-5 mr-2" />
                  {storyboard.imageUrl ? '修改图片' : '生成图片'}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* 分镜视频 Tab */}
          <TabsContent value="video" className="flex-1 flex flex-col min-h-0 mt-4 overflow-hidden">
            <div className="flex-1 bg-zinc-800 rounded-lg overflow-hidden relative group">
              {selectedHistoryUrl || storyboard.videoUrl ? (
                <video
                  src={selectedHistoryUrl || storyboard.videoUrl || ''}
                  controls
                  className="w-full h-full object-contain"
                  key={selectedHistoryUrl || storyboard.videoUrl}
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

            {!readOnly && (
              <div className="mt-4 shrink-0 flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-purple-400 h-12 text-lg font-bold"
                  onClick={handleGenerateVideo}
                  disabled={!storyboard.imageUrl}
                >
                  <Wand2 className="w-5 h-5 mr-2" />
                  {storyboard.videoUrl ? '修改视频' : '生成视频'}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* 历史记录弹窗 */}
        <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
          <DialogContent className="max-w-4xl w-[90vw] max-h-[85vh] bg-zinc-900 border-zinc-800 text-white flex flex-col p-0 overflow-hidden">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <History className="w-6 h-6 text-amber-400" />
                {activeTab === 'image' ? '分镜图历史记录' : '分镜视频历史记录'}
              </DialogTitle>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {currentTabHistory.length === 0 ? (
                <div className="py-20 text-center">
                  <History className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
                  <p className="text-zinc-500">暂无生成记录</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {currentTabHistory
                    .sort((a, b) => new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime())
                    .map((task: any) => {
                      const url = task.displayUrl;
                      const isCurrent = (activeTab === 'image' && url === storyboard.imageUrl) || 
                                       (activeTab === 'video' && url === storyboard.videoUrl);
                      const isSelected = selectedHistoryUrl === url || (!selectedHistoryUrl && isCurrent);
                      
                      return (
                        <Card 
                          key={task.id} 
                          className={cn(
                            "bg-zinc-800 border-zinc-700 overflow-hidden hover:border-indigo-500 transition-all cursor-pointer group/item relative",
                            isSelected && "border-indigo-500 ring-2 ring-indigo-500/50"
                          )}
                          onClick={() => {
                            setSelectedHistoryUrl(isCurrent ? null : url);
                            setHistoryDialogOpen(false);
                          }}
                        >
                          <div className="aspect-video bg-black relative">
                            {activeTab === 'video' ? (
                              <video src={url} className="w-full h-full object-cover" />
                            ) : (
                              <img src={url} className="w-full h-full object-cover" />
                            )}
                            
                            {isCurrent && (
                              <div className="absolute top-2 right-2 bg-indigo-600 text-[10px] px-2 py-0.5 rounded-full font-bold shadow-lg">
                                当前版本
                              </div>
                            )}
                            
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/item:opacity-100 flex items-center justify-center transition-opacity">
                              <div className="flex flex-col items-center gap-2">
                                <ExternalLink className="w-6 h-6 text-white" />
                                <span className="text-xs text-white font-medium">查看此版本</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="p-3 bg-zinc-800/50">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-[10px] text-zinc-400 font-medium">
                                {new Date(task.created_at || task.createdAt).toLocaleString('zh-CN')}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-300 line-clamp-2 italic leading-relaxed">
                              {task.params?.prompt || '无提示词信息'}
                            </p>
                          </div>
                        </Card>
                      );
                    })}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex justify-end">
              <Button variant="ghost" onClick={() => setHistoryDialogOpen(false)} className="text-zinc-400">
                关闭
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {!readOnly && (
          <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
            <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] max-h-[95vh] p-0 bg-zinc-900 border-zinc-800 text-white overflow-hidden">
              <DialogTitle className="sr-only">
                {pendingGeneration?.name || '生成任务配置'}
              </DialogTitle>
              {pendingGeneration && (
                <div className="flex flex-col h-full">
                {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-zinc-400 hover:text-white h-8 w-8"
                          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                          disabled={currentIndex === 0}
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-zinc-400 hover:text-white h-8 w-8"
                          onClick={() => setCurrentIndex(prev => Math.min(pendingGenerations.length - 1, prev + 1))}
                          disabled={currentIndex >= pendingGenerations.length - 1}
                        >
                          <ChevronRight className="w-5 h-5" />
                        </Button>
                      </div>
                      <h2 className="text-lg font-medium text-white">
                        {pendingGeneration.name}
                      </h2>
                      <span className="text-sm text-zinc-500">
                        {currentIndex + 1}/{pendingGenerations.length}
                      </span>
                    </div>
                  </div>

                {/* 主内容区：表单式布局 */}
                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-4xl mx-auto space-y-6">
                    {/* 参考资源区域（可折叠） */}
                      {pendingGeneration.refs && (
                        (pendingGeneration.refs.images?.length ?? 0) > 0 ||
                        (pendingGeneration.refs.videos?.length ?? 0) > 0
                      ) && (
                        <div className="bg-zinc-800/50 rounded-lg p-4">
                          <details className="group" open>
                            <summary className="flex items-center justify-between cursor-pointer text-sm font-medium text-zinc-300">
                              <span>参考资源</span>
                              <span className="text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
                            </summary>
                            <div className="mt-4 flex flex-wrap gap-3">
                              {pendingGeneration.refs.images?.map((url, index) => (
                                <div key={`img-${index}`} className="w-32 h-24 bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
                                  <img src={url} alt={`参考图片 ${index + 1}`} className="w-full h-full object-cover" />
                                </div>
                              ))}
                              {pendingGeneration.refs.videos?.map((url, index) => (
                                <div key={`vid-${index}`} className="w-32 h-24 bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
                                  <video src={url} className="w-full h-full object-cover" />
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      )}

                    {/* 分隔线 */}
                    <div className="border-t border-zinc-800" />

                    {/* 请求参数表单 */}
                    <div>
                      <h3 className="text-sm font-medium text-zinc-300 mb-4">请求参数</h3>
                      <div className="space-y-4">
                        {/* prompt - 始终显示 */}
                        <div className="flex gap-4">
                          <label className="w-32 shrink-0 text-sm text-zinc-400 pt-2">prompt</label>
                          <textarea
                            className="flex-1 h-24 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-white placeholder:text-zinc-500 resize-none focus:outline-none focus:border-indigo-500"
                            value={formData?.prompt || ''}
                            onChange={(e) => setFormData(prev => prev ? { ...prev, prompt: e.target.value } : null)}
                            placeholder="输入提示词..."
                          />
                        </div>

                        {/* 动态渲染 params 中存在的参数 */}
                        {Object.entries(pendingGeneration.params).map(([key, value]) => {
                          // 跳过已处理的 prompt（它单独显示）
                          if (key === 'prompt') return null;
                          
                          // 根据参数类型和名称决定渲染方式
                          const renderParamField = () => {
                            // 多行文本参数 (negative_prompt, negativePrompt)
                            if (key === 'negative_prompt' || key === 'negativePrompt') {
                              return (
                                <textarea
                                  className="flex-1 h-16 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-white placeholder:text-zinc-500 resize-none focus:outline-none focus:border-indigo-500"
                                  defaultValue={value as string}
                                  placeholder={`输入 ${key}...`}
                                />
                              );
                            }
                            
                            // model 下拉选择 - 使用集中配置
                            if (key === 'model') {
                              const models = pendingGeneration.type === 'video' 
                                ? MODEL_OPTIONS.VIDEO 
                                : MODEL_OPTIONS.IMAGE;
                              
                              return (
                                <select 
                                  className="flex-1 max-w-xs bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
                                  defaultValue={value as string}
                                >
                                  {models.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                  ))}
                                </select>
                              );
                            }
                            
                            // aspect_ratio 下拉选择
                            if (key === 'aspect_ratio' || key === 'aspectRatio') {
                              const ratios = ['16:9', '9:16', '1:1', '4:3', '3:4', '2:3', '3:2', '21:9'];
                              return (
                                <select 
                                  className="flex-1 max-w-xs bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
                                  defaultValue={value as string}
                                >
                                  {ratios.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                              );
                            }
                            
                            // image_size 下拉选择 (图片特有)
                            if (key === 'image_size' || key === 'imageSize') {
                              return (
                                <select 
                                  className="flex-1 max-w-xs bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
                                  defaultValue={value as string}
                                >
                                  <option value="1K">1K</option>
                                  <option value="2K">2K</option>
                                  <option value="4K">4K</option>
                                </select>
                              );
                            }
                            
                            // duration 下拉选择 (视频特有)
                            if (key === 'duration') {
                              return (
                                <select 
                                  className="flex-1 max-w-xs bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
                                  defaultValue={value as number}
                                >
                                  <option value={4}>4秒</option>
                                  <option value={8}>8秒</option>
                                  <option value={10}>10秒</option>
                                </select>
                              );
                            }
                            
                            // n (生成数量)
                            if (key === 'n') {
                              return (
                                <select 
                                  className="flex-1 max-w-xs bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
                                  defaultValue={value as number}
                                >
                                  <option value={1}>1</option>
                                  <option value={2}>2</option>
                                  <option value={4}>4</option>
                                </select>
                              );
                            }
                            
                            // watermark 布尔值 (视频特有)
                            if (key === 'watermark') {
                              const boolValue = Boolean(value);
                              return (
                                <div className="flex items-center gap-4">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={key}
                                      value="false"
                                      defaultChecked={!boolValue}
                                      className="w-4 h-4 accent-indigo-500"
                                    />
                                    <span className="text-sm text-zinc-300">关闭</span>
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={key}
                                      value="true"
                                      defaultChecked={boolValue}
                                      className="w-4 h-4 accent-indigo-500"
                                    />
                                    <span className="text-sm text-zinc-300">开启</span>
                                  </label>
                                </div>
                              );
                            }
                            
                            // 数字类型参数
                            if (typeof value === 'number') {
                              return (
                                <input
                                  type="number"
                                  className="flex-1 max-w-xs bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
                                  defaultValue={value}
                                />
                              );
                            }
                            
                            // 布尔类型参数
                            if (typeof value === 'boolean') {
                              return (
                                <div className="flex items-center gap-4">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={key}
                                      value="false"
                                      defaultChecked={!value}
                                      className="w-4 h-4 accent-indigo-500"
                                    />
                                    <span className="text-sm text-zinc-300">false</span>
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={key}
                                      value="true"
                                      defaultChecked={value}
                                      className="w-4 h-4 accent-indigo-500"
                                    />
                                    <span className="text-sm text-zinc-300">true</span>
                                  </label>
                                </div>
                              );
                            }
                            
                            // 默认文本输入
                            return (
                              <input
                                type="text"
                                className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
                                defaultValue={value as string}
                              />
                            );
                          };
                          
                          return (
                            <div key={key} className="flex gap-4 items-start">
                              <label className="w-32 shrink-0 text-sm text-zinc-400 pt-2">{key}</label>
                              <div className="flex-1">
                                {renderParamField()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 底部按钮 */}
                    <div className="border-t border-zinc-800 pt-6 flex justify-end gap-3">
                      <Button
                        variant="outline"
                        className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                        onClick={cancelGeneration}
                        disabled={isProcessing}
                      >
                        取消
                      </Button>
                      <Button
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        onClick={executeGeneration}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            生成中...
                          </>
                        ) : (
                          '确认生成'
                        )}
                      </Button>
                    </div>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
