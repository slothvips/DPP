import { isAnthropicProvider, readAISetting, resolveAIApiKey } from './configShared';
import { DEFAULT_CONFIGS, createProvider } from './provider';
import type { AIProviderType, ModelProvider } from './types';

export interface AIProviderConfig {
  providerType: AIProviderType;
  baseUrl: string;
  model: string;
  apiKey: string;
  isAnthropicProvider: boolean;
}

export async function loadAIProviderConfig(options?: {
  includeLegacyFallback?: boolean;
  logPrefix?: string;
}): Promise<AIProviderConfig> {
  const { includeLegacyFallback = true, logPrefix = '[AIConfig]' } = options ?? {};

  const providerType = (await readAISetting('ai_provider_type')) || 'ollama';
  const defaults = DEFAULT_CONFIGS[providerType];

  const baseUrlKey = `ai_${providerType}_base_url` as const;
  const modelKey = `ai_${providerType}_model` as const;
  const apiKeyKey = `ai_${providerType}_api_key` as const;

  const [baseUrlValue, modelValue, apiKeyValue, legacyBaseUrl, legacyModel, legacyApiKey] =
    await Promise.all([
      readAISetting(baseUrlKey),
      readAISetting(modelKey),
      readAISetting(apiKeyKey),
      includeLegacyFallback ? readAISetting('ai_base_url') : Promise.resolve(undefined),
      includeLegacyFallback ? readAISetting('ai_model') : Promise.resolve(undefined),
      includeLegacyFallback ? readAISetting('ai_api_key') : Promise.resolve(undefined),
    ]);

  const baseUrl = baseUrlValue || legacyBaseUrl || defaults.baseUrl || '';
  const model = modelValue || legacyModel || defaults.model || '';
  const apiKey = await resolveAIApiKey(apiKeyValue || legacyApiKey, logPrefix);

  return {
    providerType,
    baseUrl,
    model,
    apiKey,
    isAnthropicProvider: isAnthropicProvider(providerType),
  };
}

export async function createConfiguredProvider(options?: {
  includeLegacyFallback?: boolean;
  logPrefix?: string;
}): Promise<AIProviderConfig & { provider: ModelProvider }> {
  const config = await loadAIProviderConfig(options);

  return {
    ...config,
    provider: createProvider(config.providerType, config.baseUrl, config.model, config.apiKey),
  };
}
