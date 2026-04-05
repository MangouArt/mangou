import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BLTAI_PROVIDER } from '../../src/logic/aigc-provider-bltai';

describe('BLTAI Provider Script', () => {
  beforeEach(() => {
    if (typeof vi.stubGlobal === 'function') {
      vi.stubGlobal('fetch', vi.fn());
    } else {
      (globalThis as any).fetch = vi.fn();
    }
  });

  it('buildPayload should correctly format image request', () => {
    const params = {
      model: 'gemini-3.1-flash-image-preview',
      prompt: 'A comic style hero',
      aspect_ratio: '16:9',
      image: ['https://example.com/ref.png']
    };
    const payload = BLTAI_PROVIDER.buildPayload('images', params);

    expect(payload).toEqual({
      prompt: 'A comic style hero',
      model: 'gemini-3.1-flash-image-preview',
      response_format: 'url',
      aspect_ratio: '16:9',
      image: ['https://example.com/ref.png']
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
      'https://api.bltcy.ai/v1/images/generations?async=true',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-key'
        }
      })
    );
  });

  it('submit should upload data url images before calling generations', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            url: 'https://cdn.bltcy.ai/uploads/ref-1.png',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'task-after-upload',
        }),
      });

    const taskId = await BLTAI_PROVIDER.submit({
      baseUrl: 'https://api.bltcy.ai',
      apiKey: 'test-key',
      scope: 'images',
      payload: {
        model: 'gemini-3.1-flash-image-preview',
        prompt: 'A comic style hero',
        response_format: 'url',
        image: ['data:image/png;base64,aaaa'],
      },
      fetchImpl,
    });

    expect(taskId).toBe('task-after-upload');
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://api.bltcy.ai/v1/files',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-key',
        },
        body: expect.any(FormData),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://api.bltcy.ai/v1/images/generations?async=true',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-key',
        },
        body: JSON.stringify({
          model: 'gemini-3.1-flash-image-preview',
          prompt: 'A comic style hero',
          response_format: 'url',
          image: ['https://cdn.bltcy.ai/uploads/ref-1.png'],
        }),
      }),
    );
  });

  it('submit should keep remote image urls untouched for generations', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'remote-url-task',
      }),
    });

    await BLTAI_PROVIDER.submit({
      baseUrl: 'https://api.bltcy.ai',
      apiKey: 'test-key',
      scope: 'images',
      payload: {
        model: 'gemini-3.1-flash-image-preview',
        prompt: 'A comic style hero',
        response_format: 'url',
        image: ['https://example.com/ref.png'],
      },
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.bltcy.ai/v1/images/generations?async=true',
      expect.objectContaining({
        body: JSON.stringify({
          model: 'gemini-3.1-flash-image-preview',
          prompt: 'A comic style hero',
          response_format: 'url',
          image: ['https://example.com/ref.png'],
        }),
      }),
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

  it('buildPayload should reject deprecated images alias for image generation', () => {
    expect(() => BLTAI_PROVIDER.buildPayload('images', {
      model: 'gemini-3.1-flash-image-preview',
      prompt: 'test',
      images: ['https://example.com/ref.png'],
    })).toThrow(/请使用 'image: \[\]'/);
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
