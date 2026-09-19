import {
  loadAIConfig,
  migrateUnscopedLegacyAISettings,
} from '@/features/aiAssistant/lib/aiConfigStorage';
import { logger } from '@/utils/logger';
import { readAISetting, resolveAIApiKey } from './configShared';
import { createProvider } from './provider';
import { getAIProviderDefinition } from './providerRegistry';
import type { AIProviderType, ModelProvider } from './types';

export interface AIProviderConfig {
  providerType: AIProviderType;
  displayName: string;
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

  if (includeLegacyFallback) {
    // 旧版无前缀 ai_base_url/ai_model/ai_api_key 不再直接参与读取：
    // 先按旧优先级合并进 profile 并删除旧键，失败时回退旧的覆盖逻辑
    try {
      await migrateUnscopedLegacyAISettings();
    } catch (error) {
      logger.error('[AIConfig] Failed to migrate legacy AI settings:', error);
      return loadLegacyFallbackConfig(options);
    }
  }

  const config = await loadAIConfig();
  return {
    providerType: config.provider,
    displayName: config.displayName ?? getAIProviderDefinition(config.provider).label,
    baseUrl: config.baseUrl,
    model: config.model,
    apiKey: config.apiKey,
    contextWindow: config.contextWindow,
    visionEnabled: config.visionEnabled === true,
  };
}

/** 旧行为：无前缀 legacy 键优先于激活 profile。仅在迁移失败时回退使用。 */
async function loadLegacyFallbackConfig(options?: {
  logPrefix?: string;
}): Promise<AIProviderConfig> {
  const config = await loadAIConfig();
  const [legacyBaseUrl, legacyModel, legacyApiKeyValue] = await Promise.all([
    readAISetting('ai_base_url'),
    readAISetting('ai_model'),
    readAISetting('ai_api_key'),
  ]);
  const baseUrl = legacyBaseUrl || config.baseUrl;
  const model = legacyModel || config.model;
  const apiKey = legacyApiKeyValue
    ? await resolveAIApiKey(legacyApiKeyValue, options?.logPrefix ?? '[AIConfig]')
    : config.apiKey;

  return {
    providerType: config.provider,
    displayName: config.displayName ?? getAIProviderDefinition(config.provider).label,
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
