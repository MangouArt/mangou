import { describe, it, expect, vi } from 'vitest';
import { stitch, resolveWebOrigin, inferProjectIdFromCwd } from '../../../scripts/agent-stitch.mjs';

describe('scripts/agent-stitch.mjs', () => {
  it('resolveWebOrigin should return default or env var', () => {
    delete process.env.MANGOU_WEB_ORIGIN;
    process.env.MANGOU_WEB_PORT = '4000';
    expect(resolveWebOrigin()).toBe('http://127.0.0.1:4000');
    
    process.env.MANGOU_WEB_ORIGIN = 'https://mango.example.com';
    expect(resolveWebOrigin()).toBe('https://mango.example.com');
  });

  it('stitch should call API and return URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, url: 'https://example.com/movie.mp4' })
    });

    const url = await stitch('test-project', { fetchImpl });
    expect(url).toBe('https://example.com/movie.mp4');
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('/api/projects/test-project/stitch'),
      expect.objectContaining({ method: 'POST' })
    );
  });
  
  it('stitch should throw on API error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => 'STITCH_ERROR'
    });

    await expect(stitch('test-project', { fetchImpl })).rejects.toThrow('API Error: STITCH_ERROR');
  });
});
