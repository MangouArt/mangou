import { describe, expect, it } from 'vitest';
import { getTaskOutputUrl, getTaskRefPath, normalizeHistoryTask } from './task-history';

describe('task-history', () => {
  it('从 ref.yamlPath 读取任务引用路径', () => {
    expect(getTaskRefPath({
      ref: { yamlPath: '/storyboards/scene-001.yaml', taskType: 'image' },
    })).toBe('/storyboards/scene-001.yaml');
  });

  it('把 output.files[0] 转成可访问的本地 VFS URL', () => {
    expect(getTaskOutputUrl('demo', {
      output: { files: ['assets/images/scene-001.png'] },
    })).toBe('/api/vfs?projectId=demo&path=.%2Fassets%2Fimages%2Fscene-001.png');
  });

  it('标准化历史任务时保留 prompt 并产出 outputUrl', () => {
    const normalized = normalizeHistoryTask('demo', {
      input: {
        prompt: 'test prompt',
        params: { model: 'veo3.1-fast' },
      },
      output: {
        urls: ['assets/videos/scene-001.mp4'],
      },
      ref: {
        yamlPath: '/storyboards/scene-001.yaml',
      },
    });

    expect(normalized.refPath).toBe('/storyboards/scene-001.yaml');
    expect(normalized.outputUrl).toBe('/api/vfs?projectId=demo&path=.%2Fassets%2Fvideos%2Fscene-001.mp4');
    expect(normalized.params).toEqual({ model: 'veo3.1-fast' });
  });
});
