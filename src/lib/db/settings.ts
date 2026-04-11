import { db } from '@/db';
import type { Setting, SettingKey, SettingValue } from '@/db/types';
import { loadAIProviderConfig } from '@/lib/ai/config';
import type { AIProviderType } from '@/lib/ai/types';

export async function getSetting<K extends SettingKey>(
  key: K
): Promise<SettingValue<K> | undefined>;
export async function getSetting<T>(key: string): Promise<T | undefined>;
export async function getSetting(key: string): Promise<unknown> {
  const setting = await db.settings.get(key as SettingKey);
  return setting?.value;
}

/**
 * Get a setting by key, returns the full Setting object
 */
export async function getSettingByKey<K extends SettingKey>(
  key: K
): Promise<Setting<K> | undefined>;
export async function getSettingByKey(key: string): Promise<Setting | undefined>;
export async function getSettingByKey(key: string): Promise<Setting | undefined> {
  return db.settings.get(key as SettingKey) as Promise<Setting | undefined>;
}

export async function updateSetting<K extends SettingKey>(
  key: K,
  value: SettingValue<K>
): Promise<void> {
  const existing = await db.settings.get(key);
  if (existing && Object.is(existing.value, value)) {
    return;
  }

  await db.settings.put({ key, value });
}

/**
 * Delete a setting by key
 */
export async function deleteSetting<K extends SettingKey>(key: K): Promise<void> {
  await db.settings.delete(key);
}

/**
 * AI 配置结果（包含解密后的 API Key）
 */
export interface AIConfigResult {
  provider: AIProviderType;
  baseUrl: string;
  model: string;
  apiKey: string;
  isAnthropicProvider: boolean;
}

function isAnthropicProvider(provider: AIProviderType, _baseUrl: string): boolean {
  return provider === 'anthropic';
}

/**
 * 获取 AI 配置（包含解密后的 API Key）
 * 复用 AIConfigDialog 中的配置读取逻辑
 */
export async function getAIConfig(): Promise<AIConfigResult | null> {
  try {
    const config = await loadAIProviderConfig({
      includeLegacyFallback: false,
      logPrefix: '[Settings]',
    });

    return {
      provider: config.providerType,
      baseUrl: config.baseUrl,
      model: config.model,
      apiKey: config.apiKey,
      isAnthropicProvider: isAnthropicProvider(config.providerType, config.baseUrl),
    };
  } catch {
    return null;
  }
}
