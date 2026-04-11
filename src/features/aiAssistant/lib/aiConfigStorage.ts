import { db } from '@/db';
import { DEFAULT_CONFIGS } from '@/lib/ai/provider';
import type { AIProviderType } from '@/lib/ai/types';
import { decryptData, encryptData, loadKey } from '@/lib/crypto/encryption';
import { updateSetting } from '@/lib/db/settings';
import { logger } from '@/utils/logger';

export interface StoredAIConfig {
  provider: AIProviderType;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export async function loadAIConfig(): Promise<StoredAIConfig> {
  const providerSetting = await db.settings.where('key').equals('ai_provider_type').first();
  const provider = (providerSetting?.value as AIProviderType) || 'custom';
  return loadProviderConfig(provider);
}

export async function loadProviderConfig(provider: AIProviderType): Promise<StoredAIConfig> {
  const baseUrlKey = `ai_${provider}_base_url` as const;
  const modelKey = `ai_${provider}_model` as const;
  const apiKeyKey = `ai_${provider}_api_key` as const;

  const savedBaseUrl = await db.settings.where('key').equals(baseUrlKey).first();
  const savedModel = await db.settings.where('key').equals(modelKey).first();
  const savedApiKey = await db.settings.where('key').equals(apiKeyKey).first();

  return {
    provider,
    baseUrl: (savedBaseUrl?.value as string) || DEFAULT_CONFIGS[provider].baseUrl || '',
    model: (savedModel?.value as string) || DEFAULT_CONFIGS[provider].model || '',
    apiKey: await decryptApiKey(savedApiKey?.value),
  };
}

export async function saveAIConfig(config: StoredAIConfig): Promise<void> {
  const { provider, baseUrl, model, apiKey } = config;
  const baseUrlKey = `ai_${provider}_base_url` as const;
  const modelKey = `ai_${provider}_model` as const;
  const apiKeyKey = `ai_${provider}_api_key` as const;

  await updateSetting('ai_provider_type', provider);
  await updateSetting(baseUrlKey, baseUrl);
  await updateSetting(modelKey, model);

  if (apiKey) {
    const encryptionKey = await loadKey();
    if (encryptionKey) {
      const encrypted = await encryptData(apiKey, encryptionKey);
      await updateSetting(apiKeyKey, encrypted);
    } else {
      await updateSetting(apiKeyKey, apiKey);
    }
    return;
  }

  await updateSetting(apiKeyKey, '');
}

export async function isAIConfigConfigured(): Promise<boolean> {
  const providerSetting = await db.settings.where('key').equals('ai_provider_type').first();
  const provider = (providerSetting?.value as AIProviderType) || 'custom';
  const config = await loadProviderConfig(provider);

  return Boolean(config.baseUrl || config.model || config.apiKey);
}

async function decryptApiKey(value: unknown): Promise<string> {
  if (!value) {
    return '';
  }

  try {
    const encryptionKey = await loadKey();
    if (encryptionKey && typeof value === 'object') {
      const decrypted = await decryptData(
        value as { ciphertext: string; iv: string },
        encryptionKey
      );
      return decrypted as string;
    }

    return value as string;
  } catch (err) {
    logger.error('[AIConfig] Failed to decrypt API key:', err);
    return '';
  }
}
