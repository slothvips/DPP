import type Dexie from 'dexie';
import { getKeyHash, loadKey } from '@/lib/crypto/encryption';
import { decryptOperation } from '@/lib/sync/crypto-helpers';
import { logger } from '@/utils/logger';
import { archiveRemoteActivities } from './SyncEngine.deferred';
import type { SyncTransaction } from './SyncEngine.shared';
import type { SyncMetadata, SyncOperation, SyncProvider } from './types';

interface PullFlowOptions {
  db: Dexie;
  tables: string[];
  provider: SyncProvider;
  ensureClientId: () => Promise<string>;
  withRetry: <T>(operation: () => Promise<T>, operationName: string) => Promise<T>;
  maxPullLoops: number;
  applyOperation: (op: SyncOperation) => Promise<void>;
}

export async function runPullFlow({
  db,
  tables,
  provider,
  ensureClientId,
  withRetry,
  maxPullLoops,
  applyOperation,
}: PullFlowOptions): Promise<{ totalPulled: number; loopCount: number }> {
  const clientId = await ensureClientId();
  let keyCache: { key: CryptoKey; keyHash: string } | null = null;
  let totalPulled = 0;
  let loopCount = 0;
  let hasMore = true;

  const ensureKey = async () => {
    if (keyCache) {
      return keyCache;
    }

    const key = await loadKey();
    if (!key) {
      throw new Error('[Sync] Encryption key not found. Cannot decrypt pulled operations.');
    }

    keyCache = { key, keyHash: await getKeyHash(key) };
    return keyCache;
  };

  while (hasMore && loopCount < maxPullLoops) {
    loopCount++;
    const state = (await db.table('syncMetadata').get('global')) as SyncMetadata | undefined;
    const cursor = state?.lastServerCursor;

    const { ops, nextCursor } = await withRetry(() => provider.pull(cursor, clientId), 'Pull');
    if (ops.length === 0) {
      hasMore = false;
      break;
    }

    const remoteOperations = ops.filter((operation) => operation.clientId !== clientId);
    if (remoteOperations.length > 0) {
      const { key, keyHash: currentKeyHash } = await ensureKey();
      const decryptedOperations = await Promise.all(
        remoteOperations.map(async (operation) => {
          if (operation.keyHash && operation.keyHash !== currentKeyHash) {
            logger.debug(
              `[Sync] Skipping op ${operation.id} due to keyHash mismatch (expected ${currentKeyHash}, got ${operation.keyHash})`
            );
            return null;
          }

          try {
            return await decryptOperation(operation, key);
          } catch (error) {
            logger.warn(`[Sync] Failed to decrypt op ${operation.id}, skipping:`, error);
            return null;
          }
        })
      );

      const validOperations = decryptedOperations
        .filter((operation): operation is SyncOperation => operation !== null)
        .sort((left, right) => left.timestamp - right.timestamp);

      await db.transaction(
        'rw',
        [
          ...tables.map((table) => db.table(table)),
          db.table('syncMetadata'),
          db.table('remoteActivityLog'),
        ],
        async (transaction) => {
          (transaction as SyncTransaction).source = 'sync';

          for (const operation of validOperations) {
            await applyOperation(operation);
          }

          await db.table('syncMetadata').put({
            id: 'global',
            lastServerCursor: nextCursor,
            lastSyncTimestamp: Date.now(),
          });

          await archiveRemoteActivities(validOperations);
        }
      );

      totalPulled += validOperations.length;
    } else {
      await db.table('syncMetadata').put({
        id: 'global',
        lastServerCursor: nextCursor,
        lastSyncTimestamp: Date.now(),
      });
    }

    if (nextCursor === cursor) {
      hasMore = false;
    }
  }

  if (loopCount >= maxPullLoops) {
    logger.warn(`[Sync] Pull reached max loops (${maxPullLoops}), stopping.`);
  }

  return { totalPulled, loopCount };
}
