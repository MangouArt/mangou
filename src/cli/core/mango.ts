export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/**
 * Minimal project metadata used by the frontend.
 */
export interface Project {
  id: string
  name: string
  description?: string | null
  video_url?: string | null
  config: Json
  created_at: string
  updated_at: string
}

/**
 * Minimal asset metadata.
 */
export interface Asset {
  id: string
  project_id: string
  type: 'character' | 'scene' | 'prop'
  name: string
  description: string | null
  image_url: string | null
  metadata: Json
  version: string
  created_at: string
}

/**
 * Minimal storyboard metadata.
 */
export interface Storyboard {
  id: string
  project_id: string
  sequence_number: number
  content: string | null
  ai_prompt: string | null
  video_prompt: string | null
  image_url: string | null
  asset_ids: string[]
  metadata: Json
  created_at: string
}

export type AssetType = 'character' | 'scene' | 'prop'
export type GenerationType = 'text_to_image' | 'image_to_image' | 'text_to_video' | 'image_to_video' | 'frames_to_video' | 'video_to_video'

export type TabType = 'setup' | 'assets' | 'storyboard' | 'keyframes' | 'video'

// UI Extended Types (Compatibility)
export type UIAsset = Asset & { 
  _v?: number;
  status?: 'pending' | 'generating' | 'completed' | 'failed';
  image_url?: string;
}
export type UIStoryboard = Storyboard & { 
  _v?: number;
  status?: 'pending' | 'generating_image' | 'generating_video' | 'completed' | 'failed';
  sequenceNumber?: number;
  parentId?: string;
  grid?: string;
  image_url?: string;
  title?: string;
  prompt?: string;
}

export interface DrawerContent {
  type: 'queue' | 'asset' | 'storyboard' | 'history' | string
  data: any
}

// Keyframe & Video types for UI
export interface Keyframe {
  id: string
  storyboard_id: string
  url: string
  source_task_id: string | null
  is_selected: boolean
  created_at: string
}

export interface Video {
  id: string
  keyframe_id: string | null
  url: string
  source_task_id: string | null
  is_selected: boolean
  created_at: string
}
