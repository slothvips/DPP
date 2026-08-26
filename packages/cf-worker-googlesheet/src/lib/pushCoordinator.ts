import { DurableObject } from 'cloudflare:workers';
import { getAuthToken } from './google-auth';
import {
  fingerprintOperation,
  getOperationIdempotencyKey,
  validateSyncChunkOperation,
} from './idempotency';
import { SheetsClient, type SyncOperation } from './sheets';

export interface SyncCoordinatorEnv {
  GOOGLE_SERVICE_ACCOUNT: string;
  SYNC_ACCESS_TOKEN: string;
  GOOGLE_SPREADSHEET_ID: string;
  KV: KVNamespace;
}

export interface PushResult {
  success: true;
  cursor: number;
  pushedIds: string[];
}

function normalizeClientIdentity(operation: SyncOperation, clientId: string): SyncOperation {
  if (
    operation.table !== '__sync_chunk__' ||
    typeof operation.payload !== 'object' ||
    operation.payload === null
  ) {
    return { ...operation, clientId };
  }

  return {
    ...operation,
    clientId,
    payload: { ...(operation.payload as Record<string, unknown>), clientId },
  };
}

export class SyncPushCoordinator extends DurableObject<SyncCoordinatorEnv> {
  async push(ops: SyncOperation[], clientId?: string): Promise<PushResult> {
    let result: PushResult | undefined;
    await this.ctx.blockConcurrencyWhile(async () => {
      result = await this.pushUnlocked(ops, clientId);
    });
    if (!result) throw new Error('Sync push did not produce a result');
    return result;
  }

  private async pushUnlocked(ops: SyncOperation[], clientId?: string): Promise<PushResult> {
    const effectiveClientId = clientId || 'legacy';
    const fingerprints = new Map<string, string>();
    const pending: SyncOperation[] = [];
    const client = new SheetsClient(this.env.GOOGLE_SPREADSHEET_ID, getAuthToken(this.env));

    for (const original of ops) {
      const clientIdMismatch = Boolean(
        original.clientId && original.clientId !== effectiveClientId
      );
      const op = normalizeClientIdentity(original, effectiveClientId);
      const chunkError = validateSyncChunkOperation(op);
      if (chunkError) {
        throw new Error(`${op.id}: ${chunkError}`);
      }
      if (op.table === '__sync_chunk__' && JSON.stringify(op.payload).length > 3000) {
        throw new Error(`Sync chunk ${op.id} exceeds the maximum payload size`);
      }

      const key = getOperationIdempotencyKey(op, effectiveClientId);
      const fingerprint = fingerprintOperation(op);
      const previousRequest = fingerprints.get(key);
      if (previousRequest && previousRequest !== fingerprint) {
        throw new Error(`Operation ${op.id} already exists with different content`);
      }
      fingerprints.set(key, fingerprint);

      if (clientIdMismatch) {
        const existing = await client.findOperationsByIds([op.id]);
        if (existing.length > 0) {
          const existingNormalized = normalizeClientIdentity(existing[0], effectiveClientId);
          if (fingerprintOperation(existingNormalized) !== fingerprint) {
            throw new Error(`Operation ${op.id} already exists with different content`);
          }
          await this.ctx.storage.put(key, `done:${fingerprint}`);
          await this.env.KV.put(key, fingerprint);
          continue;
        }
      }

      const stored = await this.ctx.storage.get<string>(key);
      const confirmed = await this.env.KV.get(key);
      if (stored?.startsWith('done:')) {
        if (stored.slice('done:'.length) !== fingerprint) {
          throw new Error(`Operation ${op.id} already exists with different content`);
        }
        continue;
      }
      if (confirmed !== null && confirmed !== fingerprint) {
        throw new Error(`Operation ${op.id} already exists with different content`);
      }
      if (confirmed === fingerprint) {
        await this.ctx.storage.put(key, `done:${fingerprint}`);
        continue;
      }

      if (stored?.startsWith('pending:')) {
        if (stored.slice('pending:'.length) !== fingerprint) {
          throw new Error(`Operation ${op.id} already exists with different content`);
        }
        const existing = await client.findOperationsByIds([op.id]);
        const matching = existing.find(
          (candidate) => getOperationIdempotencyKey(candidate, effectiveClientId) === key
        );
        if (matching) {
          if (fingerprintOperation(matching) !== fingerprint) {
            throw new Error(`Operation ${op.id} already exists with different content`);
          }
          await this.ctx.storage.put(key, `done:${fingerprint}`);
          await this.env.KV.put(key, fingerprint);
          continue;
        }
      }

      await this.ctx.storage.put(key, `pending:${fingerprint}`);
      pending.push(op);
    }

    const serverTimestamp = Date.now();
    const pendingWithServerTimestamp = pending.map((op) => ({
      ...op,
      serverTimestamp: op.serverTimestamp ?? serverTimestamp,
    }));
    const cursor =
      pendingWithServerTimestamp.length > 0
        ? await client.appendRows(pendingWithServerTimestamp)
        : 0;
    for (const op of pendingWithServerTimestamp) {
      const key = getOperationIdempotencyKey(op, effectiveClientId);
      const fingerprint = fingerprintOperation(op);
      await this.ctx.storage.put(key, `done:${fingerprint}`);
      await this.env.KV.put(key, fingerprint);
    }
    if (cursor > 0) {
      await this.env.KV.put('last_cursor', cursor.toString());
    }

    return { success: true, cursor, pushedIds: ops.map((op) => op.id) };
  }
}
