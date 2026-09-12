import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { registerDatabaseSchema } from '../src/db/schema.ts';

await import('fake-indexeddb/auto');
const { default: Dexie } = await import('dexie');

test('startup deferred processing migrates deferred sync chunks into the chunk cache', () => {
  const engineSource = readFileSync(
    new URL('../src/lib/sync/SyncEngine.ts', import.meta.url),
    'utf8'
  );
  const deferredSource = readFileSync(
    new URL('../src/lib/sync/SyncEngine.deferred.ts', import.meta.url),
    'utf8'
  );
  const lifecycleSource = readFileSync(
    new URL('../src/entrypoints/background/backgroundLifecycle.ts', import.meta.url),
    'utf8'
  );

  assert.match(engineSource, /await migrateDeferredChunks\(this\.db\)/);
  assert.match(engineSource, /public async recoverLocalData/);
  assert.match(engineSource, /public async recoverAfterUpgrade/);
  assert.match(engineSource, /await this\.pull\(\)/);
  assert.match(engineSource, /migrateTeamKey/);
  assert.match(engineSource, /Skipping local recovery while another sync is running/);
  assert.match(lifecycleSource, /syncEngine\s*\.\s*recoverAfterUpgrade\(\)/);
  assert.match(lifecycleSource, /handleSyncMessage\(\{ type: 'AUTO_SYNC_TRIGGER_PUSH' \}\)/);
  assert.match(deferredSource, /isSyncChunkOperation/);
  assert.match(deferredSource, /mergeChunkRecords/);
  assert.match(deferredSource, /Conflicting deferred chunk ignored/);
  assert.match(deferredSource, /table\('syncChunks'\)\.put\(record\)/);
  assert.match(deferredSource, /table\('deferred_ops'\)\.delete\(entry\.id\)/);
});

test('local rebuild clears the derived remote operation ledger', () => {
  const source = readFileSync(
    new URL('../src/lib/sync/SyncEngine.reset.ts', import.meta.url),
    'utf8'
  );

  assert.match(source, /db\.table\('remoteActivityLog'\)/);
  assert.match(source, /table\('remoteActivityLog'\)\.clear\(\)/);
});

test('v18 database migration adds syncChunks and apply queue without losing sync state', async () => {
  const name = `DPPChunkMigration-${crypto.randomUUID()}`;
  const oldDb = new Dexie(name);
  oldDb.version(18).stores({
    operations: 'id, table, type, synced, timestamp',
    syncMetadata: 'id',
    deferred_ops: '++id, table, timestamp',
  });
  await oldDb.open();
  await oldDb.table('operations').put({ id: 'old-op', table: 'links', synced: 0, timestamp: 1 });
  await oldDb.table('syncMetadata').put({
    id: 'global',
    lastServerCursor: 42,
    lastSyncTimestamp: 10,
  });
  await oldDb.close();

  const db = new Dexie(name);
  registerDatabaseSchema(db);
  await db.open();

  assert.ok(db.tables.some((table) => table.name === 'syncChunks'));
  assert.ok(db.tables.some((table) => table.name === 'syncApplyQueue'));
  assert.deepEqual(await db.table('operations').get('old-op'), {
    id: 'old-op',
    table: 'links',
    synced: 0,
    timestamp: 1,
  });
  assert.equal((await db.table('syncMetadata').get('global')).lastServerCursor, 42);

  await db.delete();
});

test('v17 archives legacy test data before the new encrypted test tables replace it', async () => {
  const name = `DPPLegacyTestMigration-${crypto.randomUUID()}`;
  const oldDb = new Dexie(name);
  oldDb.version(16).stores({
    settings: 'key',
    testCases: '&id, createdAt, updatedAt, enabled',
    testRuns: '&id, testCaseId, startedAt, status',
  });
  await oldDb.open();
  await oldDb.table('testCases').put({
    id: 'legacy-case',
    name: 'Legacy case',
    instruction: 'Legacy instruction',
    enabled: true,
    createdAt: 1,
    updatedAt: 2,
  });
  await oldDb.table('testRuns').put({
    id: 'legacy-run',
    testCaseId: 'legacy-case',
    aiSessionId: 'session',
    status: 'running',
    recordingEnabled: false,
    startedAt: 3,
  });
  await oldDb.close();

  const db = new Dexie(name);
  registerDatabaseSchema(db);
  await db.open();

  assert.equal((await db.table('legacyTestCases').get('legacy-case')).name, 'Legacy case');
  assert.equal((await db.table('legacyTestRuns').get('legacy-run')).status, 'running');
  assert.equal(
    db.tables.some((table) => table.name === 'testCases'),
    false
  );
  assert.equal(await db.table('testRuns').count(), 0);

  await db.delete();
});

