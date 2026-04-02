import { create } from 'zustand';

export interface Asset {
  id: string;
  type: 'character' | 'scene' | 'prop';
  name: string;
  description: string;
  imageUrl?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  filePath?: string;
}

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
  filePath?: string;
  grid?: string;
  parentId?: string;
  tasks?: Record<string, unknown>;
}

interface ViewerState {
  selectedStoryboardId: string | null;
  setSelectedStoryboardId: (id: string | null) => void;
  reset: () => void;
}

const initialState = {
  selectedStoryboardId: null,
};

export const useDirectorAgentStore = create<ViewerState>()((set) => ({
  ...initialState,
  setSelectedStoryboardId: (selectedStoryboardId) => set({ selectedStoryboardId }),
  reset: () => set(initialState),
}));

export const selectCurrentStoryboard = (state: {
  storyboards: Storyboard[];
  selectedStoryboardId: string | null;
}) => state.storyboards.find((storyboard) => storyboard.id === state.selectedStoryboardId);

export const selectCharacters = (state: { assets: Asset[] }) =>
  state.assets.filter((asset) => asset.type === 'character');

export const selectScenes = (state: { assets: Asset[] }) =>
  state.assets.filter((asset) => asset.type === 'scene');

export const selectProps = (state: { assets: Asset[] }) =>
  state.assets.filter((asset) => asset.type === 'prop');
