import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalVFSAdapter } from './local';

class FakeEventSource {
  url: string;
  listeners = new Map<string, ((event: { data: string }) => void)[]>();

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(type: string, listener: (event: { data: string }) => void) {
    const current = this.listeners.get(type) || [];
    current.push(listener);
    this.listeners.set(type, current);
  }

  emit(type: string, data: unknown) {
    const listeners = this.listeners.get(type) || [];
    const payload = { data: JSON.stringify(data) };
    listeners.forEach((listener) => listener(payload));
  }

  close() {}
}

describe('LocalVFSAdapter SSE', () => {
  beforeEach(() => {
    if (typeof vi.unstubAllGlobals === 'function') {
      vi.unstubAllGlobals();
    }
  });

  it('订阅 /api/vfs/events 并消费 vfs 命名事件', async () => {
    const source = new FakeEventSource('/api/vfs/events?projectId=demo');
    const EventSourceCtor = vi.fn(() => source);
    if (typeof vi.stubGlobal === 'function') {
      vi.stubGlobal('window', { EventSource: EventSourceCtor });
    } else {
      (globalThis as any).window = { EventSource: EventSourceCtor };
    }

    const adapter = new LocalVFSAdapter();
    await adapter.init('demo');

    const callback = vi.fn();
    adapter.watch(callback);

    expect(EventSourceCtor).toHaveBeenCalledWith('/api/vfs/events?projectId=demo');

    source.emit('vfs', {
      projectId: 'demo',
      path: '/storyboards/scene-001.yaml',
      type: 'updated',
      timestamp: '2026-03-28T00:00:00.000Z',
    });

    expect(callback).toHaveBeenCalledWith({
      type: 'file:updated',
      path: '/storyboards/scene-001.yaml',
      timestamp: new Date('2026-03-28T00:00:00.000Z'),
    });
  });
});
