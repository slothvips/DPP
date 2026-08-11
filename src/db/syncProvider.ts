import { http, httpPost } from '@/lib/http';
import { encryptOperation } from '@/lib/sync/crypto-helpers';
import { isPersonalSyncScope } from '@/lib/sync/dataScope';
import { loadSyncKeyring, resolveKeyForOperation } from '@/lib/sync/syncKeys';
import type { SyncOperation, SyncProvider, SyncPushResult } from '@/lib/sync/types';
import { logger } from '@/utils/logger';
import type { DPPDatabase } from './types';

async function getSyncServerUrl(db: DPPDatabase): Promise<{ apiUrl: string; endpoint: string }> {
  const setting = await db.settings.get('custom_server_url');
  const rawUrl = (setting?.value as string)?.trim();
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
  return (tokenSetting?.value as string) || '';
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

      const finalOps = await Promise.all(
        encryptable.map(({ op, key }) => encryptOperation(op, key))
      );

      const setting = await db.settings.get('custom_server_url');
      const apiUrl = (setting?.value as string)?.replace(/\/$/, '');
      if (!apiUrl) throw new Error('Sync server URL not configured');
      const endpoint = `${apiUrl}/api/sync`;

      const tokenSetting = await db.settings.get('sync_access_token');
      const token = tokenSetting?.value as string;

      const res = await httpPost(
        `${endpoint}/push`,
        { ops: finalOps, clientId },
        {
          headers: {
            'X-Client-ID': clientId,
            'X-Access-Token': token || '',
          },
          timeout: 30000,
        }
      );

      const data = res as { cursor?: number | string; success?: boolean };
      const pushedIds = encryptable.map(({ op }) => op.id);
      return data.cursor ? { cursor: data.cursor, pushedIds } : { pushedIds };
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
      const data = (await res.json()) as { ops: SyncOperation[]; cursor: number };
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
