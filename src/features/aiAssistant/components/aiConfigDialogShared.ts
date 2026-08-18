import { AI_PROVIDER_DEFINITIONS, getAIProviderDefinition } from '@/lib/ai/providerRegistry';
import type { AIProviderType } from '@/lib/ai/types';

export const PROVIDER_OPTIONS: { value: AIProviderType; label: string }[] =
  AI_PROVIDER_DEFINITIONS.map(({ id, label }) => ({ value: id, label }));

export function shouldShowApiKey(provider: AIProviderType): boolean {
  return getAIProviderDefinition(provider).requiresApiKey;
}

export function getBaseUrlPlaceholder(provider: AIProviderType): string {
  return getAIProviderDefinition(provider).baseUrlPlaceholder;
}

export function getModelPlaceholder(provider: AIProviderType): string {
  return getAIProviderDefinition(provider).modelPlaceholder;
}

export function getApiKeyPlaceholder(provider: AIProviderType): string {
  return getAIProviderDefinition(provider).apiKeyPlaceholder;
}
