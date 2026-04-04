import { useState, useEffect, useCallback } from 'react';
import type { Asset, Storyboard } from '@core/schema';

interface UseVFSOptions {
  projectId: string;
}

interface UseVFSReturn {
  isLoading: boolean;
  error: string | null;
  assets: Asset[];
  storyboards: Storyboard[];
  reload: () => Promise<void>;
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
        setAssets(data.assets || []);
        setStoryboards(data.storyboards || []);
      } else {
        setError(data.error || 'Failed to load project snapshot');
      }
    } catch (e: any) {
      setError(e.message);
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
    reload: loadSnapshot
  };
}
