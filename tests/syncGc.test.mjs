import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

await import('fake-indexeddb/auto');
const { default: Dexie } = await import('dexie');

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let pruneSyncedOperations;
let localClockLagMs;

before(async () => {
  server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
    resolve: { alias: { '@': path.join(root, 'src') } },
  });
  ({ pruneSyncedOperations } = await server.ssrLoadModule('/src/lib/sync/SyncEngine.gc.ts'));
  ({ localClockLagMs } = await server.ssrLoadModule('/src/lib/sync/SyncEngine.pull.ts'));
});

after(async () => {
  await server?.close();
});

const DAY_MS = 24 * 60 * 60 * 1000;

async function createOperationsDb() {
  const db = new Dexie(`gc-${crypto.randomUUID()}`);
  db.version(1).stores({ operations: 'id, table, type, synced, timestamp' });
  await db.open();
  return db;
}

test('pruneSyncedOperations removes only synced operations past retention', async () => {
  const db = await createOperationsDb();
  const now = Date.now();
  await db.table('operations').bulkPut([
    { id: 'old-synced', table: 'links', type: 'create', synced: 1, timestamp: now - 40 * DAY_MS },
    { id: 'old-pending', table: 'links', type: 'create', synced: 0, timestamp: now - 40 * DAY_MS },
    { id: 'new-synced', table: 'links', type: 'create', synced: 1, timestamp: now - 1 * DAY_MS },
  ]);

  const pruned = await pruneSyncedOperations(db, now);
  assert.equal(pruned, 1);

  const remaining = await db.table('operations').toArray();
  const remainingIds = remaining.map((operation) => operation.id).sort();
  assert.deepEqual(remainingIds, ['new-synced', 'old-pending']);
  await db.close();
});

test('pruneSyncedOperations keeps everything when nothing is stale', async () => {
  const db = await createOperationsDb();
  const now = Date.now();
  await db.table('operations').put({
    id: 'recent',
    table: 'links',
    type: 'create',
    synced: 1,
    timestamp: now - DAY_MS,
  });

  const pruned = await pruneSyncedOperations(db, now);
  assert.equal(pruned, 0);
  assert.equal(await db.table('operations').count(), 1);
  await db.close();
});

test('deleting hook writes the local tombstone before recording the delete operation', () => {
  const source = readFileSync(
    new URL('../src/lib/sync/SyncEngine.hooks.ts', import.meta.url),
    'utf8'
  );
  const deleting = source.match(/table\.hook\('deleting'[\s\S]*?\n    \}\);/)?.[0];
  assert.ok(deleting, 'deleting hook not found');
  // 必须取消硬删除：否则墓碑 put 失败会先硬删同步行、丢墓碑也丢操作（AGENTS.md 禁止硬删）
  assert.match(deleting, /return false;/);
  const tombstoneIndex = deleting.indexOf('table.put(updatedObject)');
  const recordIndex = deleting.indexOf("recordOperation(tableName, 'delete'");
  assert.ok(tombstoneIndex !== -1 && recordIndex !== -1, 'expected tombstone and record steps');
  assert.ok(tombstoneIndex < recordIndex, 'tombstone must be written before recording the op');
});

test('clock lag ignores old server timestamps and reports only a clock behind the server', () => {
  const now = 1_000_000;
  assert.equal(
    localClockLagMs(
      [{ serverTimestamp: now - 60 * 60 * 1000 }, { serverTimestamp: now - 1000 }],
      now
    ),
    0
  );
  assert.equal(localClockLagMs([{ serverTimestamp: now + 10 * 60 * 1000 }], now), 10 * 60 * 1000);
  assert.equal(
    localClockLagMs(
      [{ serverTimestamp: now - 2 * 60 * 60 * 1000 }, { serverTimestamp: now + 8 * 60 * 1000 }],
      now
    ),
    8 * 60 * 1000
  );
});

test('pending decrypt operations stay until they can be decrypted', () => {
  const source = readFileSync(
    new URL('../src/lib/sync/SyncEngine.pull.ts', import.meta.url),
    'utf8'
  );
  const processPending = source.match(
    /async function processPendingDecryptionOperations[\s\S]*?\n\}/
  )?.[0];
  assert.ok(processPending, 'processPendingDecryptionOperations not found');
  assert.doesNotMatch(processPending, /PENDING_DECRYPT_TTL_MS/);
  assert.doesNotMatch(processPending, /bulkDelete/);
  assert.match(processPending, /decryptAndValidate/);
});

test('push flow prunes synced operations after a successful push', () => {
  const source = readFileSync(
    new URL('../src/lib/sync/SyncEngine.push.ts', import.meta.url),
    'utf8'
  );
  assert.match(source, /pruneSyncedOperations/);
  const pruneIndex = source.indexOf('await pruneSyncedOperations(db);');
  const returnIndex = source.indexOf('return totalPushed;');
  assert.ok(pruneIndex !== -1 && returnIndex !== -1);
  assert.ok(pruneIndex < returnIndex, 'prune must run after batches and before returning');
});

test('sync worker rate-limits authenticated sync endpoints', () => {
  const source = readFileSync(
    new URL('../packages/sync-worker/src/index.ts', import.meta.url),
    'utf8'
  );
  assert.match(source, /syncRateLimitExceeded/);
  assert.match(source, /SYNC_RATE_LIMIT_MAX_REQUESTS/);
  assert.match(source, /status: 429/);
  const limitIndex = source.indexOf('await syncRateLimitExceeded(provided, url.pathname)');
  const handleIndex = source.indexOf('return await handleRequest(request, env)');
  assert.ok(limitIndex !== -1 && handleIndex !== -1);
  assert.ok(limitIndex < handleIndex, 'rate limit must run before handling the request');
});
