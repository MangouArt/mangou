import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BLTAIProvider } from './bltai';
import { MODELS } from '../constants';

describe('BLTAIProvider', () => {
  const apiKey = 'test-api-key';
  const provider = new BLTAIProvider(apiKey);

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('chat', () => {
    it('should return successful response on success', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Hello world',
            },
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await provider.chat({
        model: MODELS.CHAT.DEFAULT,
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(result.success).toBe(true);
      expect(result.data?.content).toBe('Hello world');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/chat/completions'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${apiKey}`,
          }),
        })
      );
    });

    it('should return error on failure', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Unauthorized' } }),
      } as Response);

      const result = await provider.chat({
        model: MODELS.CHAT.DEFAULT,
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });
  });

  describe('generateImage', () => {
    it('should extract URLs from text response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Here is your image: https://example.com/image.png',
            },
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await provider.generateImage({
        prompt: 'a cat',
        model: MODELS.IMAGE.DEFAULT,
      });

      expect(result.success).toBe(true);
      expect(result.data?.urls).toEqual(['https://example.com/image.png']);
    });

    it('should handle raw URL response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'https://example.com/raw.png',
            },
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await provider.generateImage({
        prompt: 'a dog',
        model: MODELS.IMAGE.DEFAULT,
      });

      expect(result.success).toBe(true);
      expect(result.data?.urls).toEqual(['https://example.com/raw.png']);
    });
  });

  describe('generateVideo', () => {
    it('should return task_id', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ task_id: 'task-123' }),
      } as Response);

      const result = await provider.generateVideo({
        prompt: 'a movie',
        model: MODELS.VIDEO.DEFAULT,
        images: ['https://example.com/frame.png'],
      });

      expect(result.success).toBe(true);
      expect(result.data?.task_id).toBe('task-123');
      // Should use /v2/ for videos
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/videos/generations'),
        expect.any(Object)
      );
    });
  });
});
