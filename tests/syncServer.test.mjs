import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { OperationSchema } from '../packages/node-server/src/protocol.ts';

let dbModule;
let databaseUnavailable;
try {
  dbModule = await import('../packages/node-server/src/db.ts');
} catch (error) {
  if (
    error instanceof Error &&
    (error.message.includes('Could not locate the bindings file') ||
      error.message.includes('packages/node-server/src/protocol.js'))
  ) {
    databaseUnavailable = 'Node server SQLite integration is unavailable in this test runtime';
  } else {
    throw error;
  }
}

function operation(overrides = {}) {
  return {
    id: `server-test-${crypto.randomUUID()}`,
    clientId: 'client-server-test',
    table: 'encrypted',
    type: 'create',
    key: 'operation-key',
    keyHash: 'hash',
    payload: { iv: 'iv', ciphertext: 'ciphertext' },
    timestamp: Date.now(),
    ...overrides,
  };
}

test(
  'Node server stores mixed complete and chunk operations with clientId',
  {
    skip: databaseUnavailable,
  },
  () => {
    const { dbOps } = dbModule;
    const complete = operation();
    const chunk = operation({
      id: `${complete.id}:chunk:0`,
      table: '__sync_chunk__',
      key: complete.id,
      payload: {
        kind: 'chunk-v1',
        operationId: complete.id,
        chunkIndex: 0,
        chunkTotal: 1,
        iv: 'iv',
        ciphertext: 'ciphertext',
        ciphertextHash: 'hash',
        clientId: complete.clientId,
      },
    });

    const result = dbOps.push([complete, chunk]);
    const pulled = dbOps.pull(result.cursor - 2, 10).ops;

    assert.deepEqual(
      pulled.map((item) => item.id),
      [complete.id, chunk.id]
    );
    assert.ok(pulled.every((item) => item.clientId === complete.clientId));
  }
);

test(
  'Node server retries are idempotent and conflicting content is rejected',
  {
    skip: databaseUnavailable,
  },
  () => {
    const { dbOps, SyncConflictError } = dbModule;
    const original = operation();
    const first = dbOps.push([original]);
    const second = dbOps.push([original]);

    assert.deepEqual(second.pushedIds, [original.id]);
    assert.equal(second.cursor, first.cursor);
    assert.throws(
      () => dbOps.push([{ ...original, payload: { iv: 'iv', ciphertext: 'different' } }]),
      (error) => error instanceof SyncConflictError
    );
  }
);

test(
  'Node server excludes the requesting client from pending history',
  {
    skip: databaseUnavailable,
  },
  () => {
    const { dbOps } = dbModule;
    const own = operation({ clientId: 'client-pending-test' });
    const other = operation({ clientId: 'other-client' });
    const ownResult = dbOps.push([own]);
    dbOps.push([other]);

    assert.equal(dbOps.countPending(0, own.clientId), 1);
    assert.equal(dbOps.countPending(ownResult.cursor, own.clientId), 1);
  }
);

test('Node server validates chunk metadata and payload size', () => {
  const base = operation({
    id: 'invalid-chunk',
    table: '__sync_chunk__',
    key: 'invalid-chunk',
    payload: {
      kind: 'chunk-v1',
      operationId: 'invalid-chunk',
      chunkIndex: 1,
      chunkTotal: 1,
      iv: 'iv',
      ciphertext: 'ciphertext',
      ciphertextHash: 'hash',
      clientId: 'client-server-test',
    },
  });

  assert.throws(() => OperationSchema.parse(base));
  assert.throws(() =>
    OperationSchema.parse({
      ...operation({
        id: 'mismatched-client',
        table: '__sync_chunk__',
        clientId: 'client-a',
        key: 'mismatched-client',
      }),
      payload: {
        kind: 'chunk-v1',
        operationId: 'mismatched-client',
        chunkIndex: 0,
        chunkTotal: 1,
        iv: 'iv',
        ciphertext: 'ciphertext',
        ciphertextHash: 'hash',
        clientId: 'client-b',
      },
    })
  );
  assert.throws(() =>
    OperationSchema.parse({
      ...operation({ id: 'oversized-chunk', table: '__sync_chunk__', key: 'oversized-chunk' }),
      payload: {
        kind: 'chunk-v1',
        operationId: 'oversized-chunk',
        chunkIndex: 0,
        chunkTotal: 1,
        iv: 'iv',
        ciphertext: 'x'.repeat(4000),
        ciphertextHash: 'hash',
        clientId: 'client-server-test',
      },
    })
  );
});

test('Node server accepts legacy identity headers and validates cursors', () => {
  const source = readFileSync(
    new URL('../packages/node-server/src/index.ts', import.meta.url),
    'utf8'
  );

  assert.match(source, /c\.req\.header\('X-Client-ID'\)/);
  assert.match(source, /normalizeClientIdentity/);
  assert.doesNotMatch(source, /throw new Error\('Operation clientId mismatch'\)/);
  assert.match(source, /!SYNC_ACCESS_TOKEN/);
  assert.match(source, /parseNonNegativeInteger/);
  assert.match(source, /limit > 1000/);
});
