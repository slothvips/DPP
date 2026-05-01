import { readAISetting, resolveAIApiKey } from '@/lib/ai/configShared';
import { DEFAULT_CONFIGS } from '@/lib/ai/provider';
import type { AIProviderType } from '@/lib/ai/types';
import { encryptData, loadKey } from '@/lib/crypto/encryption';
import { updateSetting } from '@/lib/db/settings';

export interface StoredAIConfig {
  provider: AIProviderType;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export async function loadAIConfig(): Promise<StoredAIConfig> {
  const provider = (await readAISetting('ai_provider_type')) || 'ollama';
  return loadProviderConfig(provider);
}

export async function loadProviderConfig(provider: AIProviderType): Promise<StoredAIConfig> {
  const baseUrlKey = `ai_${provider}_base_url` as const;
  const modelKey = `ai_${provider}_model` as const;
  const apiKeyKey = `ai_${provider}_api_key` as const;

  const [savedBaseUrl, savedModel, savedApiKey] = await Promise.all([
    readAISetting(baseUrlKey),
    readAISetting(modelKey),
    readAISetting(apiKeyKey),
  ]);

  return {
    provider,
    baseUrl: savedBaseUrl || DEFAULT_CONFIGS[provider].baseUrl || '',
    model: savedModel || DEFAULT_CONFIGS[provider].model || '',
    apiKey: await resolveAIApiKey(savedApiKey, '[AIConfig]'),
  };
}

export async function saveAIConfig(config: StoredAIConfig): Promise<void> {
  await saveProviderConfig(config, { activateProvider: true });
}

export async function saveProviderConfig(
  config: StoredAIConfig,
  options: { activateProvider?: boolean; preserveApiKey?: boolean } = {}
): Promise<void> {
  const { provider, baseUrl, model, apiKey } = config;
  const { activateProvider = false, preserveApiKey = false } = options;
  const baseUrlKey = `ai_${provider}_base_url` as const;
  const modelKey = `ai_${provider}_model` as const;
  const apiKeyKey = `ai_${provider}_api_key` as const;

  const updates: Array<Promise<void>> = [
    updateSetting(baseUrlKey, baseUrl),
    updateSetting(modelKey, model),
  ];

  if (activateProvider) {
    updates.push(updateSetting('ai_provider_type', provider));
  }

  if (!preserveApiKey) {
    let storedApiKey: string | Awaited<ReturnType<typeof encryptData>> = '';
    if (apiKey) {
      const encryptionKey = await loadKey();
      storedApiKey = encryptionKey ? await encryptData(apiKey, encryptionKey) : apiKey;
    }
    updates.push(updateSetting(apiKeyKey, storedApiKey));
  }

  await Promise.all(updates);
}

export async function isAIConfigConfigured(): Promise<boolean> {
  const config = await loadAIConfig();

  return Boolean(config.baseUrl || config.model || config.apiKey);
}
