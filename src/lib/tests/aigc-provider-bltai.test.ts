import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BLTAI_PROVIDER } from '../../../scripts/aigc-provider-bltai.mjs';

describe('BLTAI Provider Script', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('buildPayload should correctly format image request', () => {
    const params = {
      model: 'nano-banana',
      prompt: 'A comic style hero',
      aspect_ratio: '16:9'
    };
    const payload = BLTAI_PROVIDER.buildPayload('images', params);

    expect(payload).toEqual({
      prompt: 'A comic style hero',
      model: 'nano-banana',
      response_format: 'url',
      aspect_ratio: '16:9'
    });
  });

  it('buildPayload should correctly format video request', () => {
    const params = {
      model: 'doubao-seedance-1-0-pro-fast-251015',
      prompt: 'Motion of sea waves',
      images: ['https://example.com/img1.png'],
      duration: 5
    };
    const payload = BLTAI_PROVIDER.buildPayload('videos', params);

    expect(payload).toEqual({
      model: 'doubao-seedance-1-0-pro-fast-251015',
      prompt: 'Motion of sea waves',
      images: ['https://example.com/img1.png'],
      duration: 5
    });
  });

  it('submit should return taskId on success', async () => {
    const mockResponse = {
      id: 'test-task-id'
    };

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    const taskId = await BLTAI_PROVIDER.submit({
      baseUrl: 'https://api.bltcy.ai',
      apiKey: 'test-key',
      scope: 'images',
      payload: {},
      fetchImpl
    });

    expect(taskId).toBe('test-task-id');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.bltcy.ai/v1/images/generations',
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
      status: 'SUCCESS',
      data: {
        data: [{ url: 'https://example.com/img.png' }]
      }
    };

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPollResponse
    });

    const result = await BLTAI_PROVIDER.poll({
      baseUrl: 'https://api.bltcy.ai',
      apiKey: 'test-key',
      scope: 'images',
      taskId: 'test-task-id',
      fetchImpl
    });

    expect(result.status).toBe('SUCCESS');
  });

  it('extractOutputs should return URLs for images', () => {
    const mockResult = {
      data: {
        data: [{ url: 'https://example.com/img1.png' }]
      }
    };

    const urls = BLTAI_PROVIDER.extractOutputs('images', mockResult);
    expect(urls).toEqual(['https://example.com/img1.png']);
  });

  it('extractOutputs should return URLs for videos', () => {
    const mockResult = {
      data: {
        video_url: 'https://example.com/video.mp4'
      }
    };

    const urls = BLTAI_PROVIDER.extractOutputs('videos', mockResult);
    expect(urls).toEqual(['https://example.com/video.mp4']);
  });

  it('buildPayload should throw informative error if model is missing for images', () => {
    const params = { prompt: 'test' };
    expect(() => BLTAI_PROVIDER.buildPayload('images', params)).toThrow(
      /缺失 'model' 参数。可用图像模型: nano-banana, nano-banana-2/
    );
  });

  it('buildPayload should throw informative error if model is missing for videos', () => {
    const params = { prompt: 'test' };
    expect(() => BLTAI_PROVIDER.buildPayload('videos', params)).toThrow(
      /缺失 'model' 参数。可用视频模型: doubao-seedance-1-0-pro-fast-251015, veo3.1-fast/
    );
  });
});
