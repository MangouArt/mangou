import { useQuery } from '@tanstack/react-query'
import { 
  Asset, 
  Storyboard, 
  Keyframe, 
  Video as VideoAsset,
} from '@core/schema'

export interface LocalProject {
  id: string
  name: string
  description?: string
  video_url?: string | null
  created_at: string
  updated_at: string
  createdAt?: string
  updatedAt?: string
}

/**
 * 独立版项目状态管理 Hook (Pure Local API Mode)
 * 不再依赖 Supabase Realtime，改为简单轮询
 */

export const fetchProjects = async (): Promise<LocalProject[]> => {
  const res = await fetch('/api/projects?t=' + Date.now())
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Failed to fetch projects')
  return (data.projects || []).map((project: LocalProject) => ({
    ...project,
    createdAt: project.createdAt || project.created_at,
    updatedAt: project.updatedAt || project.updated_at,
  }))
}

export interface ProjectData {
  project: LocalProject
  assets: Asset[]
  storyboards: Storyboard[]
  keyframes: Keyframe[]
  videos: VideoAsset[]
}

export const fetchProjectData = async (projectId: string): Promise<ProjectData> => {
  if (!projectId) throw new Error('Project ID is required')
  const res = await fetch(`/api/projects/${projectId}?t=` + Date.now())
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Failed to fetch project data')
  
  return {
    project: {
      ...data.project,
      createdAt: data.project?.createdAt || data.project?.created_at,
      updatedAt: data.project?.updatedAt || data.project?.updated_at,
    },
    assets: data.assets || [],
    storyboards: data.storyboards || [],
    keyframes: data.keyframes || [],
    videos: data.videos || []
  }
}

// --- Hooks ---

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    refetchInterval: 10000, // 每10秒自动刷新一次列表
  })
}

export function useProjectDetails(projectId: string) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => fetchProjectData(projectId),
    enabled: !!projectId,
    staleTime: 5000,
  })
}
