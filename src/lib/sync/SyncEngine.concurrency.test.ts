import Dexie from 'dexie';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncEngine } from './SyncEngine';
import type { SyncOperation, SyncProvider } from './types';

describe('SyncEngine Concurrency Control', () => {
  let db: Dexie;
  let mockProvider: SyncProvider;
  let syncEngine: SyncEngine;

  beforeEach(async () => {
    // Delete any existing database
    await Dexie.delete('TestDB');

    // Create in-memory test database
    db = new Dexie('TestDB');
    db.version(1).stores({
      settings: 'key',
      syncMetadata: 'id',
      operations: '++id, clientId, synced',
      testTable: 'id',
    });

    // Mock provider
    mockProvider = {
      push: vi.fn().mockImplementation(async (ops) => {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { success: true, cursor: 100 + ops.length };
      }),
      pull: vi.fn().mockImplementation(async () => {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { ops: [], nextCursor: 100 };
      }),
    };

    syncEngine = new SyncEngine(db, ['testTable'], mockProvider);
    await syncEngine.getClientId(); // Initialize client ID
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

    // Attempt concurrent operations
    await Promise.all([syncEngine.push(), syncEngine.pull()]);

    // Status should transition cleanly without overlapping
    // Expected: pushing/pulling -> idle (or just idle if skipped)
    expect(statusChanges).not.toContain('error');

    // Should end in idle state
    expect(syncEngine.status).toBe('idle');
  });
});
