export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          script: string | null
          video_url: string | null
          config: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          script?: string | null
          video_url?: string | null
          config?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          script?: string | null
          video_url?: string | null
          config?: Json
          created_at?: string
          updated_at?: string
        }
      }
      project_files: {
        Row: {
          id: string
          project_id: string
          path: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          path: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          path?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
      }
      assets: {
        Row: {
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
        Insert: {
          id?: string
          project_id: string
          type: 'character' | 'scene' | 'prop'
          name: string
          description?: string | null
          image_url?: string | null
          metadata?: Json
          version?: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          type?: 'character' | 'scene' | 'prop'
          name?: string
          description?: string | null
          image_url?: string | null
          metadata?: Json
          version?: string
          created_at?: string
        }
      }
      storyboards: {
        Row: {
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
        Insert: {
          id?: string
          project_id: string
          sequence_number: number
          content?: string | null
          ai_prompt?: string | null
          video_prompt?: string | null
          image_url?: string | null
          asset_ids?: string[]
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          sequence_number?: number
          content?: string | null
          ai_prompt?: string | null
          video_prompt?: string | null
          image_url?: string | null
          asset_ids?: string[]
          metadata?: Json
          created_at?: string
        }
      }
      generation_tasks: {
        Row: {
          id: string
          project_id: string
          yaml_path: string              // YAML 文件路径，如 /storyboards/001.yaml
          generation_type: 'image' | 'video'  // 生成类型
          type?: string                  // 兼容旧代码：任务具体子类型
          storyboard_id?: string | null  // 兼容旧代码
          input_params: Json            // 完整的 AIGC 参数（解析模板后的）
          status: 'pending_review' | 'submitted' | 'running' | 'completed' | 'failed' | 'processing' | 'pending'
          trigger_run_id: string | null
          provider: string | null
          provider_task_id: string | null
          output_url: string | null
          error_log: string | null
          created_at: string
          updated_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          yaml_path: string
          generation_type: 'image' | 'video'
          type?: string
          storyboard_id?: string | null
          input_params?: Json
          status?: 'pending_review' | 'submitted' | 'running' | 'completed' | 'failed' | 'processing' | 'pending'
          trigger_run_id?: string | null
          provider?: string | null
          provider_task_id?: string | null
          output_url?: string | null
          error_log?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          yaml_path?: string
          generation_type?: 'image' | 'video'
          type?: string
          storyboard_id?: string | null
          input_params?: Json
          status?: 'pending_review' | 'submitted' | 'running' | 'completed' | 'failed' | 'processing' | 'pending'
          trigger_run_id?: string | null
          provider?: string | null
          provider_task_id?: string | null
          output_url?: string | null
          error_log?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
      }
      keyframes: {
        Row: {
          id: string
          storyboard_id: string
          url: string
          source_task_id: string | null
          is_selected: boolean
          created_at: string
        }
        Insert: {
          id?: string
          storyboard_id: string
          url: string
          source_task_id?: string | null
          is_selected?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          storyboard_id?: string
          url?: string
          source_task_id?: string | null
          is_selected?: boolean
          created_at?: string
        }
      }
      videos: {
        Row: {
          id: string
          keyframe_id: string | null
          url: string
          source_task_id: string | null
          is_selected: boolean
          created_at: string
        }
        Insert: {
          id?: string
          keyframe_id?: string | null
          url: string
          source_task_id?: string | null
          is_selected?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          keyframe_id?: string | null
          url?: string
          source_task_id?: string | null
          is_selected?: boolean
          created_at?: string
        }
      }
    }
    Enums: {
      generation_type: 'text_to_image' | 'image_to_image' | 'text_to_video' | 'image_to_video' | 'frames_to_video' | 'video_to_video'
      asset_type: 'character' | 'scene' | 'prop'
    }
  }
}

// Business Entity Types
export type Project = Database['public']['Tables']['projects']['Row'];
export type Asset = Database['public']['Tables']['assets']['Row'];
export type Storyboard = Database['public']['Tables']['storyboards']['Row'];
export type Keyframe = Database['public']['Tables']['keyframes']['Row'];
export type Video = Database['public']['Tables']['videos']['Row'];
export type GenerationTask = Database['public']['Tables']['generation_tasks']['Row'];

export type AssetType = Database['public']['Enums']['asset_type'];
export type GenerationType = Database['public']['Enums']['generation_type'];

export type ProjectConfig = {
  storyboardCountLimit?: number;
  [key: string]: string | number | boolean | null | undefined | Record<string, unknown> | Json;
};

export type AssetMetadata = {
  prompt?: string;
  negative_prompt?: string;
  seed?: number;
  [key: string]: string | number | boolean | null | undefined | Record<string, unknown> | Json;
};

export type TabType = 'setup' | 'assets' | 'storyboard' | 'keyframes' | 'video';

// UI Extended Types
export type UIAsset = Asset & { _v?: number };
export type UIStoryboard = Storyboard & { _v?: number };

export interface DrawerContent {
  type: 'queue' | 'asset' | 'storyboard' | 'history' | string;
  data: any;
}
