import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 工作模式：半自动（需要确认）或全自动
export type DirectorMode = 'semi' | 'auto';

// 制作阶段
export type ProductionStage =
  | 'intake'      // 接收剧本
  | 'planning'    // 规划阶段（解析剧本）
  | 'assets'      // 生成资产
  | 'storyboards' // 生成分镜
  | 'videos'      // 生成视频
  | 'completed';  // 完成

// 资产类型
export interface Asset {
  id: string;
  type: 'character' | 'scene' | 'prop';
  name: string;
  description: string;
  imageUrl?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  filePath?: string; // VFS 文件路径，如 /characters/李明.yaml
}

// 分镜
export interface Storyboard {
  id: string;
  sequenceNumber: number;
  title: string;
  description: string;
  script?: string;
  prompt: string;
  videoPrompt?: string;
  imageUrl?: string;
  videoUrl?: string;
  status: 'pending' | 'generating_image' | 'generating_video' | 'completed' | 'failed';
  refAssetIds?: string[];
  filePath?: string; // VFS 文件路径，如 /storyboards/001.yaml
  tasks?: Record<string, any>;
}

// 任务进度
export interface TaskProgress {
  stage: ProductionStage;
  completed: number;
  total: number;
  status: 'idle' | 'running' | 'completed' | 'failed';
}

// Agent 状态
interface DirectorAgentState {
  // 工作模式
  mode: DirectorMode;
  setMode: (mode: DirectorMode) => void;

  // 当前阶段
  currentStage: ProductionStage;
  setCurrentStage: (stage: ProductionStage) => void;

  // 项目数据
  projectId: string | null;
  script: string;
  setProjectId: (id: string) => void;
  setScript: (script: string) => void;

  // 选中分镜 (UI 状态)
  selectedStoryboardId: string | null;
  setSelectedStoryboardId: (id: string | null) => void;

  // 进度
  progress: TaskProgress;
  updateProgress: (progress: Partial<TaskProgress>) => void;

  // Agent 消息 - 按项目存储 Map<projectId, messages[]>
  agentMessages: Map<string, AgentMessage[]>;
  setAgentMessages: (projectId: string, messages: AgentMessage[]) => void;
  addAgentMessage: (projectId: string, message: AgentMessage) => void;
  updateAgentMessage: (projectId: string, id: string, updates: Partial<AgentMessage>) => void;
  clearAgentMessages: (projectId: string) => void;
  resetAgentMessages: () => void;

  // 待确认的生成任务（半自动模式）
  pendingGenerations: PendingGeneration[];
  setPendingGenerations: (generations: PendingGeneration[]) => void;
  addPendingGeneration: (generation: PendingGeneration) => void;
  removePendingGeneration: (id: string) => void;
  clearPendingGenerations: () => void;

  // 运行状态
  isRunning: boolean;
  isPaused: boolean;
  setRunning: (running: boolean) => void;
  setPaused: (paused: boolean) => void;

  // 错误
  error: string | null;
  setError: (error: string | null) => void;

  // 重置
  reset: () => void;
}

// 工具调用状态
export type ToolCallStatus = 'pending' | 'running' | 'success' | 'error';

// 工具调用记录
export interface ToolCall {
  id: string;
  name: string;
  params: Record<string, unknown>;
  status: ToolCallStatus;
  result?: unknown;
  error?: string;
  startTime: Date;
  endTime?: Date;
}

// Agent 消息
export interface AgentMessage {
  id: string;
  role: 'user' | 'agent' | 'system' | 'tool_call';
  content: string;
  timestamp: Date;
  type?: 'info' | 'success' | 'warning' | 'error' | 'progress';
  metadata?: Record<string, unknown>;
  // 工具调用相关
  toolCall?: ToolCall;
}

// 待确认的生成任务
export interface PendingGeneration {
  id: string;
  path: string;  // VFS YAML 文件路径，如 /storyboards/001.yaml 或 /characters/李明.yaml
  type: 'image' | 'video';
  name: string;
  prompt: string;
  timestamp: number;
  // 动态生成参数，直接透传给 AIGC 接口
  params: Record<string, unknown>;
  // 关联资源引用
  refs?: {
    images?: string[];  // 参考图片 URLs
    videos?: string[];  // 参考视频 URLs
    [key: string]: unknown;  // 其他引用
  };
}

// 初始状态
const initialState = {
  mode: 'semi' as DirectorMode,
  currentStage: 'intake' as ProductionStage,
  projectId: null,
  script: '',
  selectedStoryboardId: null,
  progress: {
    stage: 'intake' as ProductionStage,
    completed: 0,
    total: 0,
    status: 'idle' as const,
  },
  agentMessages: new Map<string, AgentMessage[]>(),
  pendingGenerations: [] as PendingGeneration[],
  isRunning: false,
  isPaused: false,
  error: null,
};

