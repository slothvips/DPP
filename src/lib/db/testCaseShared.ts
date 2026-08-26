import { decryptData, encryptData, loadKey } from '@/lib/crypto/encryption';
import type { EncryptedData } from '@/lib/crypto/encryption';

export async function encryptTestCaseContent(content: unknown): Promise<EncryptedData> {
  const key = await loadKey();
  if (!key) {
    throw new Error('未配置团队加密密钥，无法保存共享测试用例');
  }
  return encryptData(content, key);
}

export async function decryptTestCaseContent<T>(encryptedContent: EncryptedData): Promise<T> {
  const key = await loadKey();
  if (!key) {
    throw new Error('未配置团队加密密钥，无法读取共享测试用例');
  }
  return (await decryptData(encryptedContent, key)) as T;
}
