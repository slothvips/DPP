import { type EncryptedData, decryptData, encryptData, getKeyHash } from '@/lib/crypto/encryption';
import { logger } from '@/utils/logger';
import type { SyncOperation } from './types';

export async function encryptOperation(op: SyncOperation, key: CryptoKey): Promise<SyncOperation> {
  const sensitivePayload = {
    table: op.table,
    type: op.type,
    key: op.key,
    payload: op.payload,
  };
  const encrypted = await encryptData(sensitivePayload, key);
  const keyHash = await getKeyHash(key);

  return {
    ...op,
    table: 'encrypted',
    type: 'create', // Store as 'create' on server to append to log
    key: op.id, // Use op ID as key for the blob
    payload: encrypted,
    keyHash,
  };
}

export async function decryptOperation(op: SyncOperation, key: CryptoKey): Promise<SyncOperation> {
  const payload = op.payload as EncryptedData | null;

  if (op.table === 'encrypted' && payload?.ciphertext && payload?.iv) {
    try {
      const decrypted = (await decryptData(payload, key)) as Partial<SyncOperation>;
      return {
        ...op,
        ...decrypted,
      };
    } catch (e) {
      logger.error('[Sync] Decryption failed for op:', op.id, e);
      throw new Error(`无法解密数据 (ID: ${op.id})。请检查您的同步密钥是否正确。`);
    }
  }

  return op;
}
