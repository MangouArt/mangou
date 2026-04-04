import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KIE_PROVIDER } from '../../../scripts/aigc-provider-kie.mjs';

describe('KIE AI Provider', () => {
  beforeEach(() => {
    if (typeof vi.stubGlobal === 'function') {
      vi.stubGlobal('fetch', vi.fn());
    } else {
      (globalThis as any).fetch = vi.fn();
    }
  });

  it('buildPayload should correctly format bytedance/seedance-2-fast request', () => {
    const params = {
      model: 'bytedance/seedance-2-fast',
      prompt: 'A cinematic video of a cat',
      images: ['https://example.com/first.png'],
      duration: 10,
      aspect_ratio: '16:9',
      web_search: false
    };
    const payload = KIE_PROVIDER.buildPayload('videos', params);

    expect(payload).toEqual({
      model: 'bytedance/seedance-2-fast',
      input: {
        prompt: 'A cinematic video of a cat',
        reference_image_urls: ['https://example.com/first.png'],
        reference_video_urls: [],
        reference_audio_urls: [],
        return_last_frame: false,
        generate_audio: true,
        resolution: '480p',
        aspect_ratio: '16:9',
        duration: 10,
        web_search: false
      }
    });
  });

  it('buildPayload should correctly format video request', () => {
    const params = {
      model: 'bytedance/v1-pro-fast-image-to-video',
      prompt: 'A cinematic coffee pour',
      images: ['https://example.com/image.png']
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

  it('buildPayload should correctly format nano-banana-2 request', () => {
    const params = {
      model: 'nano-banana-2',
      prompt: 'A Hindi text translation',
      images: ['https://example.com/ref.png'],
      aspect_ratio: '16:9'
    };
    const payload = KIE_PROVIDER.buildPayload('images', params);

    expect(payload).toEqual({
      model: 'nano-banana-2',
      input: {
        prompt: 'A Hindi text translation',
        image_input: ['https://example.com/ref.png'],
        aspect_ratio: '16:9',
        resolution: '1K',
        output_format: 'jpg'
      }
    });
  });

  it('buildPayload should correctly format nano-banana-edit request', () => {
    const params = {
      model: 'google/nano-banana-edit',
      prompt: 'Change to character figure',
      images: ['https://example.com/source.png'],
      aspect_ratio: '1:1'
    };
    const payload = KIE_PROVIDER.buildPayload('images', params);

    expect(payload).toEqual({
      model: 'google/nano-banana-edit',
      input: {
        prompt: 'Change to character figure',
        image_urls: ['https://example.com/source.png'],
        output_format: 'png',
        image_size: '1:1'
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
      payload: {
        model: 'test-model',
        input: { prompt: 'test' }
      },
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

  it('extractOutputs should parse resultJson and return URLs for images', () => {
    const mockResult = {
      resultJson: JSON.stringify({ resultUrls: ['https://example.com/img1.png'] })
    };

    const urls = KIE_PROVIDER.extractOutputs('images', mockResult);
    expect(urls).toEqual(['https://example.com/img1.png']);
  });

  it('extractOutputs should handle invalid JSON and log error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockResult = {
      resultJson: 'invalid-json'
    };

    const urls = KIE_PROVIDER.extractOutputs('images', mockResult);
    expect(urls).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('submit should upload multiple images via stream to KIE for seedance-2-fast', async () => {
    const mockUploadResponse = {
      success: true,
      data: { downloadUrl: 'https://cdn.kie.ai/uploaded.png' }
    };
    const mockSubmitResponse = {
      code: 200,
      data: { taskId: 'task-after-upload-multi' }
    };

    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUploadResponse
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSubmitResponse
      });

    const taskId = await KIE_PROVIDER.submit({
      baseUrl: 'https://api.kie.ai',
      apiKey: 'test-key',
      scope: 'videos',
      payload: {
        model: 'bytedance/seedance-2-fast',
        input: { 
          prompt: 'test',
          reference_image_urls: ['data:image/png;base64,yyyy']
        }
      },
      fetchImpl
    });

    expect(taskId).toBe('task-after-upload-multi');
    // Expect one upload in reference_image_urls and one submit
    expect(fetchImpl).toHaveBeenCalledTimes(2); 
    expect(fetchImpl).toHaveBeenLastCalledWith(
      'https://api.kie.ai/api/v1/jobs/createTask',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('https://cdn.kie.ai/uploaded.png')
      })
    );
  });

  it('submit should upload images via stream to KIE first', async () => {
    const mockUploadResponse = {
      success: true,
      data: { downloadUrl: 'https://cdn.kie.ai/uploaded.png' }
    };
    const mockSubmitResponse = {
      code: 200,
      data: { taskId: 'task-after-upload' }
    };

    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUploadResponse
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSubmitResponse
      });

    const taskId = await KIE_PROVIDER.submit({
      baseUrl: 'https://api.kie.ai',
      apiKey: 'test-key',
      scope: 'videos',
      payload: {
        model: 'test-video-model',
        input: { 
          prompt: 'test',
          image_url: 'data:image/png;base64,xxxx' 
        }
      },
      fetchImpl
    });

    expect(taskId).toBe('task-after-upload');
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('file-stream-upload'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key'
        }),
        body: expect.any(Object) // FormData
      })
    );
  });

  it('poll should throw on timeout', async () => {
    const mockPollResponse = {
      code: 200,
      data: { state: 'processing' }
    };

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPollResponse
    });

    // Mock Date.now to simulate timeout
    const startTime = 1000;
    const endTime = startTime + 31 * 60 * 1000; // Over 30 mins
    let nowCalled = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => {
      nowCalled++;
      return nowCalled === 1 ? startTime : endTime;
    });

    await expect(KIE_PROVIDER.poll({
      baseUrl: 'https://api.kie.ai',
      apiKey: 'test-key',
      scope: 'videos',
      taskId: 'test-task-id',
      timeoutMs: 30 * 60 * 1000,
      fetchImpl
    })).rejects.toThrow('Provider polling timeout');

    vi.restoreAllMocks();
  });
});
