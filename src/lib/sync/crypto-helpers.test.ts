import { beforeAll, describe, expect, it } from 'vitest';
import { generateSyncKey } from '@/lib/crypto/encryption';
import { decryptOperation, encryptOperation } from './crypto-helpers';
import type { SyncOperation } from './types';

describe('encryptOperation - keyHash presence', () => {
  let testKey: CryptoKey;

  beforeAll(async () => {
    testKey = await generateSyncKey();
  });

  it('should include keyHash in encrypted operation', async () => {
    const originalOp: SyncOperation = {
      id: 'test-op-1',
      clientId: 'test-client',
      table: 'links',
      type: 'create',
      key: 'link-123',
      payload: { id: 'link-123', name: 'Test Link' },
      timestamp: Date.now(),
      synced: 0,
    };

    const encrypted = await encryptOperation(originalOp, testKey);

    expect(encrypted.keyHash).toBeDefined();
    if (encrypted.keyHash) {
      expect(typeof encrypted.keyHash).toBe('string');
      expect(encrypted.keyHash.length).toBe(16);
    }
  });

  it('should produce consistent keyHash for same key', async () => {
    const op1: SyncOperation = {
      id: 'test-op-1',
      table: 'links',
      type: 'create',
      key: 'link-1',
      payload: { name: 'Link 1' },
      timestamp: Date.now(),
      synced: 0,
    };

    const op2: SyncOperation = {
      id: 'test-op-2',
      table: 'tags',
      type: 'create',
      key: 'tag-1',
      payload: { name: 'Tag 1' },
      timestamp: Date.now(),
      synced: 0,
    };

    const encrypted1 = await encryptOperation(op1, testKey);
    const encrypted2 = await encryptOperation(op2, testKey);

    expect(encrypted1.keyHash).toBeDefined();
    expect(encrypted2.keyHash).toBeDefined();
    if (encrypted1.keyHash && encrypted2.keyHash) {
      expect(encrypted1.keyHash).toBe(encrypted2.keyHash);
    }
  });

  it('should preserve keyHash through encryption roundtrip', async () => {
    const originalOp: SyncOperation = {
      id: 'test-op-roundtrip',
      table: 'links',
      type: 'update',
      key: 'link-456',
      payload: { id: 'link-456', name: 'Updated' },
      timestamp: Date.now(),
      synced: 0,
    };

    const encrypted = await encryptOperation(originalOp, testKey);
    const decrypted = await decryptOperation(encrypted, testKey);

    expect(encrypted.keyHash).toBeDefined();
    expect(decrypted.keyHash).toBe(encrypted.keyHash);
  });

  it('should mark encrypted operations with table=encrypted', async () => {
    const originalOp: SyncOperation = {
      id: 'test-op-table',
      table: 'myTable',
      type: 'delete',
      key: 'item-789',
      payload: null,
      timestamp: Date.now(),
      synced: 0,
    };

    const encrypted = await encryptOperation(originalOp, testKey);

    expect(encrypted.table).toBe('encrypted');
    expect(encrypted.type).toBe('create');
    expect(encrypted.keyHash).toBeDefined();
  });
});
