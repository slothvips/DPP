import type Dexie from 'dexie';
import { decryptOperation } from '@/lib/sync/crypto-helpers';
import {
  doesKeyRoleMatchScope,
  loadSyncKeyring,
  resolveKeyForKeyHash,
  resolveKeyRoleForKeyHash,
} from '@/lib/sync/syncKeys';
import { logger } from '@/utils/logger';
import { archiveRemoteActivities } from './SyncEngine.deferred';
import type { SyncTransaction } from './SyncEngine.shared';
import { resolveDataScope } from './dataScope';
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
  const keyring = await loadSyncKeyring();
  let totalPulled = 0;
  let loopCount = 0;
  let hasMore = true;

  if (!keyring.teamKey && !keyring.personalKey) {
    throw new Error(
      '[Sync] No encryption key found. Configure team sync key and/or personal key to decrypt pulled operations.'
    );
  }

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
      const decryptedOperations = await Promise.all(
        remoteOperations.map(async (operation) => {
          const keyRole = resolveKeyRoleForKeyHash(operation.keyHash, keyring);
          const key = resolveKeyForKeyHash(operation.keyHash, keyring);
          if (!key || !keyRole) {
            logger.debug(
              `[Sync] Skipping op ${operation.id}: no matching key for keyHash=${operation.keyHash ?? 'none'}`
            );
            return null;
          }

          try {
            const decrypted = await decryptOperation(operation, key);
            const scope = resolveDataScope(decrypted);
            if (!doesKeyRoleMatchScope(keyRole, scope)) {
              logger.warn(
                `[Sync] Skipping op ${operation.id}: keyRole=${keyRole} does not match scope=${scope} (table=${decrypted.table})`
              );
              return null;
            }
            return decrypted;
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
