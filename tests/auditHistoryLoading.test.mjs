import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

await import('fake-indexeddb/auto');
const root = fileURLToPath(new URL('..', import.meta.url));
const originalFetch = globalThis.fetch;
let server;
let db;
let loadAuditHistory;
let encryptOperation;
let createChunkOperations;
let key;
let exportedKey;
let remoteOperations = [];
let requestedCursors = [];
let remotePageSize = 2;

before(async () => {
  server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
    resolve: { alias: { '@': path.join(root, 'src') } },
  });
  ({ db } = await server.ssrLoadModule('/src/db/index.ts'));
  ({ loadAuditHistory } = await server.ssrLoadModule('/src/features/audit/auditHistory.ts'));
  ({ encryptOperation } = await server.ssrLoadModule('/src/lib/sync/crypto-helpers.ts'));
  ({ createChunkOperations } = await server.ssrLoadModule('/src/lib/sync/chunks.ts'));
  const { generateSyncKey, exportKey } = await server.ssrLoadModule(
    '/src/lib/crypto/encryption.ts'
  );
  key = await generateSyncKey();
  exportedKey = await exportKey(key);
  await db.open();

  globalThis.fetch = async (input) => {
    const url = new URL(input);
    assert.equal(url.origin, 'https://audit.test');
    assert.equal(url.pathname, '/api/sync/pull');
    const cursor = Number(url.searchParams.get('cursor'));
    requestedCursors.push(cursor);
    const ops = remoteOperations.slice(cursor, cursor + remotePageSize);
    return Response.json({ ops, cursor: cursor + ops.length });
  };
});

beforeEach(async () => {
  remoteOperations = [];
  requestedCursors = [];
  remotePageSize = 2;
  await db.operations.clear();
  await db.settings.clear();
  await db.settings.bulkPut([
    { key: 'custom_server_url', value: 'https://audit.test' },
    { key: 'sync_encryption_key', value: exportedKey },
  ]);
});

after(async () => {
  globalThis.fetch = originalFetch;
  await db?.delete();
  await server?.close();
});

function operation(id, table, payload, timestamp = 1) {
  return {
    id,
    table,
    type: 'update',
    key: 'item',
    payload,
    timestamp,
    synced: 1,
    clientId: 'client',
  };
}

test('真实加载保留分页远端历史、本地未知表和缺少载荷的记录，并去重', async () => {
  const history = [
    operation('config', 'notifyConfig', { messageTemplate: '旧模板' }),
    operation('config-update', 'notifyConfig', { messageTemplate: '新模板' }, 2),
    operation('target', 'notifyTargets', { label: '运维群' }, 3),
    operation('future', 'futureModule', { value: '新模块' }, 4),
  ];
  remoteOperations = await Promise.all(history.map((op) => encryptOperation(op, key)));
  await db.operations.bulkPut([
    { ...history[0], synced: 0 },
    { ...operation('pending', 'futureModule', { value: '本地修改' }, 5), synced: 0 },
    operation('payload-pruned', 'notifyConfig', undefined, 6),
    { id: 'missing-metadata', synced: 0 },
  ]);

  const { entries, rawOperationCount } = await loadAuditHistory();
  assert.equal(rawOperationCount, 4);
  assert.deepEqual(requestedCursors, [0, 2, 4]);
  assert.equal(entries.length, 7);
  assert.equal(entries.filter(({ id }) => id === 'config').length, 1);
  assert.equal(entries.find(({ id }) => id === 'config').source, 'local');
  assert.deepEqual(entries.find(({ id }) => id === 'config-update').before, {
    messageTemplate: '旧模板',
  });
  assert.equal(entries.find(({ id }) => id === 'future').table, 'futureModule');
  assert.equal(entries.find(({ id }) => id === 'pending').source, 'local');
  assert.match(entries.find(({ id }) => id === 'payload-pruned').after, /未知/);
  assert.equal(entries.find(({ id }) => id === 'missing-metadata').action, 'unknown');
});

