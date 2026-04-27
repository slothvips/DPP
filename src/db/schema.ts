import type Dexie from 'dexie';

export function registerDatabaseSchema(db: Dexie) {
  db.version(1).stores({
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
    aiSessions: 'id, createdAt, updatedAt',
    aiMessages: 'id, sessionId, createdAt',
  });

  db.version(3).stores({
    remoteActivityLog: 'id, clientId, table, type, timestamp, receivedAt',
  });

  db.version(4).stores({
    aiMessages: 'id, sessionId, createdAt, toolCallId',
  });

  db.version(5).stores({
    aiMessages: 'id, sessionId, createdAt, toolCallId',
  });
}
