import Dexie from 'dexie';
import { loadKey } from '@/lib/crypto/encryption';
import { http, httpPost } from '@/lib/http';
import { SyncEngine } from '@/lib/sync/SyncEngine';
import { encryptOperation } from '@/lib/sync/crypto-helpers';
import type { SyncOperation, SyncPendingCounts, SyncProvider } from '@/lib/sync/types';
import type {
  DPPDatabase,
  HotNewsCache,
  JobItem,
  JobTagItem,
  LinkItem,
  MyBuildItem,
  TagItem,
} from './types';

export * from './types';
export type { Recording } from '@/features/recorder/types';

export const db = new Dexie('DPPDB') as DPPDatabase;

// Database schema - all tables defined in a single version
// Note: This is a development version. In production, use incremental migrations.
db.version(1).stores({
  // Core tables
  links: 'id, category, name',
  jobs: 'url, name, env',
  settings: 'key',
  tags: 'id, &name',
  jobTags: '[jobUrl+tagId], jobUrl, tagId',
  linkTags: '[linkId+tagId], linkId, tagId',
  linkStats: 'id, usageCount, lastUsedAt',

  // Build history
  myBuilds: 'id, timestamp, env',
  othersBuilds: 'id, timestamp, env',

  // Cache
  hotNews: 'date',

  // Recordings
  recordings: '&id, createdAt, url',

  // Blackboard
  blackboard: 'id, createdAt, pinned',

  // Sync tables
  operations: 'id, table, type, synced, timestamp',
  syncMetadata: 'id',
  deferred_ops: '++id, table, timestamp',
});

const defaultSyncProvider: SyncProvider = {
  push: async (ops, clientId) => {
    const key = await loadKey();
    if (!key) {
      throw new Error('同步失败：未配置安全密钥。请在设置中生成或导入密钥以启用端到端加密同步。');
    }

    const finalOps = await Promise.all(ops.map((op) => encryptOperation(op, key)));

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

    return data.cursor ? { cursor: data.cursor } : undefined;
  },
  pull: async (cursor, clientId) => {
    const setting = await db.settings.get('custom_server_url');
    const apiUrl = (setting?.value as string)?.replace(/\/$/, '');
    if (!apiUrl) throw new Error('Sync server URL not configured');
    const endpoint = `${apiUrl}/api/sync`;

    const tokenSetting = await db.settings.get('sync_access_token');
    const token = tokenSetting?.value as string;

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
    const ops = data.ops;

    return { ops, nextCursor: data.cursor };
  },
  getPendingCount: async (cursor, clientId) => {
    const setting = await db.settings.get('custom_server_url');
    const apiUrl = (setting?.value as string)?.replace(/\/$/, '');
    if (!apiUrl) throw new Error('Sync server URL not configured');
    const endpoint = `${apiUrl}/api/sync`;

    const tokenSetting = await db.settings.get('sync_access_token');
    const token = tokenSetting?.value as string;

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

// Lazy-load syncEngine to avoid initializing in Service Worker (no localStorage)
let _syncEngine: SyncEngine | null = null;

export async function getSyncEngine(): Promise<SyncEngine | null> {
  if (!_syncEngine) {
    _syncEngine = new SyncEngine(
      db,
      ['tags', 'jobTags', 'links', 'linkTags', 'blackboard'],
      defaultSyncProvider
    );
    _syncEngine.register();
  }
  return _syncEngine;
}

// For backward compatibility - but prefer getSyncEngine() for null-safety
export const syncEngine = {
  get instance(): SyncEngine | null {
    return _syncEngine;
  },
  async push() {
    return (await getSyncEngine())?.push();
  },
  async pull() {
    return (await getSyncEngine())?.pull();
  },
  async destroy() {
    (await getSyncEngine())?.destroy();
  },
  async on(
    event: 'status-change' | 'sync-error' | 'sync-complete',
    callback: (data: unknown) => void
  ) {
    return (await getSyncEngine())?.on(event, callback);
  },
  get status() {
    return _syncEngine?.status ?? 'idle';
  },
  get lastError() {
    return _syncEngine?.lastError ?? null;
  },
  get lastSyncTime() {
    return _syncEngine?.lastSyncTime ?? null;
  },
  async getClientId() {
    return (await getSyncEngine())?.getClientId() ?? null;
  },
  async getPendingCounts(): Promise<SyncPendingCounts> {
    return (await getSyncEngine())?.getPendingCounts() ?? { push: 0, pull: 0 };
  },
};

export type { LinkItem, JobItem, TagItem, JobTagItem, MyBuildItem, HotNewsCache };