test('分片每次变更只显示一次，无法解密、不完整和损坏的分片都有可见条目', async () => {
  const chunked = await encryptOperation(
    operation('chunked', 'futureModule', { value: 'x'.repeat(6000) }),
    key
  );
  const incomplete = await encryptOperation(
    operation('incomplete', 'notifyConfig', { value: 'x'.repeat(6000) }),
    key
  );
  const completeChunks = await createChunkOperations(chunked, 'client');
  const incompleteChunks = await createChunkOperations(incomplete, 'client');
  const unreadableChunks = await createChunkOperations(
    { ...chunked, id: 'unreadable-chunks', keyHash: 'unknown-key' },
    'client'
  );
  assert.ok(completeChunks.length > 1);
  remoteOperations = [
    ...completeChunks.map((op) => ({ ...op, serverTimestamp: 123 })),
    ...unreadableChunks.map((op) => ({ ...op, serverTimestamp: 456 })),
    incompleteChunks[0],
    { ...chunked, id: 'no-key', keyHash: 'unknown-key' },
    operation('invalid-chunk', '__sync_chunk__', { kind: 'invalid' }),
  ];
  await db.operations.put(operation('no-key', 'notifyConfig', { value: 'local' }));

  const { entries } = await loadAuditHistory();
  assert.equal(entries.length, 5);
  const complete = entries.find(({ id }) => id === 'chunked');
  assert.equal(complete.isChunked, true);
  assert.equal(complete.serverTimestamp, 123);
  assert.equal(complete.after.value.length, 6000);
  for (const id of ['incomplete', 'invalid-chunk', 'unreadable-chunks']) {
    const matches = entries.filter((entry) => entry.id === id);
    assert.equal(matches.length, 1, id);
    assert.equal(matches[0].action, 'unavailable');
    assert.ok(matches[0].after.reason, id);
  }
  assert.equal(entries.find(({ id }) => id === 'no-key').source, 'local');
  assert.equal(entries.find(({ id }) => id === 'no-key').action, 'update');
  assert.equal(entries.find(({ id }) => id === 'unreadable-chunks').serverTimestamp, 456);
});

test('密钥读取失败仍显示每条远端变更的未知条目', async () => {
  remoteOperations = [
    await encryptOperation(operation('unreadable-1', 'notifyConfig', { value: 1 }), key),
    await encryptOperation(operation('unreadable-2', 'futureModule', { value: 2 }), key),
  ];
  await db.settings.put({ key: 'sync_encryption_key', value: 'invalid-key' });
  const { entries } = await loadAuditHistory();
  assert.equal(entries.length, 2);
  assert.ok(entries.every((entry) => entry.unavailable && entry.after.reason));
});

test('远端单条元数据损坏不会阻断其他记录，且本地明文优先于远端占位', async () => {
  remotePageSize = 10;
  const local = operation('same-id', 'notifyConfig', { messageTemplate: '本地明文' });
  await db.operations.put(local);
  const { generateSyncKey } = await server.ssrLoadModule('/src/lib/crypto/encryption.ts');
  const remoteUnreadable = await encryptOperation(
    operation('same-id', 'notifyConfig', { messageTemplate: '远端密文' }),
    await generateSyncKey()
  );
  const invalid = {
    id: 'bad-metadata',
    table: 'notifyConfig',
    type: 'update',
    key: 'bad',
    payload: { value: 1 },
  };
  const invalidType = {
    id: 'invalid-type',
    table: 'futureModule',
    type: 'future-action',
    key: 'item',
    payload: { value: 1 },
    timestamp: 2,
  };
  remoteOperations = [remoteUnreadable, invalid, invalidType];
  const { entries } = await loadAuditHistory();
  assert.equal(entries.filter(({ id }) => id === 'same-id').length, 1);
  assert.deepEqual(entries.find(({ id }) => id === 'same-id').after, {
    messageTemplate: '本地明文',
  });
  assert.equal(entries.find(({ id }) => id === 'bad-metadata').action, 'unavailable');
  assert.equal(entries.find(({ id }) => id === 'invalid-type').action, 'unavailable');
});

test('无法解析的历史会让后续同对象的变更前值显示未知', async () => {
  remotePageSize = 10;
  const first = await encryptOperation(
    operation('first', 'notifyConfig', { messageTemplate: 'A' }, 1),
    key
  );
  const broken = await encryptOperation(
    operation('broken', 'notifyConfig', { messageTemplate: 'B' }, 2),
    await (async () => {
      const { generateSyncKey } = await server.ssrLoadModule('/src/lib/crypto/encryption.ts');
      return generateSyncKey();
    })()
  );
  const third = await encryptOperation(
    operation('third', 'notifyConfig', { messageTemplate: 'C' }, 3),
    key
  );
  remoteOperations = [first, broken, third];
  const { entries } = await loadAuditHistory();
  assert.deepEqual(entries.find(({ id }) => id === 'third').before, undefined);
});

test('物料记录的变更前后内容都能解密', async () => {
  remotePageSize = 10;
  const { encryptData } = await server.ssrLoadModule('/src/lib/crypto/encryption.ts');
  const oldContent = await encryptData({ title: '旧标题' }, key);
  const newContent = await encryptData({ title: '新标题' }, key);
  remoteOperations = [
    await encryptOperation(
      operation(
        'material-old',
        'materials',
        { id: 'm', type: 'prompt', encryptedContent: oldContent },
        1
      ),
      key
    ),
    await encryptOperation(
      operation(
        'material-new',
        'materials',
        { id: 'm', type: 'prompt', encryptedContent: newContent },
        2
      ),
      key
    ),
  ];
  const { entries } = await loadAuditHistory();
  const latest = entries.find(({ id }) => id === 'material-new');
  assert.deepEqual(latest.before.content, { title: '旧标题' });
  assert.deepEqual(latest.after.content, { title: '新标题' });
});