test('v24 adds the local recent actions table without changing existing data', async () => {
  const name = `DPPRecentActionsMigration-${crypto.randomUUID()}`;
  const oldDb = new Dexie(name);
  oldDb.version(23).stores({
    links: 'id, category, name, deletedAt',
    recentActions: null,
  });
  await oldDb.open();
  await oldDb.table('links').put({
    id: 'link-1',
    category: 'default',
    name: 'Example',
    url: 'https://example.com',
    createdAt: 1,
    updatedAt: 1,
  });
  await oldDb.close();

  const db = new Dexie(name);
  registerDatabaseSchema(db);
  await db.open();

  assert.ok(db.tables.some((table) => table.name === 'recentActions'));
  assert.equal((await db.table('links').get('link-1')).name, 'Example');

  await db.delete();
});

test('v26 adds project tables and projectRunId without migrating legacy test cases', async () => {
  const name = `DPPProjectMigration-${crypto.randomUUID()}`;
  const oldDb = new Dexie(name);
  oldDb.version(25).stores({
    materials: '&id, type, status, updatedAt, deletedAt',
    testRuns: '&id, testCaseMaterialId, sessionId, status, startedAt, updatedAt, deletedAt',
  });
  await oldDb.open();
  await oldDb.table('testRuns').put({
    id: 'run-1',
    testCaseMaterialId: 'case-1',
    status: 'passed',
    startedAt: 1,
    updatedAt: 2,
  });
  await oldDb.close();

  const db = new Dexie(name);
  registerDatabaseSchema(db);
  await db.open();

  assert.ok(db.tables.some((table) => table.name === 'testProjects'));
  assert.ok(db.tables.some((table) => table.name === 'projectRuns'));
  assert.ok(db.table('testRuns').schema.indexes.some((index) => index.name === 'projectRunId'));
  assert.equal((await db.table('testRuns').get('run-1')).status, 'passed');
  assert.equal(await db.table('testProjects').count(), 0);

  await db.delete();
});

test('v27-v30 migrate environment-scoped Jenkins records and drop legacy tables', async () => {
  const name = `DPPJenkinsMigration-${crypto.randomUUID()}`;
  const oldDb = new Dexie(name);
  oldDb.version(26).stores({
    jobs: 'url, name, env',
    myBuilds: 'id, timestamp, env',
    othersBuilds: 'id, timestamp, env',
    jobTags: '[jobUrl+tagId], jobUrl, tagId',
  });
  await oldDb.open();
  await oldDb.table('jobs').bulkPut([
    { url: 'https://ci.example/job/a', name: 'a', env: 'prod' },
    { url: 'https://ci.example/job/unknown', name: 'unknown' },
  ]);
  await oldDb.table('myBuilds').put({
    id: 'https://ci.example/job/a/1',
    number: 1,
    jobUrl: 'https://ci.example/job/a',
    jobName: 'team/a',
    timestamp: 1,
    building: false,
    env: 'prod',
  });
  await oldDb.table('jobTags').put({ jobUrl: 'https://ci.example/job/a', tagId: 'important' });
  await oldDb.close();

  const db = new Dexie(name);
  registerDatabaseSchema(db);
  await db.open();

  assert.equal(await db.table('jenkinsJobs').count(), 1);
  assert.equal(await db.table('jenkinsBuilds').count(), 1);
  const migratedBuild = await db.table('jenkinsBuilds').toCollection().first();
  assert.equal(migratedBuild.jobName, 'a/team');
  assert.equal(await db.table('jobTags').count(), 1);
  assert.equal(
    db.tables.some((table) => table.name === 'jobs'),
    false
  );

  await db.delete();
});
