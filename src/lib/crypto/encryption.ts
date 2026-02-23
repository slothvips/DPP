import { browser } from 'wxt/browser';
import { db } from '@/db';
import { logger } from '@/utils/logger';

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

export interface EncryptedData {
  ciphertext: string;
  iv: string;
}

/**
 * Generate a new random AES-GCM 256-bit key
 */
export async function generateSyncKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: ALGORITHM,
      length: KEY_LENGTH,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Export key to Base64 string for sharing/storage
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(exported);
}

/**
 * Import key from Base64 string
 */
export async function importKey(base64Key: string): Promise<CryptoKey> {
  const rawKey = base64ToArrayBuffer(base64Key);
  return await crypto.subtle.importKey(
    'raw',
    rawKey,
    {
      name: ALGORITHM,
      length: KEY_LENGTH,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt arbitrary data (JSON serializable)
 */
export async function encryptData(data: unknown, key: CryptoKey): Promise<EncryptedData> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(JSON.stringify(data));

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv,
    },
    key,
    encodedData
  );

  return {
    ciphertext: arrayBufferToBase64(encryptedBuffer),
    iv: arrayBufferToBase64(iv.buffer),
  };
}

/**
 * Decrypt data
 */
export async function decryptData(encrypted: EncryptedData, key: CryptoKey): Promise<unknown> {
  const iv = base64ToArrayBuffer(encrypted.iv);
  const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv,
    },
    key,
    ciphertext
  );

  const decodedString = new TextDecoder().decode(decryptedBuffer);
  return JSON.parse(decodedString);
}

export async function storeKey(key: CryptoKey): Promise<void> {
  const base64Key = await exportKey(key);
  await db.settings.put({ key: 'sync_encryption_key', value: base64Key });
}

export async function loadKey(): Promise<CryptoKey | null> {
  const setting = await db.settings.get('sync_encryption_key');
  let base64Key = setting?.value as string | undefined;

  if (!base64Key) {
    const legacyResult = await browser.storage.local.get('sync_encryption_key');
    base64Key = legacyResult.sync_encryption_key as string | undefined;

    if (base64Key) {
      await db.settings.put({ key: 'sync_encryption_key', value: base64Key });
      await browser.storage.local.remove('sync_encryption_key');
    }
  }

  if (!base64Key) {
    return null;
  }

  return await importKey(base64Key);
}

export async function clearKey(): Promise<void> {
  await db.settings.delete('sync_encryption_key');
}

/**
 * Verify if a Base64 key string is valid and usable
 */
export async function verifyKey(base64Key: string): Promise<boolean> {
  try {
    const key = await importKey(base64Key);
    // Try to encrypt and decrypt something to verify the key works
    const verificationData = { check: 'verification' };
    const encrypted = await encryptData(verificationData, key);
    const decrypted = await decryptData(encrypted, key);
    return JSON.stringify(decrypted) === JSON.stringify(verificationData);
  } catch (error) {
    logger.error('Failed to verify key:', error);
    return false;
  }
}

/**
 * Compute a short hash (first 8 bytes of SHA-256) of the key for identification.
 * This helps distinguish data encrypted with different keys during rotation.
 */
export async function getKeyHash(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', raw);
  const hashArray = Array.from(new Uint8Array(hashBuffer)).slice(0, 8);
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// --- Helpers ---

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
