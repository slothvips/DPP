import type Dexie from 'dexie';
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
  const pendingOperations = (await db
    .table('operations')
    .where('synced')
    .equals(0)
    .sortBy('timestamp')) as SyncOperation[];

  if (pendingOperations.length === 0) {
    return 0;
  }

  const operations = pendingOperations.map((operation) =>
    operation.clientId === clientId ? operation : { ...operation, clientId }
  );
  if (operations.some((operation, index) => operation !== pendingOperations[index])) {
    await db.table('operations').bulkPut(operations);
  }

  let totalPushed = 0;

  for (let index = 0; index < operations.length; index += pushBatchSize) {
    const batch = operations.slice(index, index + pushBatchSize);
    const result = await withRetry(
      () => provider.push(batch, clientId),
      `Push batch ${Math.floor(index / pushBatchSize) + 1}`
    );

    const pushedIds = new Set(result.pushedIds);
    if (pushedIds.size > 0) {
      const pushedOps = batch.filter((operation) => pushedIds.has(operation.id));
      await db.table('operations').bulkPut(
        pushedOps.map((operation) => ({
          ...operation,
          synced: 1,
          encryptedPayload: undefined,
          payload: undefined,
        }))
      );
      totalPushed += pushedOps.length;
    }
  }

  return totalPushed;
}
