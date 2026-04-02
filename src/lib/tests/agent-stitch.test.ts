import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stitch, inferProjectIdFromCwd } from '../../../scripts/agent-stitch.mjs';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { listLatestTasks } from '../../../scripts/tasks-jsonl.mjs';

vi.mock('fs/promises', () => ({
  default: {
    readdir: vi.fn(),
    readFile: vi.fn(),
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
  },
  readdir: vi.fn(),
  readFile: vi.fn(),
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
    vi.mocked(fs.readFile).mockResolvedValue('');
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

  it('stitch should fall back to image outputs and synthesize preview clips', async () => {
    const projectRoot = '/tmp/project';

    vi.mocked(fs.readdir).mockResolvedValue(['001.yaml'] as any);
    vi.mocked(fs.readFile).mockResolvedValue(
      [
        'meta:',
        '  id: s1',
        'content:',
        '  duration: "5s"',
        'tasks:',
        '  image:',
        '    latest:',
        '      output: assets/images/s1.png',
        '',
      ].join('\n')
    );
    vi.mocked(listLatestTasks).mockResolvedValue([
      {
        ref: { yamlPath: 'storyboards/001.yaml', taskType: 'image' },
        type: 'image',
        status: 'success',
        output: { files: ['assets/images/s1.png'] },
      },
    ] as any);

    const result = await stitch(projectRoot, 'preview.mp4');

    expect(result).toContain('preview.mp4');
    expect(mockExec).toHaveBeenCalledTimes(2);
    expect(mockExec.mock.calls[0][0]).toContain('-loop 1');
    expect(mockExec.mock.calls[0][0]).toContain('assets/images/s1.png');
    expect(mockExec.mock.calls[0][0]).toContain('-t 5');
    expect(mockExec.mock.calls[1][0]).toContain('ffmpeg -f concat');
  });
});
