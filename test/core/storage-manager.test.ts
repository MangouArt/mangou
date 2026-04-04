import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VFSAdapter, VFSProjectSnapshot } from '../../src/cli/core/vfs/adapter';
import { clearVFS, getVFS } from '../../src/cli/core/vfs';
import { VFSStorageManager } from '../../src/cli/core/vfs/storage-manager';

function createAdapter(snapshot: VFSProjectSnapshot): VFSAdapter {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    loadSnapshot: vi.fn().mockResolvedValue(snapshot),
    readFile: vi.fn().mockResolvedValue(null),
    writeFile: vi.fn().mockResolvedValue(undefined),
    listDirectory: vi.fn().mockResolvedValue([]),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    watch: vi.fn().mockReturnValue(() => {}),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
}

describe('VFSStorageManager', () => {
  afterEach(() => {
    clearVFS('demo');
  });

  it('prefers adapter snapshot over recursive list/read loading', async () => {
    const manager = new VFSStorageManager();
    const adapter = createAdapter({
      projectId: 'demo',
      generatedAt: new Date().toISOString(),
      files: [{ path: '/storyboards/scene-001.yaml', content: 'meta:\n  id: scene-001\n' }],
    });

    (manager as any).getAdapter = vi.fn().mockResolvedValue(adapter);

    const loaded = await manager.loadProject('demo');

    expect(loaded).toBe(true);
    expect(adapter.loadSnapshot).toHaveBeenCalledTimes(1);
    expect(adapter.listDirectory).not.toHaveBeenCalled();
    expect(adapter.readFile).not.toHaveBeenCalled();
    expect(getVFS('demo').getFileContent('/storyboards/scene-001.yaml')).toContain('scene-001');
  });
});
