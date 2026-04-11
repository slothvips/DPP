import type Dexie from 'dexie';
import { logger } from '@/utils/logger';
import type { SyncOperation, SyncProvider } from './types';

interface PushFlowOptions {
  db: Dexie;
  provider: SyncProvider;
  ensureClientId: () => Promise<string>;
  withRetry: <T>(operation: () => Promise<T>, operationName: string) => Promise<T>;
  pushBatchSize: number;
}

export async function runPushFlow({
  db,
  provider,
  ensureClientId,
  withRetry,
  pushBatchSize,
}: PushFlowOptions): Promise<number> {
  const clientId = await ensureClientId();
  const operations = (await db
    .table('operations')
    .where('synced')
    .equals(0)
    .sortBy('timestamp')) as SyncOperation[];

  if (operations.length === 0) {
    return 0;
  }

  for (let index = 0; index < operations.length; index += pushBatchSize) {
    const batch = operations.slice(index, index + pushBatchSize);
    const result = await withRetry(
      () => provider.push(batch, clientId),
      `Push batch ${Math.floor(index / pushBatchSize) + 1}`
    );

    await db.table('operations').bulkPut(batch.map((operation) => ({ ...operation, synced: 1 })));

    if (result?.cursor !== undefined && result.cursor !== null) {
      await db.transaction('rw', db.table('syncMetadata'), async () => {
        const currentMeta = await db.table('syncMetadata').get('global');
        const currentCursor = Number(currentMeta?.lastServerCursor || 0);
        const serverReturnedCursor = Number(result.cursor);
        const expectedCursor = currentCursor + batch.length;

        if (serverReturnedCursor === expectedCursor) {
          await db.table('syncMetadata').put({
            id: 'global',
            lastServerCursor: serverReturnedCursor,
            lastSyncTimestamp: Date.now(),
          });
          logger.debug(
            `[Sync] Push optimization: Updated cursor ${currentCursor} → ${serverReturnedCursor}`
          );
        } else if (serverReturnedCursor > expectedCursor) {
          logger.debug(
            `[Sync] Push optimization skipped: remote gap detected (server=${serverReturnedCursor} > expected=${expectedCursor}). Will pull to catch up.`
          );
        } else {
          logger.debug(
            `[Sync] Push anomaly: server cursor behind expected (server=${serverReturnedCursor} < expected=${expectedCursor}, current=${currentCursor}). Skipping cursor update.`
          );
        }
      });
    }
  }

  return operations.length;
}
