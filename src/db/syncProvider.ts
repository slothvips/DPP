import type { EncryptedData } from '@/lib/crypto/encryption';
import { http, httpPost } from '@/lib/http';
import {
  DEFAULT_CHUNK_UPLOAD_ENABLED,
  MAX_PUSH_REQUEST_BYTES,
  MAX_SHEET_CELL_CHARS,
  createChunkOperations,
} from '@/lib/sync/chunks';
import { encryptOperation } from '@/lib/sync/crypto-helpers';
import { isPersonalSyncScope } from '@/lib/sync/dataScope';
import { loadSyncKeyring, resolveKeyForOperation } from '@/lib/sync/syncKeys';
import type { SyncOperation, SyncProvider, SyncPushResult } from '@/lib/sync/types';
import { logger } from '@/utils/logger';
import type { DPPDatabase } from './types';

async function getSyncServerUrl(db: DPPDatabase): Promise<{ apiUrl: string; endpoint: string }> {
  const setting = await db.settings.get('custom_server_url');
  const rawUrl = typeof setting?.value === 'string' ? setting.value.trim() : '';
  if (!rawUrl) throw new Error('Sync server URL not configured');

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid sync server URL format. Example: https://sync.example.com');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Sync server URL must use http:// or https:// protocol');
  }

  const apiUrl = rawUrl.replace(/\/$/, '');
  const endpoint = `${apiUrl}/api/sync`;
  return { apiUrl, endpoint };
}

async function getSyncAccessToken(db: DPPDatabase): Promise<string> {
  const tokenSetting = await db.settings.get('sync_access_token');
  return typeof tokenSetting?.value === 'string' ? tokenSetting.value : '';
}

function isSyncOperation(value: unknown): value is SyncOperation {
  if (typeof value !== 'object' || value === null) return false;
  const operation = value as Record<string, unknown>;
  return (
    typeof operation.id === 'string' &&
    operation.id.length > 0 &&
    typeof operation.table === 'string' &&
    operation.table.length > 0 &&
    (operation.type === 'create' || operation.type === 'update' || operation.type === 'delete') &&
    typeof operation.timestamp === 'number' &&
    Number.isFinite(operation.timestamp)
  );
}

function parsePullResponse(value: unknown): { ops: SyncOperation[]; cursor: number | string } {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Pull response is not an object');
  }
  const data = value as { ops?: unknown; cursor?: unknown };
  if (!Array.isArray(data.ops) || !data.ops.every(isSyncOperation)) {
    throw new Error('Pull response contains invalid operations');
  }
  if (
    !(
      (typeof data.cursor === 'number' && Number.isSafeInteger(data.cursor) && data.cursor >= 0) ||
      (typeof data.cursor === 'string' && data.cursor.length > 0)
    )
  ) {
    throw new Error('Pull response contains an invalid cursor');
  }
  return { ops: data.ops, cursor: data.cursor };
}

