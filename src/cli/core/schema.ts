export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/**
 * Core Domain Models - Clean YAML Source Representations
 */
export interface Project {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface Asset {
  id: string
  project_id: string
  type: 'character' | 'scene' | 'prop'
  name: string
  description: string | null
  image_url: string | null
  status: 'pending' | 'generating' | 'completed' | 'failed'
  version: string
  metadata: Record<string, any>
  created_at: string
}

export interface Storyboard {
  id: string
  project_id: string
  sequence_number: number
  title: string
  description: string | null
  prompt: string | null
  image_url: string | null
  video_url: string | null
  status: 'pending' | 'generating_image' | 'generating_video' | 'completed' | 'failed'
  asset_ids: string[]
  grid: string | null
  parentId: string | null
  tasks: Record<string, any>
  metadata: Record<string, any>
  created_at: string
}

export interface Keyframe {
  id: string
  storyboard_id: string | null
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
