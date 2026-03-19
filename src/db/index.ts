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

// Database schema with incremental migrations
// Version history:
// v1: Initial schema (core tables only)
// v2: Added AI Chat tables (aiSessions, aiMessages)
// v3: Added remoteActivityLog table
//
// IMPORTANT: Each version only defines NEW tables not in previous versions.
// Dexie automatically handles adding new indexes to existing tables.

db.version(1).stores({
  // Core tables
  links: 'id, category, name',
  jobs: 'url, name, env',
  settings: 'key',
  tags: 'id, &name',
  jobTags: '[jobUrl+tagId], jobUrl, tagId',
  linkTags: '[linkId+tagId], linkId, tagId',
  linkStats: 'id, usageCount, lastUsedAt',
  myBuilds: 'id, timestamp, env',
  othersBuilds: 'id, timestamp, env',
  hotNews: 'date',
  recordings: '&id, createdAt, url',
  blackboard: 'id, createdAt, pinned',
  operations: 'id, table, type, synced, timestamp',
  syncMetadata: 'id',
  deferred_ops: '++id, table, timestamp',
});

db.version(2).stores({
  // v1 tables + AI Chat tables (only new tables need to be defined)
  aiSessions: 'id, createdAt, updatedAt',
  aiMessages: 'id, sessionId, createdAt',
});

db.version(3).stores({
  // v2 tables + remoteActivityLog (only new table)
  remoteActivityLog: 'id, clientId, table, type, timestamp, receivedAt',
});

// Helper to validate and get the sync server URL
async function getSyncServerUrl(): Promise<{ apiUrl: string; endpoint: string }> {
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

// Helper to get sync access token
async function getSyncAccessToken(): Promise<string> {
  const tokenSetting = await db.settings.get('sync_access_token');
  return (tokenSetting?.value as string) || '';
}

const defaultSyncProvider: SyncProvider = {
  push: async (ops, clientId) => {
    const key = await loadKey();
    if (!key) {
      throw new Error(
        'Sync failed: Security key not configured. Please generate or import a key in settings to enable end-to-end encrypted sync.'
      );
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
    const { endpoint } = await getSyncServerUrl();
    const token = await getSyncAccessToken();

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
    const { endpoint } = await getSyncServerUrl();
    const token = await getSyncAccessToken();

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
