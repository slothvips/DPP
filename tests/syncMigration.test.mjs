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
