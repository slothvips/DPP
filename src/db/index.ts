import Dexie from 'dexie';
import { loadKey } from '@/lib/crypto/encryption';
import { http, httpPost } from '@/lib/http';
import { SyncEngine } from '@/lib/sync/SyncEngine';
import { decryptOperation, encryptOperation } from '@/lib/sync/crypto-helpers';
import type { SyncOperation, SyncPendingCounts, SyncProvider } from '@/lib/sync/types';
import { logger } from '@/utils/logger';
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

// Monkey patch transaction to automatically include 'operations' table in write transactions
// This ensures atomicity for sync logging without modifying every call site
const originalTransaction = db.transaction.bind(db);
// @ts-expect-error - Monkey patching internal method with compatible signature
db.transaction = (mode: string, tables: string | string[], ...args: unknown[]) => {
  if (mode === 'rw' || mode === 'readwrite') {
    const tableList = Array.isArray(tables) ? tables : [tables];
    // Only add if not already present and not internal Dexie tables
    if (!tableList.includes('operations')) {
      const newTables = [...tableList, 'operations'];
      // @ts-expect-error - Dynamic arguments for transaction are difficult to type strictly
      return originalTransaction(mode, newTables, ...args);
    }
  }
  // @ts-expect-error - Dynamic arguments for transaction are difficult to type strictly
  return originalTransaction(mode, tables, ...args);
};

db.version(1).stores({
  links: 'id, category, name',
  jobs: 'url, name',
  settings: 'key',
});

// Upgrade schema
db.version(2).stores({
  tags: '++id, name',
  jobTags: '[jobUrl+tagId], jobUrl, tagId', // Compound primary key
});

db.version(3).stores({
  myBuilds: 'id, timestamp',
});

db.version(4).stores({
  linkStats: 'id, usageCount, lastUsedAt', // id matches LinkItem.id
});

db.version(5).stores({
  hotNews: 'date',
});

db.version(6).stores({
  operations: 'id, table, type, synced, timestamp',
  syncState: 'id',
});

db.version(7).stores({
  tags: '++id, &name',
});

db.version(9).stores({
  syncMetadata: 'id',
  syncState: null,
});

db.version(10).stores({
  _tags_migration: 'id, &name',
  _jobTags_migration: '[jobUrl+tagId], jobUrl, tagId',
});

db.version(11)
  .stores({
    tags: null,
    jobTags: null,
  })
  .upgrade(async (tx) => {
    const oldTags = await tx.table('tags').toArray();
    const oldJobTags = await tx.table('jobTags').toArray();

    const idMapping = new Map<number, string>();

    for (const tag of oldTags) {
      const newId = crypto.randomUUID();
      idMapping.set(tag.id as number, newId);
      await tx.table('_tags_migration').add({
        id: newId,
        name: tag.name,
        color: tag.color,
      });
    }

    for (const jobTag of oldJobTags) {
      const newTagId = idMapping.get(jobTag.tagId as number);
      if (newTagId) {
        await tx.table('_jobTags_migration').add({
          jobUrl: jobTag.jobUrl,
          tagId: newTagId,
        });
      }
    }
  });

db.version(12)
  .stores({
    tags: 'id, &name',
    jobTags: '[jobUrl+tagId], jobUrl, tagId',
    _tags_migration: null,
    _jobTags_migration: null,
  })
  .upgrade(async (tx) => {
    const migratedTags = await tx.table('_tags_migration').toArray();
    const migratedJobTags = await tx.table('_jobTags_migration').toArray();

    for (const tag of migratedTags) {
      await tx.table('tags').add(tag);
    }

    for (const jobTag of migratedJobTags) {
      await tx.table('jobTags').add(jobTag);
    }
  });

