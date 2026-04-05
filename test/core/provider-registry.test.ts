import { describe, expect, it } from 'vitest';
import { getAIGCProvider, listAIGCProviders, registerAIGCProvider } from '../../src/logic/aigc-provider-registry';
import { resolveProviderEnv } from '../../src/logic/bltai-lib';

describe('AIGC provider registry', () => {
  it('returns bltai provider with env metadata', () => {
    const provider = getAIGCProvider('bltai');
    expect(provider.id).toBe('bltai');
    expect(provider.env).toMatchObject({
      apiKey: 'BLTAI_API_KEY',
      baseUrl: 'BLTAI_BASE_URL',
    });
  });

  it('resolves provider env using provider metadata', () => {
    const provider = getAIGCProvider('bltai');
    const resolved = resolveProviderEnv(provider, {
      BLTAI_API_KEY: 'test-key',
      BLTAI_BASE_URL: 'https://api.bltcy.ai/v1/',
    });

    expect(resolved).toEqual({
      apiKey: 'test-key',
      baseUrl: 'https://api.bltcy.ai',
    });
  });

  it('falls back to workspace config when shell env is missing', () => {
    const provider = getAIGCProvider('bltai');
    const resolved = resolveProviderEnv(
      provider,
      {},
      { apiKey: 'config-key', baseUrl: 'https://api.bltcy.ai/v2/' }
    );

    expect(resolved).toEqual({
      apiKey: 'config-key',
      baseUrl: 'https://api.bltcy.ai',
    });
  });

  it('prefers shell env over workspace config', () => {
    const provider = getAIGCProvider('bltai');
    const resolved = resolveProviderEnv(
      provider,
      {
        BLTAI_API_KEY: 'env-key',
        BLTAI_BASE_URL: 'https://env.example.com/v1/',
      },
      { apiKey: 'config-key', baseUrl: 'https://config.example.com/v2/' }
    );

    expect(resolved).toEqual({
      apiKey: 'env-key',
      baseUrl: 'https://env.example.com',
    });
  });

  it('registers another provider with the same contract', () => {
    const provider = registerAIGCProvider({
      id: 'mock-provider',
      label: 'Mock Provider',
      env: {
        apiKey: 'MOCK_API_KEY',
        baseUrl: 'MOCK_BASE_URL',
        defaultBaseUrl: 'https://mock.example.com',
      },
      scopes: {
        image: 'images',
        video: 'videos',
      },
      buildPayload(scope: string, params: Record<string, unknown>) {
        return { scope, ...params };
      },
      async submit() {
        return 'task_123';
      },
      async poll() {
        return { status: 'SUCCESS', outputs: ['https://mock.example.com/out.png'] };
      },
      extractOutputs(_scope: string, result: { outputs: string[] }) {
        return result.outputs;
      },
    });

    expect(provider.id).toBe('mock-provider');
    expect(listAIGCProviders().map((item) => item.id)).toContain('mock-provider');
    expect(getAIGCProvider('mock-provider').env.apiKey).toBe('MOCK_API_KEY');
  });

  it('builds multi-image video payloads with seedance defaults for bltai', () => {
    const provider = getAIGCProvider('bltai');
    const payload = provider.buildPayload('videos', {
      prompt: 'camera push in',
      model: 'doubao-seedance-1-0-pro-fast-251015',
      images: ['assets/images/a.png', 'assets/images/b.png'],
    });

    expect(payload).toMatchObject({
      prompt: 'camera push in',
      model: 'doubao-seedance-1-0-pro-fast-251015',
      images: ['assets/images/a.png', 'assets/images/b.png'],
      duration: 5,
    });
  });
});
