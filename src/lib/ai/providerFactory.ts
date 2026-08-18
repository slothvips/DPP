import { logger } from '@/utils/logger';
import { AnthropicProvider } from './anthropicProvider';
import { createGoogleProvider } from './googleProvider';
import { OllamaProvider } from './ollama';
import { OpenAICompatibleProvider } from './openaiProvider';
import { getAIProviderDefinition } from './providerRegistry';
import type { AIProviderType, ModelProvider } from './types';

export function createProvider(
  providerType: AIProviderType,
  baseUrl: string,
  model: string,
  apiKey?: string
): ModelProvider {
  const definition = getAIProviderDefinition(providerType);

  switch (definition.protocol) {
    case 'ollama':
      return new OllamaProvider(baseUrl, model);
    case 'anthropic':
      return new AnthropicProvider(baseUrl, apiKey || '', model);
    case 'google':
      return createGoogleProvider(baseUrl, apiKey || '', model);
    case 'openai-compatible': {
      const provider = new OpenAICompatibleProvider(baseUrl, apiKey || '', model);
      provider.name = providerType;
      return provider;
    }
  }

  logger.warn(`[AI Provider] Unsupported provider type: ${providerType}`);
  return new OllamaProvider(baseUrl, model);
}
