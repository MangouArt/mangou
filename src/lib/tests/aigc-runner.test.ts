import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { runTask } from '../../../scripts/aigc-runner.mjs';

describe('scripts/aigc-runner.mjs', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mangou-runner-test-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('runTask should call fetch and record success in tasks.jsonl', async () => {
    const mockOutput = { url: 'https://example.com/output.png' };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({ output: mockOutput.url })
    });

    const task = {
      id: 'test-task',
      type: 'image',
      input: {
        endpoint: 'https://api.example.com/generate',
        prompt: 'a cat'
      }
    };

    await runTask(tempDir, task, { fetchImpl: fetchImpl as any });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.com/generate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ endpoint: 'https://api.example.com/generate', prompt: 'a cat' })
      })
    );

    const content = await fs.readFile(path.join(tempDir, 'tasks.jsonl'), 'utf-8');
    const lines = content.trim().split('\n').map(l => JSON.parse(l));
    
    // Should have processing and success events
    expect(lines.some(l => l.status === 'processing')).toBe(true);
    expect(lines.some(l => l.status === 'success' && l.output === mockOutput.url)).toBe(true);
  });

  it('runTask should record failure on HTTP error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    const task = {
      id: 'test-fail-task',
      type: 'image',
      input: {
        endpoint: 'https://api.example.com/fail'
      }
    };

    await runTask(tempDir, task, { fetchImpl: fetchImpl as any });

    const content = await fs.readFile(path.join(tempDir, 'tasks.jsonl'), 'utf-8');
    expect(content).toContain('HTTP 500 Internal Server Error');
    expect(content).toContain('"status":"failed"');
  });
});
