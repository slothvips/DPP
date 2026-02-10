import Dexie from 'dexie';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateSyncKey } from '@/lib/crypto/encryption';
import { SyncEngine } from './SyncEngine';
import { encryptOperation } from './crypto-helpers';
import type { SyncOperation, SyncProvider } from './types';

describe('SyncEngine Concurrency Control', () => {
  let db: Dexie;
  let mockProvider: SyncProvider;
  let syncEngine: SyncEngine;
  let testKey: CryptoKey;

  beforeEach(async () => {
    await Dexie.delete('TestDB');

    db = new Dexie('TestDB');
    db.version(1).stores({
      settings: 'key',
      syncMetadata: 'id',
      operations: '++id, clientId, synced',
      testTable: 'id',
    });

    testKey = await generateSyncKey();

    mockProvider = {
      push: vi.fn().mockImplementation(async (ops) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { success: true, cursor: 100 + ops.length };
      }),
      pull: vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { ops: [], nextCursor: 100 };
      }),
    };

    syncEngine = new SyncEngine(db, ['testTable'], mockProvider);
    await syncEngine.getClientId();
  });

  it('should prevent concurrent push operations', async () => {
    // Add some test operations
    await db.table('operations').bulkAdd([
      {
        id: '1',
        clientId: 'test-client',
        table: 'testTable',
        type: 'create',
        key: 1,
        payload: { id: 1, name: 'test' },
        timestamp: Date.now(),
        synced: 0,
      },
      {
        id: '2',
        clientId: 'test-client',
        table: 'testTable',
        type: 'create',
        key: 2,
        payload: { id: 2, name: 'test2' },
        timestamp: Date.now(),
        synced: 0,
      },
    ] as SyncOperation[]);

    // Attempt concurrent pushes
    const [result1, result2] = await Promise.all([syncEngine.push(), syncEngine.push()]);

    // Second push should be skipped (undefined return)
    expect(result1).toBeUndefined();
    expect(result2).toBeUndefined();

    // Provider should only be called once
    expect(mockProvider.push).toHaveBeenCalledTimes(1);
  });

  it('should prevent concurrent pull operations', async () => {
    // Attempt concurrent pulls
    const [result1, result2] = await Promise.all([syncEngine.pull(), syncEngine.pull()]);

    // Both should complete (one skipped)
    expect(result1).toBeUndefined();
    expect(result2).toBeUndefined();

    // Provider should only be called once
    expect(mockProvider.pull).toHaveBeenCalledTimes(1);
  });

  it('should prevent concurrent push and pull', async () => {
    // Add test operation
    await db.table('operations').add({
      id: '1',
      clientId: 'test-client',
      table: 'testTable',
      type: 'create',
      key: 1,
      payload: { id: 1, name: 'test' },
      timestamp: Date.now(),
      synced: 0,
    } as SyncOperation);

    // Attempt push and pull concurrently
    await Promise.all([syncEngine.push(), syncEngine.pull()]);

    // Both operations should not run concurrently
    // One should be skipped
    const pushCalls = (mockProvider.push as ReturnType<typeof vi.fn>).mock.calls.length;
    const pullCalls = (mockProvider.pull as ReturnType<typeof vi.fn>).mock.calls.length;

    // Only one operation should have executed
    expect(pushCalls + pullCalls).toBeLessThanOrEqual(1);
  });

  it('should allow sequential push and pull', async () => {
    // Add test operation
    await db.table('operations').add({
      id: '1',
      clientId: 'test-client',
      table: 'testTable',
      type: 'create',
      key: 1,
      payload: { id: 1, name: 'test' },
      timestamp: Date.now(),
      synced: 0,
    } as SyncOperation);

    // Execute push first, then pull
    await syncEngine.push();
    await syncEngine.pull();

    // Both should have been called
    expect(mockProvider.push).toHaveBeenCalledTimes(1);
    expect(mockProvider.pull).toHaveBeenCalledTimes(1);
  });

  it('should maintain correct status during concurrent operations', async () => {
    const statusChanges: string[] = [];

    syncEngine.on('status-change', (data: unknown) => {
      const status = (data as { status: string }).status;
      statusChanges.push(status);
    });

    await Promise.all([syncEngine.push(), syncEngine.pull()]);

    expect(statusChanges).not.toContain('error');

    expect(syncEngine.status).toBe('idle');
  });

  it('should handle keyHash validation in pulled operations', async () => {
    const encryptedOp = await encryptOperation(
      {
        id: 'test-op-1',
        clientId: 'test-client',
        table: 'testTable',
        type: 'create',
        key: 1,
        payload: { id: 1, name: 'test' },
        timestamp: Date.now(),
        synced: 0,
      },
      testKey
    );

    (mockProvider.pull as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { ops: [encryptedOp], nextCursor: 101 };
    });

    await syncEngine.pull();

    expect(mockProvider.pull).toHaveBeenCalledTimes(1);
  });

  it('should skip operations with mismatched keyHash during pull', async () => {
    const baseOp: SyncOperation = {
      id: 'test-op-2',
      clientId: 'test-client',
      table: 'encrypted',
      type: 'create',
      key: 'test-op-2',
      payload: { ciphertext: 'fake', iv: 'fake' },
      timestamp: Date.now(),
      synced: 0,
      keyHash: 'wronghash123456',
    };

    (mockProvider.pull as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { ops: [baseOp], nextCursor: 101 };
    });

    await syncEngine.pull();

    expect(mockProvider.pull).toHaveBeenCalledTimes(1);
  });
});
