import { db } from '@/db';
import type { SettingKey, SettingValue, StoredEncryptedValue } from '@/db/types';
import { decryptData, loadKey } from '@/lib/crypto/encryption';
import { logger } from '@/utils/logger';
import type { AIProviderType } from './types';

export function isAnthropicProvider(providerType: AIProviderType): boolean {
  return providerType === 'anthropic';
}

export async function readAISetting<K extends SettingKey>(
  key: K
): Promise<SettingValue<K> | undefined> {
  const setting = await db.settings.get(key);
  return setting?.value as SettingValue<K> | undefined;
}

export function isEncryptedValue(value: unknown): value is StoredEncryptedValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ciphertext' in value &&
    'iv' in value &&
    typeof value.ciphertext === 'string' &&
    typeof value.iv === 'string'
  );
}

export async function resolveAIApiKey(value: unknown, logPrefix: string): Promise<string> {
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
