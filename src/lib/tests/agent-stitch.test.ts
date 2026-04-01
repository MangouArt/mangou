import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stitch, inferProjectIdFromCwd } from '../../../scripts/agent-stitch.mjs';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { listLatestTasks } from '../../../scripts/tasks-jsonl.mjs';

vi.mock('fs/promises', () => ({
  default: {
    readdir: vi.fn(),
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
  },
  readdir: vi.fn(),
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../scripts/tasks-jsonl.mjs', () => ({
  listLatestTasks: vi.fn(),
}));

const mockExec = vi.fn((_cmd: string, cb: any) => cb(null, { stdout: '', stderr: '' }));
vi.mock('child_process', () => ({
  exec: (cmd: string, cb: any) => mockExec(cmd, cb)
}));

describe('scripts/agent-stitch.mjs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.unlink).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
  });

  it('stitch should find videos from tasks and call ffmpeg', async () => {
    const projectRoot = '/tmp/project';
    
    // Mock readdir to return storyboard files
    vi.mocked(fs.readdir).mockResolvedValue(['001.yaml', '002.yaml'] as any);
    
    // Mock listLatestTasks to return completed video tasks
    vi.mocked(listLatestTasks).mockResolvedValue([
      {
        ref: { yamlPath: 'storyboards/001.yaml' },
        type: 'video',
        status: 'completed',
        output: 'assets/videos/v1.mp4'
      },
      {
        ref: { yamlPath: 'storyboards/002.yaml' },
        type: 'video',
        status: 'completed',
        output: 'assets/videos/v2.mp4'
      }
    ] as any);

    const result = await stitch(projectRoot);
    
    expect(result).toContain('output.mp4');
    expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('concat_list.txt'),
        expect.stringContaining("file '/tmp/project/assets/videos/v1.mp4'\nfile '/tmp/project/assets/videos/v2.mp4'")
    );
    expect(mockExec).toHaveBeenCalledWith(
      expect.stringContaining('ffmpeg -f concat'),
      expect.any(Function)
    );
  });
  
  it('stitch should throw if no videos found', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([] as any);
    vi.mocked(listLatestTasks).mockResolvedValue([] as any);

    await expect(stitch('/tmp/empty')).rejects.toThrow('No completed video tasks found');
  });
});