db.version(13)
  .stores({
    linkTags: '[linkId+tagId], linkId, tagId',
  })
  .upgrade(async (tx) => {
    const links = await tx.table('links').toArray();
    const existingTags = await tx.table('tags').toArray();
    const tagMap = new Map(existingTags.map((t) => [t.name, t]));

    for (const link of links) {
      if (link.category && !link.deletedAt) {
        let tag = tagMap.get(link.category);

        if (!tag) {
          // Create new tag for category
          tag = {
            id: crypto.randomUUID(),
            name: link.category,
            color: 'blue', // Default color
            updatedAt: Date.now(),
          };
          await tx.table('tags').add(tag);
          tagMap.set(tag.name, tag);
        }

        // Link tag to link
        await tx.table('linkTags').add({
          linkId: link.id,
          tagId: tag.id,
          updatedAt: Date.now(),
        });
      }
    }
  });

db.version(14).stores({
  recordings: '&id, createdAt, url',
});

db.version(15).stores({
  othersBuilds: 'id, timestamp',
});

db.version(16)
  .stores({
    jobs: 'url, name, env',
    myBuilds: 'id, timestamp, env',
    othersBuilds: 'id, timestamp, env',
  })
  .upgrade(async (tx) => {
    const host = await tx.table('settings').get('jenkins_host');
    const user = await tx.table('settings').get('jenkins_user');
    const token = await tx.table('settings').get('jenkins_token');

    if (host || user || token) {
      const defaultEnv = {
        id: 'default',
        name: 'Default',
        host: (host?.value as string) || '',
        user: (user?.value as string) || '',
        token: (token?.value as string) || '',
        order: 0,
      };
      await tx.table('settings').add({ key: 'jenkins_environments', value: [defaultEnv] });
      await tx.table('settings').add({ key: 'jenkins_current_env', value: 'default' });
    }

    await tx.table('jobs').toCollection().modify({ env: 'default' });
    await tx.table('myBuilds').toCollection().modify({ env: 'default' });
    await tx.table('othersBuilds').toCollection().modify({ env: 'default' });
  });

db.version(17).upgrade(async (tx) => {
  // Remove legacy Jenkins settings that have been migrated to jenkins_environments
  await tx
    .table('settings')
    .where('key')
    .anyOf(['jenkins_host', 'jenkins_user', 'jenkins_token'])
    .delete();
});

db.version(18).upgrade(async (tx) => {
  await tx
    .table('links')
    .toCollection()
    .modify((link) => {
      if (!link.createdAt) {
        link.createdAt = link.updatedAt || Date.now();
      }
    });
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

    const data = res as { cursor?: number; success?: boolean };

    // Update cursor atomically in a transaction to prevent race conditions
    if (data.cursor && data.success) {
      await db.transaction('rw', db.syncMetadata, async () => {
        const currentMeta = await db.syncMetadata.get('global');
        const currentCursor = currentMeta?.lastServerCursor || 0;
        const newCursor = Number(data.cursor);

        // Only update if the new cursor is greater (prevents rollback)
        if (newCursor > Number(currentCursor)) {
          await db.syncMetadata.put({
            id: 'global',
            lastServerCursor: newCursor,
            lastSyncTimestamp: Date.now(),
          });
          logger.debug(`[Sync] Updated cursor: ${currentCursor} -> ${newCursor}`);
        } else {
          logger.warn(`[Sync] Rejected cursor update: ${newCursor} <= ${currentCursor}`);
        }
      });
    }
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

    const key = await loadKey();
    if (!key) {
      throw new Error('同步失败：未配置安全密钥。请在设置中生成或导入密钥以启用端到端加密同步。');
    }

    const decryptedOps = await Promise.all(ops.map((op) => decryptOperation(op, key)));

    return { ops: decryptedOps, nextCursor: data.cursor };
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

db.version(19).stores({
  blackboard: 'id, createdAt, pinned',
});

// Lazy-load syncEngine to avoid initializing in Service Worker (no localStorage)
let _syncEngine: SyncEngine | null = null;

db.version(20).stores({
  deferred_ops: '++id, table, timestamp',
});

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

export type {
  LinkItem,
  LinkItem as Link,
  JobItem,
  JobItem as Job,
  TagItem,
  TagItem as Tag,
  JobTagItem,
  JobTagItem as JobTag,
  MyBuildItem,
  MyBuildItem as MyBuild,
  HotNewsCache,
};
