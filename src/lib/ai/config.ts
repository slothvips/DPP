import { db } from '@/db';
import type { SettingKey, SettingValue, StoredEncryptedValue } from '@/db/types';
import { decryptData, loadKey } from '@/lib/crypto/encryption';
import { logger } from '@/utils/logger';
import { DEFAULT_CONFIGS, createProvider } from './provider';
import type { AIProviderType, ModelProvider } from './types';

export interface AIProviderConfig {
  providerType: AIProviderType;
  baseUrl: string;
  model: string;
  apiKey: string;
  isAnthropicProvider: boolean;
}

function isAnthropicProvider(providerType: AIProviderType): boolean {
  return providerType === 'anthropic';
}

async function readSetting<K extends SettingKey>(key: K): Promise<SettingValue<K> | undefined> {
  const setting = await db.settings.get(key);
  return setting?.value as SettingValue<K> | undefined;
}

function isEncryptedValue(value: unknown): value is StoredEncryptedValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ciphertext' in value &&
    'iv' in value &&
    typeof value.ciphertext === 'string' &&
    typeof value.iv === 'string'
  );
}

async function resolveApiKey(value: unknown, logPrefix: string): Promise<string> {
  if (typeof value === 'string') {
    return value;
  }

  if (!isEncryptedValue(value)) {
    return '';
  }

  try {
    const encryptionKey = await loadKey();
    if (!encryptionKey) {
      return '';
    }

    const decrypted = await decryptData(value, encryptionKey);
    return typeof decrypted === 'string' ? decrypted : '';
  } catch (err) {
    logger.error(`${logPrefix} Failed to decrypt API key:`, err);
    return '';
  }
}

export async function loadAIProviderConfig(options?: {
  includeLegacyFallback?: boolean;
  logPrefix?: string;
}): Promise<AIProviderConfig> {
  const { includeLegacyFallback = true, logPrefix = '[AIConfig]' } = options ?? {};

  const providerType = (await readSetting('ai_provider_type')) || 'ollama';
  const defaults = DEFAULT_CONFIGS[providerType];

  const baseUrlKey = `ai_${providerType}_base_url` as const;
  const modelKey = `ai_${providerType}_model` as const;
  const apiKeyKey = `ai_${providerType}_api_key` as const;

  const [baseUrlValue, modelValue, apiKeyValue, legacyBaseUrl, legacyModel, legacyApiKey] =
    await Promise.all([
      readSetting(baseUrlKey),
      readSetting(modelKey),
      readSetting(apiKeyKey),
      includeLegacyFallback ? readSetting('ai_base_url') : Promise.resolve(undefined),
      includeLegacyFallback ? readSetting('ai_model') : Promise.resolve(undefined),
      includeLegacyFallback ? readSetting('ai_api_key') : Promise.resolve(undefined),
    ]);

  const baseUrl = baseUrlValue || legacyBaseUrl || defaults.baseUrl || '';
  const model = modelValue || legacyModel || defaults.model || '';
  const apiKey = await resolveApiKey(apiKeyValue || legacyApiKey, logPrefix);

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
