import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KIE_PROVIDER } from '../../../scripts/aigc-provider-kie.mjs';

describe('KIE AI Provider', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('buildPayload should correctly format video request', () => {
    const params = {
      prompt: 'A cinematic coffee pour',
      image: 'https://example.com/image.png'
    };
    const payload = KIE_PROVIDER.buildPayload('videos', params);

    expect(payload).toEqual({
      model: 'bytedance/v1-pro-fast-image-to-video',
      input: {
        prompt: 'A cinematic coffee pour',
        image_url: 'https://example.com/image.png',
        resolution: '720p',
        duration: '5',
        nsfw_checker: true
      }
    });
  });

  it('submit should return taskId on success', async () => {
    const mockResponse = {
      code: 200,
      msg: 'success',
      data: { taskId: 'test-task-id' }
    };

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    const taskId = await KIE_PROVIDER.submit({
      baseUrl: 'https://api.kie.ai',
      apiKey: 'test-key',
      scope: 'videos',
      payload: {},
      fetchImpl
    });

    expect(taskId).toBe('test-task-id');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.kie.ai/api/v1/jobs/createTask',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-key'
        }
      })
    );
  });

  it('poll should return data on success', async () => {
    const mockPollResponse = {
      code: 200,
      msg: 'success',
      data: {
        taskId: 'test-task-id',
        state: 'success',
        resultJson: JSON.stringify({ resultUrls: ['https://example.com/video.mp4'] })
      }
    };

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPollResponse
    });

    const result = await KIE_PROVIDER.poll({
      baseUrl: 'https://api.kie.ai',
      apiKey: 'test-key',
      scope: 'videos',
      taskId: 'test-task-id',
      fetchImpl
    });

    expect(result.state).toBe('success');
    expect(result.taskId).toBe('test-task-id');
  });

  it('poll should throw on failure state', async () => {
    const mockPollResponse = {
      code: 200,
      msg: 'success',
      data: {
        taskId: 'test-task-id',
        state: 'fail',
        failMsg: 'Internal error'
      }
    };

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPollResponse
    });

    await expect(KIE_PROVIDER.poll({
      baseUrl: 'https://api.kie.ai',
      apiKey: 'test-key',
      scope: 'videos',
      taskId: 'test-task-id',
      fetchImpl
    })).rejects.toThrow('KIE task failed: Internal error');
  });

  it('extractOutputs should parse resultJson and return URLs', () => {
    const mockResult = {
      resultJson: JSON.stringify({ resultUrls: ['https://example.com/video1.mp4', 'https://example.com/video2.mp4'] })
    };

    const urls = KIE_PROVIDER.extractOutputs('videos', mockResult);
    expect(urls).toEqual(['https://example.com/video1.mp4', 'https://example.com/video2.mp4']);
  });
});
