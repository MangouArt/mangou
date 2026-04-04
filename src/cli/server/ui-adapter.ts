import { parseYAMLQuiet } from '../core/vfs/yaml';
import type { Asset, Storyboard } from '../core/schema';
import type { AgentToolContext } from '../core/vfs/types';

export function exportToExistingData(context: AgentToolContext) {
  const { vfs, projectId } = context;
  const assets: Asset[] = [];
  const storyboards: Storyboard[] = [];

  const resolveVfsUrl = (vfsPath: string | undefined) => {
    if (!vfsPath) return null;
    let trimmed = vfsPath.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/api/')) return trimmed;
    const normalized = trimmed.startsWith('/') || trimmed.startsWith('./')
      ? trimmed
      : `./${trimmed}`;
    return `/api/vfs?projectId=${projectId}&path=${encodeURIComponent(normalized)}`;
  };

  // 1. Export Assets
  const assetTypes = ['chars', 'scenes', 'props'];
  for (const type of assetTypes) {
    const dir = `/asset_defs/${type}`;
    if (vfs.exists(dir)) {
      const files = vfs.listDirectory(dir);
      for (const file of files) {
        if (file.type === 'file' && file.name.endsWith('.yaml')) {
          const normalizedPath = `${dir}/${file.name}`;
          try {
            const content = vfs.getFileContent(normalizedPath);
            if (!content) continue;
            const data = parseYAMLQuiet(content) as any;
            if (!data) continue;
            
            const meta = data.meta || {};
            const assetContent = data.content || {};
            const tasks = data.tasks || {};
            const fallbackId = file.name.replace('.yaml', '');

            assets.push({
              id: meta?.id || fallbackId,
              project_id: projectId,
              type: (type === 'chars' ? 'character' : type === 'scenes' ? 'scene' : 'prop') as Asset['type'],
              name: assetContent?.name || fallbackId,
              description: assetContent?.description || null,
              status: (tasks?.image?.latest?.status || 'pending') as Asset['status'],
              image_url: resolveVfsUrl(tasks?.image?.latest?.output),
              version: meta?.version || '1.0',
              metadata: meta || {},
              created_at: new Date().toISOString(),
            });
          } catch (e) {
             console.error(`[UI Adapter Asset Error] ${normalizedPath}:`, e);
          }
        }
      }
    }
  }

  // 2. Export Storyboards
  if (vfs.exists('/storyboards')) {
    const files = vfs.listDirectory('/storyboards');
    for (const file of files) {
      if (file.type === 'file' && file.name.endsWith('.yaml')) {
        const path = `/storyboards/${file.name}`;
        const content = vfs.getFileContent(path);
        if (!content) continue;

        try {
          const data = parseYAMLQuiet(content) as any;
          if (!data) continue;
          
          const { meta, content: sbContent, tasks } = data;
          const fallbackId = file.name.replace('.yaml', '');
          const imageTask = tasks?.image;
          const videoTask = tasks?.video;

          let status: Storyboard['status'] = 'pending';
          if (videoTask?.latest?.status === 'completed' || videoTask?.latest?.output) {
            status = 'completed';
          } else if (imageTask?.latest?.status === 'completed' || imageTask?.latest?.output) {
            status = 'completed';
          } else if (imageTask?.latest?.status === 'running') {
            status = 'generating_image';
          }

          const rawRefs = data.refs;
          const asset_ids = Array.isArray(rawRefs?.characters) ? rawRefs.characters : [];
          const script = sbContent?.story || sbContent?.script || '';

          storyboards.push({
            id: fallbackId,
            project_id: projectId,
            sequence_number: sbContent?.sequence || 0,
            title: sbContent?.title || meta?.id || fallbackId,
            description: script || null,
            prompt: imageTask?.params?.prompt || null,
            image_url: resolveVfsUrl(imageTask?.latest?.output),
            video_url: resolveVfsUrl(videoTask?.latest?.output),
            status,
            asset_ids,
            grid: meta?.grid || null,
            parentId: meta?.parent || null,
            tasks: tasks || {},
            metadata: meta || {},
            created_at: new Date().toISOString(),
          });
        } catch (e) {
          console.error(`[UI Adapter Storyboard Error] ${path}:`, e);
        }
      }
    }
  }

  assets.sort((a, b) => a.id.localeCompare(b.id));
  storyboards.sort((a, b) => (a.sequence_number - b.sequence_number) || a.id.localeCompare(b.id));

  return { assets, storyboards };
}
