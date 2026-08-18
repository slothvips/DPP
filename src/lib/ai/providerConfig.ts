import type { AIProviderType } from './providerIds';
import { AI_PROVIDER_REGISTRY } from './providerRegistry';

export const DEFAULT_CONFIGS = Object.fromEntries(
  Object.values(AI_PROVIDER_REGISTRY).map((provider) => [
    provider.id,
    { baseUrl: provider.defaultBaseUrl, model: provider.defaultModel },
  ])
) as Record<AIProviderType, { baseUrl: string; model: string }>;