export function createDefaultSyncProvider(db: DPPDatabase): SyncProvider {
  return {
    push: async (ops, clientId): Promise<SyncPushResult> => {
      const keyring = await loadSyncKeyring();
      const encryptable: Array<{ op: SyncOperation; key: CryptoKey }> = [];

      for (const op of ops) {
        const { scope, key } = resolveKeyForOperation(op, keyring);

        if (isPersonalSyncScope(scope)) {
          if (!key) {
            logger.warn(
              `[Sync] Skip personal op ${op.id} (table=${op.table}): personal key not configured`
            );
            continue;
          }
          encryptable.push({ op, key });
          continue;
        }

        if (scope === 'local') {
          logger.warn(`[Sync] Skip local-only op ${op.id} (table=${op.table})`);
          continue;
        }

        if (!key) {
          logger.warn(
            `[Sync] Skip team op ${op.id} (table=${op.table}): team sync key not configured`
          );
          continue;
        }
        encryptable.push({ op, key });
      }

      if (encryptable.length === 0) {
        return { pushedIds: [] };
      }

      const finalOps: SyncOperation[] = [];
      const chunkUploadSetting = await db.table('settings').get('sync_chunk_upload_enabled');
      const chunkUploadEnabled =
        typeof chunkUploadSetting?.value === 'boolean'
          ? chunkUploadSetting.value
          : DEFAULT_CHUNK_UPLOAD_ENABLED;
      for (const { op, key } of encryptable) {
        const expectedKeyHash = isPersonalSyncScope(resolveKeyForOperation(op, keyring).scope)
          ? keyring.personalHash
          : keyring.teamHash;
        const operationForEncryption =
          op.encryptedPayload && op.keyHash !== expectedKeyHash
            ? { ...op, encryptedPayload: undefined, keyHash: undefined }
            : op;
        const encrypted = await encryptOperation(operationForEncryption, key);
        if ((!op.encryptedPayload || op.keyHash !== encrypted.keyHash) && encrypted.payload) {
          op.encryptedPayload = encrypted.payload as EncryptedData;
          op.keyHash = encrypted.keyHash;
          await db.operations.update(op.id, {
            encryptedPayload: op.encryptedPayload,
            keyHash: encrypted.keyHash,
          });
        }
        if (
          !chunkUploadEnabled &&
          JSON.stringify(encrypted.payload).length > MAX_SHEET_CELL_CHARS
        ) {
          throw new Error(
            `Operation ${op.id} exceeds the sync payload limit while chunk upload is disabled`
          );
        }
        finalOps.push(
          ...(chunkUploadEnabled ? await createChunkOperations(encrypted, clientId) : [encrypted])
        );
      }

      const { endpoint } = await getSyncServerUrl(db);
      const token = await getSyncAccessToken(db);

      const requestBatches: SyncOperation[][] = [];
      let currentBatch: SyncOperation[] = [];
      for (const operation of finalOps) {
        const candidate = [...currentBatch, operation];
        const candidateBytes = new TextEncoder().encode(
          JSON.stringify({ ops: candidate, clientId })
        ).length;
        if (currentBatch.length > 0 && candidateBytes > MAX_PUSH_REQUEST_BYTES) {
          requestBatches.push(currentBatch);
          currentBatch = [operation];
        } else {
          currentBatch = candidate;
        }
      }
      if (currentBatch.length > 0) {
        requestBatches.push(currentBatch);
      }

      let lastCursor: number | string | undefined;
      for (const requestBatch of requestBatches) {
        const res = await httpPost(
          `${endpoint}/push`,
          { ops: requestBatch, clientId },
          {
            headers: {
              'X-Client-ID': clientId,
              'X-Access-Token': token || '',
            },
            timeout: 30000,
          }
        );
        const data = res as {
          cursor?: number | string;
          pushedIds?: unknown;
          success?: boolean;
        };
        if (data.success !== true || !Array.isArray(data.pushedIds)) {
          throw new Error('Push response did not confirm uploaded operations');
        }
        const confirmedIds = new Set(
          data.pushedIds.filter((id): id is string => typeof id === 'string')
        );
        const missingId = requestBatch.find((operation) => !confirmedIds.has(operation.id))?.id;
        if (missingId) {
          throw new Error(`Push response did not confirm operation ${missingId}`);
        }
        lastCursor = data.cursor ?? lastCursor;
      }

      const pushedIds = encryptable.map(({ op }) => op.id);
      return lastCursor !== undefined ? { cursor: lastCursor, pushedIds } : { pushedIds };
    },
    pull: async (cursor, clientId) => {
      const { endpoint } = await getSyncServerUrl(db);
      const token = await getSyncAccessToken(db);

      const url = new URL(`${endpoint}/pull`);
      url.searchParams.append('cursor', String(cursor || 0));
      if (clientId) {
        url.searchParams.append('clientId', clientId);
      }

      const res = await http(url.toString(), {
        headers: {
          'X-Access-Token': token || '',
        },
        timeout: 30000,
      });
      if (!res.ok) {
        throw new Error(`Pull failed: ${res.status} ${res.statusText}`);
      }
      const data = parsePullResponse(await res.json());
      return { ops: data.ops, nextCursor: data.cursor };
    },
    getPendingCount: async (cursor, clientId) => {
      const { endpoint } = await getSyncServerUrl(db);
      const token = await getSyncAccessToken(db);

      const url = new URL(`${endpoint}/pending`);
      url.searchParams.append('cursor', String(cursor || 0));
      if (clientId) {
        url.searchParams.append('clientId', clientId);
      }

      const res = await http(url.toString(), {
        headers: {
          'X-Access-Token': token || '',
        },
        timeout: 30000,
      });
      if (!res.ok) {
        throw new Error(`Get pending count failed: ${res.status}`);
      }
      const data = (await res.json()) as { count: number };
      return data.count;
    },
  };
}
