#!/usr/bin/env bun
import { BLTAI_PROVIDER } from '@logic/aigc-provider-bltai';
import { EVOLINK_PROVIDER } from '@logic/aigc-provider-evolink';
import { KIE_PROVIDER } from '@logic/aigc-provider-kie';
import { JIEKOU_PROVIDER } from '@logic/aigc-provider-jiekou';

const PROVIDERS = new Map([
  [BLTAI_PROVIDER.id, BLTAI_PROVIDER],
  [EVOLINK_PROVIDER.id, EVOLINK_PROVIDER],
  [KIE_PROVIDER.id, KIE_PROVIDER],
  [JIEKOU_PROVIDER.id, JIEKOU_PROVIDER],
]);

export function registerAIGCProvider(provider: any) {
  if (!provider || typeof provider !== 'object') {
    throw new Error('provider must be an object');
  }
  if (!provider.id) {
    throw new Error('provider.id is required');
  }
  if (typeof provider.buildPayload !== 'function') {
    throw new Error(`provider.buildPayload is required: ${provider.id}`);
  }
  if (typeof provider.submit !== 'function') {
    throw new Error(`provider.submit is required: ${provider.id}`);
  }
  if (typeof provider.poll !== 'function') {
    throw new Error(`provider.poll is required: ${provider.id}`);
  }
  if (typeof provider.extractOutputs !== 'function') {
    throw new Error(`provider.extractOutputs is required: ${provider.id}`);
  }
  if (!provider.env?.apiKey || !provider.env?.baseUrl || !provider.env?.defaultBaseUrl) {
    throw new Error(`provider.env is invalid: ${provider.id}`);
  }
  PROVIDERS.set(provider.id, provider);
  return provider;
}

export function getAIGCProvider(providerId = 'bltai') {
  const provider = PROVIDERS.get(providerId);
  if (!provider) {
    const supported = Array.from(PROVIDERS.keys()).join(', ');
    throw new Error(`Unsupported provider: ${providerId}. Available providers: ${supported}`);
  }
  return provider;
}

export function listAIGCProviders() {
  return Array.from(PROVIDERS.values());
}