export const useDirectorAgentStore = create<DirectorAgentState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // 模式
      setMode: (mode) => set({ mode }),

      // 阶段
      setCurrentStage: (currentStage) => set({ currentStage }),

      // 项目
      setProjectId: (projectId) => set({ projectId }),
      setScript: (script) => set({ script }),

      // 选中分镜
      setSelectedStoryboardId: (selectedStoryboardId) =>
        set({ selectedStoryboardId }),

      // 进度
      updateProgress: (progress) =>
        set((state) => ({
          progress: { ...state.progress, ...progress },
        })),

      // Agent 消息 - 按项目存储
      setAgentMessages: (projectId, messages) =>
        set((state) => {
          const newMap = new Map(state.agentMessages);
          newMap.set(projectId, messages);
          return { agentMessages: newMap };
        }),
      addAgentMessage: (projectId, message) =>
        set((state) => {
          const newMap = new Map(state.agentMessages);
          const existing = newMap.get(projectId) || [];
          newMap.set(projectId, [...existing, message]);
          return { agentMessages: newMap };
        }),
      updateAgentMessage: (projectId, id, updates) =>
        set((state) => {
          const newMap = new Map(state.agentMessages);
          const existing = newMap.get(projectId) || [];
          newMap.set(
            projectId,
            existing.map((m) => (m.id === id ? { ...m, ...updates } : m))
          );
          return { agentMessages: newMap };
        }),
      clearAgentMessages: (projectId) =>
        set((state) => {
          const newMap = new Map(state.agentMessages);
          newMap.set(projectId, []);
          return { agentMessages: newMap };
        }),
      resetAgentMessages: () => set({ agentMessages: new Map() }),

      // 待确认生成任务（半自动模式）
      setPendingGenerations: (pendingGenerations) => set({ pendingGenerations }),
      addPendingGeneration: (generation) =>
        set((state) => ({
          pendingGenerations: [...state.pendingGenerations, generation],
        })),
      removePendingGeneration: (id) =>
        set((state) => ({
          pendingGenerations: state.pendingGenerations.filter((g) => g.id !== id),
        })),
      clearPendingGenerations: () => set({ pendingGenerations: [] }),

      // 运行状态
      setRunning: (isRunning) => set({ isRunning }),
      setPaused: (isPaused) => set({ isPaused }),

      // 错误
      setError: (error) => set({ error }),

      // 重置
      reset: () => set(initialState),
    }),
    {
      name: 'director-agent-storage',
      partialize: (state) => ({
        mode: state.mode,
        projectId: state.projectId,
        script: state.script,
        currentStage: state.currentStage,
        // 将 Map 转换为数组以便持久化
        agentMessages: Array.from(state.agentMessages.entries()),
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      merge: (persistedState: any, currentState) => {
        // 将数组转换回 Map
        if (persistedState.agentMessages && Array.isArray(persistedState.agentMessages)) {
          persistedState.agentMessages = new Map(persistedState.agentMessages);
        }
        return {
          ...currentState,
          ...persistedState,
        };
      },
    }
  )
);

// 通用选择器 - 支持从任何包含 assets/storyboards 的对象中提取数据
export const selectCurrentStoryboard = (state: { storyboards: Storyboard[]; selectedStoryboardId: string | null }) =>
  state.storyboards.find((s) => s.id === state.selectedStoryboardId);

export const selectCharacters = (state: { assets: Asset[] }) =>
  state.assets.filter((a) => a.type === 'character');

export const selectScenes = (state: { assets: Asset[] }) =>
  state.assets.filter((a) => a.type === 'scene');

export const selectProps = (state: { assets: Asset[] }) =>
  state.assets.filter((a) => a.type === 'prop');

export const selectCompletedAssets = (state: { assets: Asset[] }) =>
  state.assets.filter((a) => a.status === 'completed');

export const selectCompletedStoryboards = (state: { storyboards: Storyboard[] }) =>
  state.storyboards.filter((s) => s.status === 'completed');

export const selectOverallProgress = (state: { assets: Asset[]; storyboards: Storyboard[] }) => {
  const totalAssets = state.assets.length;
  const completedAssets = state.assets.filter(
    (a) => a.status === 'completed'
  ).length;
  const totalStoryboards = state.storyboards.length;
  const completedStoryboards = state.storyboards.filter(
    (s) => s.status === 'completed'
  ).length;

  const total = totalAssets + totalStoryboards;
  const completed = completedAssets + completedStoryboards;

  return {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
};

// 获取特定项目的消息
export const selectAgentMessagesByProjectId = (projectId: string | null) => (state: DirectorAgentState): AgentMessage[] => {
  if (!projectId) return [];
  return state.agentMessages.get(projectId) || [];
};
