import assert from 'node:assert/strict';
import test from 'node:test';
import {
  D1SyncStore,
  SyncConflictError,
  SyncValidationError,
} from '../packages/sync-worker/src/lib/d1.ts';
import {
  fingerprintOperation,
  getOperationIdempotencyKey,
  validateSyncChunkOperation,
} from '../packages/sync-worker/src/lib/idempotency.ts';
class FakeStatement {
  bindings = [];

  constructor(database, sql) {
    this.database = database;
    this.sql = sql.replace(/\s+/g, ' ').trim();
  }

  bind(...bindings) {
    this.bindings = bindings;
    return this;
  }

  async all() {
    if (this.sql.includes('WHERE server_seq > ?') && this.sql.includes('ORDER BY server_seq')) {
      const [cursor, limit] = this.bindings;
      return {
        results: this.database.rows
          .filter((row) => row.server_seq > cursor)
          .sort((left, right) => left.server_seq - right.server_seq)
          .slice(0, limit),
      };
    }
    if (this.sql.includes('WHERE server_seq IN')) {
      const cursors = new Set(this.bindings);
      return { results: this.database.rows.filter((row) => cursors.has(row.server_seq)) };
    }
    if (this.sql.includes('client_id = ? AND client_op_id = ?')) {
      const keys = new Set();
      for (let index = 0; index < this.bindings.length; index += 2) {
        keys.add(JSON.stringify([this.bindings[index], this.bindings[index + 1]]));
      }
      return {
        results: this.database.rows.filter((row) =>
          keys.has(JSON.stringify([row.client_id, row.client_op_id]))
        ),
      };
    }
    throw new Error(`Unsupported fake D1 query: ${this.sql}`);
  }

  async first() {
    if (this.sql.startsWith('SELECT COUNT(*) AS count FROM operations WHERE server_seq >')) {
      const [cursor, clientId] = this.bindings;
      return {
        count: this.database.rows.filter(
          (row) => row.server_seq > cursor && (clientId === undefined || row.client_id !== clientId)
        ).length,
      };
    }
    if (this.sql.startsWith('SELECT COUNT(*) AS count, COALESCE(MIN(server_seq)')) {
      const cursors = this.database.rows.map((row) => row.server_seq);
      return {
        count: this.database.rows.length,
        minCursor: cursors.length === 0 ? 0 : Math.min(...cursors),
        maxCursor: cursors.length === 0 ? 0 : Math.max(...cursors),
        payloadBytes: this.database.rows.reduce((sum, row) => sum + row.payload_json.length, 0),
      };
    }
    throw new Error(`Unsupported fake D1 query: ${this.sql}`);
  }

  insert() {
    const [
      requestedServerSeq,
      client_op_id,
      client_id,
      table_name,
      operation_type,
      key_json,
      key_hash,
      payload_json,
      client_timestamp,
      server_timestamp,
      fingerprint,
    ] = this.bindings;
    const server_seq = requestedServerSeq ?? this.database.nextServerSeq();
    if (
      this.database.rows.some(
        (row) =>
          row.server_seq === server_seq ||
          (row.client_id === client_id && row.client_op_id === client_op_id)
      )
    ) {
      throw new Error('UNIQUE constraint failed');
    }
    this.database.rows.push({
      server_seq,
      client_op_id,
      client_id,
      table_name,
      operation_type,
      key_json,
      key_hash,
      payload_json,
      client_timestamp,
      server_timestamp,
      fingerprint,
    });
    return { success: true, meta: { last_row_id: server_seq } };
  }
}

class FakeD1Database {
  rows = [];

  prepare(sql) {
    return new FakeStatement(this, sql);
  }

  async batch(statements) {
    const snapshot = structuredClone(this.rows);
    try {
      return statements.map((statement) => statement.insert());
    } catch (error) {
      this.rows = snapshot;
      throw error;
    }
  }

  nextServerSeq() {
    return Math.max(0, ...this.rows.map((row) => row.server_seq)) + 1;
  }
}

function encryptedOperation(id, clientId = 'client-1', value = id) {
  return {
    id,
    clientId,
    table: 'encrypted',
    type: 'create',
    key: id,
    payload: { iv: `iv-${value}`, ciphertext: `ciphertext-${value}` },
    timestamp: 100,
    keyHash: 'key-hash',
  };
}

