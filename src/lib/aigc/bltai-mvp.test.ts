import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildPayload,
  getTask,
  normalizeBaseUrl,
  pollTask,
  resolvePollEndpoint,
  resolveSubmitEndpoint,
  submitTask,
} from '../../../scripts/bltai-mvp.mjs';

describe('BLTAI MVP script', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('builds provider payloads for images and videos', () => {
    expect(buildPayload('images', { prompt: 'cat' })).toMatchObject({
      prompt: 'cat',
      model: 'nano-banana',
    });

    expect(
      buildPayload('videos', {
        prompt: 'camera move',
        images: 'a.png,b.png',
        duration: '4',
      })
    ).toMatchObject({
      prompt: 'camera move',
      model: 'veo3.1-fast',
      images: ['a.png', 'b.png'],
      duration: 4,
      aspect_ratio: '16:9',
    });

    expect(
      buildPayload('images', {
        prompt: 'cat',
        images: 'a.png,b.png',
      })
    ).toMatchObject({
      image: ['a.png', 'b.png'],
    });
  });

  it('normalizes BLTAI endpoints', () => {
    expect(normalizeBaseUrl('https://api.bltcy.ai/v1/')).toBe('https://api.bltcy.ai');
    expect(resolveSubmitEndpoint('https://api.bltcy.ai', 'images')).toBe(
      'https://api.bltcy.ai/v1/images/generations?async=true'
    );
    expect(resolvePollEndpoint('https://api.bltcy.ai', 'videos', 'task-1')).toBe(
      'https://api.bltcy.ai/v2/videos/generations/task-1'
    );
  });

  it('submits image tasks and extracts task ids', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { task_id: 'img_123' } }),
    } as Response);

    const taskId = await submitTask('https://api.bltcy.ai', 'test-key', 'images', {
      prompt: 'cat',
    });

    expect(taskId).toBe('img_123');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.bltcy.ai/v1/images/generations?async=true',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      })
    );
  });

  it('falls back to alternate image polling endpoint', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: { message: 'missing task endpoint' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'SUCCESS', data: [{ url: 'https://img.test/1.png' }] } }),
      } as Response);

    const result = await getTask('https://api.bltcy.ai', 'test-key', 'images', 'img_123');

    expect(result.endpoint).toBe('https://api.bltcy.ai/v1/images/generations/img_123');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('polls until success and returns terminal payload', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'PROCESSING' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'SUCCESS', output: 'https://video.test/out.mp4' }),
      } as Response);

    const result = await pollTask(
      'https://api.bltcy.ai',
      'test-key',
      'videos',
      'vid_123',
      1000,
      false
    );

    expect(result).toMatchObject({
      status: 'SUCCESS',
      output: 'https://video.test/out.mp4',
    });
  });
});
