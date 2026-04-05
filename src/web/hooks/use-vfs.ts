import { useState, useEffect, useCallback } from 'react';
import type { Asset as CoreAsset, Storyboard as CoreStoryboard } from '@core/schema';
import type { Asset, Storyboard } from '@web/stores/director-agent-store';

interface UseVFSOptions {
  projectId: string;
  autoSync?: boolean;
}

interface UseVFSReturn {
  isLoading: boolean;
  error: string | null;
  assets: Asset[];
  storyboards: Storyboard[];
  reload: () => Promise<void>;
  exportData: () => {
    assets: Asset[];
    storyboards: Storyboard[];
  };
}

function normalizeAsset(asset: CoreAsset): Asset {
  return {
    id: asset.id,
    type: asset.type,
    name: asset.name,
    description: asset.description,
    imageUrl: asset.image_url,
    image_url: asset.image_url,
    status: asset.status,
  };
}

function normalizeStoryboard(storyboard: CoreStoryboard): Storyboard {
  return {
    id: storyboard.id,
    sequenceNumber: storyboard.sequence_number,
    title: storyboard.title,
    description: storyboard.description,
    prompt: storyboard.prompt,
    imageUrl: storyboard.image_url,
    image_url: storyboard.image_url,
    videoUrl: storyboard.video_url,
    status: storyboard.status,
    refAssetIds: storyboard.asset_ids,
    grid: storyboard.grid || undefined,
    parentId: storyboard.parentId || undefined,
    tasks: storyboard.tasks,
  };
}

export function useVFS({ projectId }: UseVFSOptions): UseVFSReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);

  /**
   * Initial load: fetch the structured UI snapshot
   */
  const loadSnapshot = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/snapshot`);
      const data = await res.json();
      if (data.success) {
        setAssets((data.assets || []).map(normalizeAsset));
        setStoryboards((data.storyboards || []).map(normalizeStoryboard));
        setError(null);
      } else {
        setError(data.error || 'Failed to load project snapshot');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  /**
   * Listen for real-time updates via SSE
   */
  useEffect(() => {
    if (!projectId) return;

    loadSnapshot();

    const es = new EventSource(`/api/events?projectId=${projectId}`);
    
    es.addEventListener('file_change', (event: any) => {
      // In a real mirror, any file change in the project triggers a snapshot refresh
      // For performance, we could only reload if it's a YAML relevant to UI
      loadSnapshot();
    });

    es.onerror = () => {
      // setError('Connection to server lost.');
    };

    return () => es.close();
  }, [projectId, loadSnapshot]);

  return {
    isLoading,
    error,
    assets,
    storyboards,
    reload: loadSnapshot,
    exportData: () => ({ assets, storyboards }),
  };
}
