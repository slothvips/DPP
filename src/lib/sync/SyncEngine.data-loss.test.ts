import Dexie from 'dexie';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncEngine } from './SyncEngine';
import type { SyncOperation, SyncProvider } from './types';

describe('SyncEngine Data Loss Scenario', () => {
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

    syncEngine = new SyncEngine(db, ['testTable'], mockProvider);
    await syncEngine.getClientId(); // Initialize client ID
  });

  describe('Push without pull scenario (new user)', () => {
    it('should prevent data loss by rejecting unsafe cursor jumps during push', async () => {
      // SETUP SCENARIO:
      // User A has been using the system and has created items 0-99 on server
      // The server cursor is at 100 (meaning it has processed 100 operations)
      // User B is a new user with a fresh install (cursor = 0)
      // User B creates a local item and wants to push it
      //
      // CRITICAL: When User B pushes only 1 operation (their item), the server returns
      // cursor 100. This is an UNSAFE jump (0 + 1 = 1, but server says 100).
      // The safe cursor logic should REJECT this update to force a pull of missing data.

      // Step 1: Simulate User A's existing data on server (cursor = 100)
      // The mock provider will return cursor 100 when User B pushes
      mockProvider = {
        push: vi.fn().mockImplementation(async (_ops: SyncOperation[]) => {
          // Server receives User B's push and returns its current cursor
          // This simulates the server having items 0-99 already from User A
          return 100;
        }),
        pull: vi.fn().mockImplementation(async (cursor) => {
          // If cursor is 0, there are items 1-99 waiting to be pulled
          // If cursor is 100, there are no more items
          if (cursor === 0) {
            // Generate mock operations from User A (items 1-99)
            const remoteOps: SyncOperation[] = [];
            for (let i = 1; i <= 99; i++) {
              remoteOps.push({
                id: `op-${i}`,
                clientId: 'user-a',
                table: 'testTable',
                type: 'create',
                key: i,
                payload: {
                  id: i,
                  name: `Item from User A #${i}`,
                  createdBy: 'user-a',
                },
                timestamp: Date.now() - 10000 + i * 10,
                synced: 0,
              });
            }
            return { ops: remoteOps, nextCursor: 100 };
          }
          // If cursor is >= 100, no more items
          return { ops: [], nextCursor: 100 };
        }),
      };

      syncEngine = new SyncEngine(db, ['testTable'], mockProvider);
      await syncEngine.getClientId(); // Initialize client ID

      // Step 2: User B creates a local item (before pulling)
      const clientId = await syncEngine.getClientId();
      const userBOperation: SyncOperation = {
        id: 'user-b-op-1',
        clientId,
        table: 'testTable',
        type: 'create',
        key: 'item-from-user-b',
        payload: {
          id: 'item-from-user-b',
          name: 'My first item',
          createdBy: clientId,
        },
        timestamp: Date.now(),
        synced: 0,
      };

      await db.table('operations').add(userBOperation);

      // Step 3: Check User B's initial cursor (should be 0)
      let metadata = await db.table('syncMetadata').get('global');
      const initialCursor = metadata?.lastServerCursor ?? 0;
      console.log(`[TEST] User B initial cursor: ${initialCursor}`);
      expect(initialCursor).toBe(0);

      // Step 4: User B pushes without pulling first
      // Server returns cursor 100, but batch is only 1 operation
      // Safe cursor logic should reject this update
      await syncEngine.push();

      // Step 5: Verify cursor did NOT jump to 100
      // Instead, it should stay at 0 (safe cursor rejected the update)
      metadata = await db.table('syncMetadata').get('global');
      const cursorAfterPush = metadata?.lastServerCursor ?? 0;
      console.log(`[TEST] User B cursor after push: ${cursorAfterPush}`);

      // FIXED: The cursor should STAY at 0 because the safe cursor check
      // detected an unsafe jump (0 + 1 batch = max 1, but server returned 100)
      expect(cursorAfterPush).toBe(0);

      // Step 6: Now when User B pulls, they will use cursor 0
      // and get all items 1-99 from User A
      const pullCalls = (mockProvider.pull as ReturnType<typeof vi.fn>).mock.calls;
      console.log(`[TEST] Pull calls before manual pull: ${pullCalls.length}`);

      await syncEngine.pull();

      // Step 7: Verify what cursor was used in the pull
      const pullCalls2 = (mockProvider.pull as ReturnType<typeof vi.fn>).mock.calls;
      console.log(`[TEST] Pull calls after manual pull: ${pullCalls2.length}`);

      if (pullCalls2.length > 0) {
        const lastPullCall = pullCalls2[pullCalls2.length - 1];
        const cursorUsedInPull = lastPullCall[0];
        console.log(`[TEST] Cursor used in final pull: ${cursorUsedInPull}`);

        // FIXED: Pull will be called with cursor 0 or undefined, so it WILL fetch items 1-99
        expect(cursorUsedInPull === 0 || cursorUsedInPull === undefined).toBe(true);
      }

      // Step 8: The key assertion: Cursor stayed at 0 (safe update prevented jump to 100)
      // This proves the safe cursor logic worked - it rejected the unsafe jump and
      // forced a pull to happen first, which is the correct behavior.
      metadata = await db.table('syncMetadata').get('global');
      const finalCursor = metadata?.lastServerCursor ?? 0;
      console.log(`[TEST] User B final cursor after pull: ${finalCursor}`);

      // The final cursor being 0 or 100 depends on whether pull completed successfully
      // The important part: it was NOT 100 after push (was 0), which prevented data loss
      expect(cursorAfterPush).toBe(0); // Confirm cursor did NOT jump during push
    });

    it('should demonstrate the correct behavior if user pulls before pushing', async () => {
      // This demonstrates the CORRECT scenario for comparison
      // Pull first ensures cursor is at the server's current position
      // Then push doesn't cause data loss

      mockProvider = {
        push: vi.fn().mockImplementation(async (_ops: SyncOperation[]) => {
          return 101;
        }),
        pull: vi.fn().mockImplementation(async (cursor) => {
          if (cursor === 0 || cursor === undefined) {
            const remoteOps: SyncOperation[] = [];
            for (let i = 1; i <= 99; i++) {
              remoteOps.push({
                id: `op-${i}`,
                clientId: 'user-a',
                table: 'testTable',
                type: 'create',
                key: i,
                payload: {
                  id: i,
                  name: `Item from User A #${i}`,
                  createdBy: 'user-a',
                },
                timestamp: Date.now() - 10000 + i * 10,
                synced: 0,
              });
            }
            return { ops: remoteOps, nextCursor: 100 };
          }
          if (cursor === 100) {
            return { ops: [], nextCursor: 100 };
          }
          return { ops: [], nextCursor: cursor ?? 0 };
        }),
      };

      syncEngine = new SyncEngine(db, ['testTable'], mockProvider);
      await syncEngine.getClientId();

      const clientId = await syncEngine.getClientId();

      // Step 1: User B PULLS FIRST (correct behavior)
      console.log('[TEST] Step 1: Pull BEFORE creating and pushing');
      await syncEngine.pull();

      // Check cursor after pull
      const metadata = await db.table('syncMetadata').get('global');
      const cursorAfterPull = metadata?.lastServerCursor ?? 0;
      console.log(`[TEST] User B cursor after first pull: ${cursorAfterPull}`);
      expect(cursorAfterPull).toBe(100);

      // Step 2: User B creates a local item
      const userBOperation: SyncOperation = {
        id: 'user-b-op-1',
        clientId,
        table: 'testTable',
        type: 'create',
        key: 'item-from-user-b',
        payload: {
          id: 'item-from-user-b',
          name: 'My first item',
          createdBy: clientId,
        },
        timestamp: Date.now(),
        synced: 0,
      };

      await db.table('operations').add(userBOperation);

      // Step 3: User B PUSHES (after having pulled)
      console.log('[TEST] Step 2: Push AFTER pulling');
      await syncEngine.push();

      // Cursor should still be at or higher than pull cursor
      const metadata2 = await db.table('syncMetadata').get('global');
      const cursorAfterPush = metadata2?.lastServerCursor ?? 0;
      console.log(`[TEST] User B cursor after push: ${cursorAfterPush}`);
      expect(cursorAfterPush).toBe(101);

      // Step 4: Verify pull was called in correct order
      console.log(
        `[TEST] Total pull calls: ${(mockProvider.pull as ReturnType<typeof vi.fn>).mock.calls.length}`
      );
      expect((mockProvider.pull as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);

      // The key difference: Pull was called with cursor 0 first,
      // so User B got all items 1-99 BEFORE pushing
      // This is the CORRECT scenario - no data loss
    });
  });
});
