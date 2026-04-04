#!/usr/bin/env bun

/**
 * 复制这个模板实现新的 AIGC provider，然后注册到 `aigc-provider-registry.mjs`。
 * `agent-generate.mjs` 会复用同一套任务写入、YAML 投影和资源解析流程。
 */
export const AIGC_PROVIDER_TEMPLATE = {
  id: 'replace-me',
  label: 'Replace Me',
  env: {
    apiKey: 'REPLACE_ME_API_KEY',
    baseUrl: 'REPLACE_ME_BASE_URL',
    defaultBaseUrl: 'https://api.example.com',
  },
  scopes: {
    image: 'images',
    video: 'videos',
  },
  buildPayload(scope, params) {
    return {
      ...params,
      prompt: params.prompt || '',
      scope,
    };
  },
  async submit({ baseUrl, apiKey, scope, payload, fetchImpl = fetch }) {
    const response = await fetchImpl(`${baseUrl}/replace-me/${scope}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Submit failed: ${response.status} ${response.statusText} ${text}`);
    }

    const data = await response.json();
    const taskId = data.task_id || data.id;
    if (!taskId) {
      throw new Error(`Missing task id: ${JSON.stringify(data)}`);
    }
    return taskId;
  },
  async poll({ baseUrl, apiKey, scope, taskId, timeoutMs = 30 * 60 * 1000, debug = false, fetchImpl = fetch }) {
    const startedAt = Date.now();
    let delayMs = 2000;

    for (;;) {
      const response = await fetchImpl(`${baseUrl}/replace-me/${scope}/${taskId}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Poll failed: ${response.status} ${response.statusText} ${text}`);
      }

      const data = await response.json();
      const status = String(data.status || '').toUpperCase();
      if (debug) {
        console.error('[provider-template] poll status:', status || '(empty)');
      }

      if (status === 'SUCCESS' || status === 'COMPLETED') {
        return data;
      }
      if (status === 'FAILED' || status === 'ERROR' || status === 'CANCELLED') {
        throw new Error(data.error || data.message || 'Provider task failed');
      }
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error('Provider polling timeout');
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 2, 8000);
    }
  },
  extractOutputs(scope, result) {
    if (scope === 'images') {
      return result?.data?.map((item) => item.url).filter(Boolean) || [];
    }
    return result?.outputs?.filter(Boolean) || [];
  },
};