test('D1 push writes once and confirms idempotent retries', async () => {
  const database = new FakeD1Database();
  const store = new D1SyncStore(database);
  const operation = encryptedOperation('op-1');

  assert.deepEqual(await store.push([operation], 'client-1'), {
    success: true,
    cursor: 1,
    pushedIds: ['op-1'],
  });
  assert.equal(database.rows.length, 1);
  assert.deepEqual(await store.push([operation], 'client-1'), {
    success: true,
    cursor: 1,
    pushedIds: ['op-1'],
  });
  assert.equal(database.rows.length, 1);
});

test('D1 push rejects stored and in-request fingerprint conflicts atomically', async () => {
  const database = new FakeD1Database();
  const store = new D1SyncStore(database);
  await store.push([encryptedOperation('op-1')], 'client-1');

  await assert.rejects(
    store.push([encryptedOperation('op-1', 'client-1', 'changed')], 'client-1'),
    SyncConflictError
  );
  await assert.rejects(
    store.push(
      [encryptedOperation('op-2'), encryptedOperation('op-2', 'client-1', 'changed')],
      'client-1'
    ),
    SyncConflictError
  );
  assert.equal(database.rows.length, 1);
});

test('D1 push accepts 50 operations and rejects larger batches', async () => {
  const database = new FakeD1Database();
  const store = new D1SyncStore(database);
  const operations = Array.from({ length: 50 }, (_, index) => encryptedOperation(`op-${index}`));

  const result = await store.push(operations, 'client-1');
  assert.equal(result.cursor, 50);
  assert.equal(result.pushedIds.length, 50);
  assert.equal(database.rows.length, 50);
  await assert.rejects(
    store.push([...operations, encryptedOperation('op-50')], 'client-1'),
    SyncValidationError
  );
});

test('D1 pull paginates after cursor and keeps an empty-page cursor', async () => {
  const store = new D1SyncStore(new FakeD1Database());
  await store.push(
    [encryptedOperation('op-1'), encryptedOperation('op-2'), encryptedOperation('op-3')],
    'client-1'
  );

  const page = await store.pull(1, 1);
  assert.deepEqual(
    page.ops.map((operation) => operation.id),
    ['op-2']
  );
  assert.equal(page.cursor, 2);
  assert.deepEqual(await store.pull(3, 10), { ops: [], cursor: 3 });
});

test('D1 pending excludes operations from the requesting client', async () => {
  const store = new D1SyncStore(new FakeD1Database());
  await store.push([encryptedOperation('op-1', 'client-1')], 'client-1');
  await store.push([encryptedOperation('op-2', 'client-2')], 'client-2');

  assert.equal(await store.countPending(0), 2);
  assert.equal(await store.countPending(0, 'client-1'), 1);
  assert.equal(await store.countPending(1, 'client-2'), 0);
});

test('D1 Worker validates encrypted and chunk operations', async () => {
  const store = new D1SyncStore(new FakeD1Database());
  await assert.rejects(store.push([null], 'client-1'), SyncValidationError);
  await assert.rejects(store.push([encryptedOperation('op-0')], 42), SyncValidationError);
  await assert.rejects(
    store.push([{ ...encryptedOperation('op-1'), payload: { plaintext: true } }], 'client-1'),
    SyncValidationError
  );

  const chunk = {
    id: 'op-2:chunk:0',
    clientId: 'wrong-client',
    table: '__sync_chunk__',
    type: 'create',
    key: 'op-2',
    keyHash: 'key-hash',
    payload: {
      kind: 'chunk-v1',
      operationId: 'op-2',
      chunkIndex: 0,
      chunkTotal: 1,
      iv: 'iv',
      ciphertext: 'ciphertext',
      ciphertextHash: 'hash',
      clientId: 'wrong-client',
    },
    timestamp: 100,
  };
  await store.push([chunk], 'client-1');
  const pulled = await store.pull(0, 10);
  assert.equal(pulled.ops[0].clientId, 'client-1');
  assert.equal(pulled.ops[0].payload.clientId, 'client-1');
});

test('chunk validator still enforces deterministic IDs', () => {
  const operation = {
    id: 'op-1:chunk:0',
    clientId: 'client-1',
    table: '__sync_chunk__',
    type: 'create',
    key: 'op-1',
    keyHash: 'key-hash',
    payload: {
      kind: 'chunk-v1',
      operationId: 'op-1',
      chunkIndex: 0,
      chunkTotal: 1,
      iv: 'iv',
      ciphertext: 'ciphertext',
      ciphertextHash: 'hash',
      clientId: 'client-1',
    },
  };
  assert.equal(validateSyncChunkOperation(operation), null);
  assert.match(validateSyncChunkOperation({ ...operation, id: 'wrong-id' }) ?? '', /metadata/);
});
