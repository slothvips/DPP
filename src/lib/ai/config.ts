import { loadAIConfig } from '@/features/aiAssistant/lib/aiConfigStorage';
import { readAISetting, resolveAIApiKey } from './configShared';
import { createProvider } from './provider';
import type { AIProviderType, ModelProvider } from './types';

export interface AIProviderConfig {
  providerType: AIProviderType;
  baseUrl: string;
  model: string;
  apiKey: string;
  contextWindow?: number;
  visionEnabled: boolean;
}

export async function loadAIProviderConfig(options?: {
  includeLegacyFallback?: boolean;
  logPrefix?: string;
}): Promise<AIProviderConfig> {
  const { includeLegacyFallback = true } = options ?? {};

  const config = await loadAIConfig();
  const legacy = includeLegacyFallback
    ? {
        baseUrl: readAISetting('ai_base_url'),
        model: readAISetting('ai_model'),
        apiKey: readAISetting('ai_api_key'),
      }
    : undefined;
  const [legacyBaseUrl, legacyModel, legacyApiKeyValue] = legacy
    ? await Promise.all([legacy.baseUrl, legacy.model, legacy.apiKey])
    : [undefined, undefined, undefined];
  const baseUrl = legacyBaseUrl || config.baseUrl;
  const model = legacyModel || config.model;
  const apiKey = legacyApiKeyValue
    ? await resolveAIApiKey(legacyApiKeyValue, options?.logPrefix ?? '[AIConfig]')
    : config.apiKey;

  return {
    providerType: config.provider,
    baseUrl,
    model,
    apiKey,
    contextWindow: config.contextWindow,
    visionEnabled: config.visionEnabled === true,
  };
}

export async function createConfiguredProvider(options?: {
  includeLegacyFallback?: boolean;
  logPrefix?: string;
}): Promise<AIProviderConfig & { provider: ModelProvider }> {
  const config = await loadAIProviderConfig(options);

  return {
    ...config,
    provider: createProvider(
      config.providerType,
      config.baseUrl,
      config.model,
      config.apiKey,
      config.contextWindow
    ),
  };
}
