import { logger } from '@/utils/logger';
import { AnthropicProvider } from './anthropicProvider';
import { OllamaProvider } from './ollama';
import { OpenAICompatibleProvider } from './openaiProvider';
import type { AIProviderType, ModelProvider } from './types';

export function createProvider(
  providerType: AIProviderType,
  baseUrl: string,
  model: string,
  apiKey?: string
): ModelProvider {
  switch (providerType) {
    case 'ollama':
      return new OllamaProvider(baseUrl, model);
    case 'custom':
      return new OpenAICompatibleProvider(baseUrl, apiKey || '', model);
    case 'anthropic':
      return new AnthropicProvider(baseUrl, apiKey || '', model);
    default:
      logger.warn(`[AI Provider] Unknown provider type: ${providerType}, falling back to Ollama`);
      return new OllamaProvider(baseUrl, model);
  }
}
