import { exportKey, generateSyncKey, importKey } from '@/lib/crypto/encryption';
import { deleteSetting, getSetting, updateSetting } from '@/lib/db/settings';

const PERSONAL_ENCRYPTION_KEY_SETTING = 'personal_encryption_key' as const;

/** 存储个人私钥（与团队同步密钥完全独立） */
export async function storePersonalKey(key: CryptoKey): Promise<void> {
  const base64Key = await exportKey(key);
  await updateSetting(PERSONAL_ENCRYPTION_KEY_SETTING, base64Key);
}

export async function loadPersonalKey(): Promise<CryptoKey | null> {
  const base64Key = await getSetting(PERSONAL_ENCRYPTION_KEY_SETTING);
  if (typeof base64Key !== 'string' || !base64Key) {
    return null;
  }
  return importKey(base64Key);
}

export async function clearPersonalKey(): Promise<void> {
  await deleteSetting(PERSONAL_ENCRYPTION_KEY_SETTING);
}

export async function generateAndStorePersonalKey(): Promise<CryptoKey> {
  const key = await generateSyncKey();
  await storePersonalKey(key);
  return key;
}

export async function importAndStorePersonalKey(base64Key: string): Promise<CryptoKey> {
  const key = await importKey(base64Key.trim());
  await storePersonalKey(key);
  return key;
}

/** 是否已配置个人私钥 */
export async function hasPersonalKey(): Promise<boolean> {
  const base64Key = await getSetting(PERSONAL_ENCRYPTION_KEY_SETTING);
  return typeof base64Key === 'string' && base64Key.length > 0;
}

/** 校验用户输入的个人私钥是否与本机存储一致 */
export async function verifyPersonalKeyInput(input: string): Promise<boolean> {
  const stored = await getSetting(PERSONAL_ENCRYPTION_KEY_SETTING);
  if (typeof stored !== 'string' || !stored) return false;
  return stored === input.trim();
}
