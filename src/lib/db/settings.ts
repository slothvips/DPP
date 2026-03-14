import { db } from '@/db';
import type { Setting, SettingKey } from '@/db/types';
import { DEFAULT_CONFIGS } from '@/lib/ai/provider';
import type { AIProviderType } from '@/lib/ai/types';
import { decryptData, loadKey } from '@/lib/crypto/encryption';

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const setting = await db.settings.get(key as SettingKey);
  return setting?.value as T | undefined;
}

/**
 * Get a setting by key, returns the full Setting object
 */
export async function getSettingByKey(key: string): Promise<Setting | undefined> {
  return db.settings.where('key').equals(key).first() as Promise<Setting | undefined>;
}

export async function updateSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key: key as SettingKey, value });
}

/**
 * Delete a setting by key
 */
export async function deleteSetting(key: string): Promise<void> {
  await db.settings.delete(key as SettingKey);
}

/**
 * AI 配置结果（包含解密后的 API Key）
 */
export interface AIConfigResult {
  provider: AIProviderType;
  baseUrl: string;
  model: string;
  apiKey: string;
}

/**
 * 获取 AI 配置（包含解密后的 API Key）
 * 复用 AIConfigDialog 中的配置读取逻辑
 */
export async function getAIConfig(): Promise<AIConfigResult | null> {
  try {
    // 1. 读取 provider 类型
    const providerSetting = await db.settings.where('key').equals('ai_provider_type').first();
    const provider = (providerSetting?.value as AIProviderType) || 'custom';

    // 2. 读取 provider 特定配置
    const baseUrlKey = `ai_${provider}_base_url`;
    const modelKey = `ai_${provider}_model`;
    const apiKeyKey = `ai_${provider}_api_key`;

    const baseUrlSetting = await db.settings.where('key').equals(baseUrlKey).first();
    const modelSetting = await db.settings.where('key').equals(modelKey).first();
    const apiKeySetting = await db.settings.where('key').equals(apiKeyKey).first();

    const baseUrl = (baseUrlSetting?.value as string) || DEFAULT_CONFIGS[provider]?.baseUrl || '';
    const model = (modelSetting?.value as string) || DEFAULT_CONFIGS[provider]?.model || '';

    // 3. 解密 API Key
    let apiKey = '';
    if (apiKeySetting?.value) {
      try {
        const encryptionKey = await loadKey();
        if (encryptionKey) {
          apiKey = (await decryptData(
            apiKeySetting.value as { ciphertext: string; iv: string },
            encryptionKey
          )) as string;
        } else {
          apiKey = apiKeySetting.value as string;
        }
      } catch {
        apiKey = '';
      }
    }

    return { provider, baseUrl, model, apiKey };
  } catch (error) {
    console.error('[getAIConfig] Failed to load config:', error);
    return null;
  }
}
