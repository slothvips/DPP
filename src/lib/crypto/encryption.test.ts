import { describe, expect, it } from 'vitest';
import {
  clearKey,
  decryptData,
  encryptData,
  generateSyncKey,
  loadKey,
  storeKey,
} from './encryption';

describe('Encryption', () => {
  it('should generate a sync key', async () => {
    const key = await generateSyncKey();
    expect(key).toBeDefined();
    expect(key.algorithm.name).toBe('AES-GCM');
    expect(key.extractable).toBe(true);
  });

  it('should encrypt and decrypt data correctly (round trip)', async () => {
    const key = await generateSyncKey();
    const data = { message: 'hello world', secret: 12345 };

    const encrypted = await encryptData(data, key);
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();

    const decrypted = await decryptData(encrypted, key);
    expect(decrypted).toEqual(data);
  });

  it('should store and load the key from storage', async () => {
    const key = await generateSyncKey();

    await storeKey(key);
    const loadedKey = await loadKey();

    expect(loadedKey).toBeDefined();

    // Test if the loaded key can actually decrypt something encrypted with the original key
    const data = { test: 'storage' };
    const encrypted = await encryptData(data, key);
    if (!loadedKey) throw new Error('Key should be defined');
    const decrypted = await decryptData(encrypted, loadedKey);

    expect(decrypted).toEqual(data);
  });

  it('should return null when loading a non-existent key', async () => {
    await clearKey();
    const key = await loadKey();
    expect(key).toBeNull();
  });

  it('should clear the key from storage', async () => {
    const key = await generateSyncKey();
    await storeKey(key);

    await clearKey();
    const loadedKey = await loadKey();
    expect(loadedKey).toBeNull();
  });
});
