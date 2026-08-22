import { logger } from '@/utils/logger';
import { AnthropicProvider } from './anthropicProvider';
import { createGoogleProvider } from './googleProvider';
import { OpenCodeProvider } from './openCodeProvider';
import { OpenAICompatibleProvider } from './openaiProvider';
import { getAIProviderDefinition } from './providerRegistry';
import type { AIProviderType, ModelProvider } from './types';

export function createProvider(
  providerType: AIProviderType,
  baseUrl: string,
  model: string,
  apiKey?: string,
  contextWindow?: number
): ModelProvider {
  const definition = getAIProviderDefinition(providerType);

  switch (definition.protocol) {
    case 'anthropic':
      return new AnthropicProvider(baseUrl, apiKey || '', model, contextWindow);
    case 'google':
      return createGoogleProvider(baseUrl, apiKey || '', model, contextWindow);
    case 'openai-compatible': {
      if (providerType === 'opencode') {
        return new OpenCodeProvider(baseUrl, apiKey || '', model, contextWindow);
      }
      const provider = new OpenAICompatibleProvider(baseUrl, apiKey || '', model, contextWindow);
      provider.name = providerType;
      return provider;
    }
  }

  logger.warn(`[AI Provider] Unsupported provider type: ${providerType}`);
  return new OpenAICompatibleProvider(baseUrl, apiKey || '', model, contextWindow);
}
