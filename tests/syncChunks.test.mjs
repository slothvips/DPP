import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_CHUNK_CIPHERTEXT_CHARS,
  MAX_SHEET_CELL_CHARS,
  createChunkOperations,
  parseSyncChunkPayload,
  reassembleChunkGroup,
  toSyncChunkRecord,
} from '../src/lib/sync/chunks.ts';

const operation = {
  id: 'op-1',
  table: 'materials',
  type: 'create',
  key: 'op-1',
  payload: { value: 'large' },
  timestamp: 1,
  synced: 0,
};

test('keeps small encrypted payloads as a complete operation', async () => {
  const [result] = await createChunkOperations(
    {
      ...operation,
      table: 'encrypted',
      type: 'create',
      encryptedPayload: { iv: 'iv', ciphertext: 'small' },
      payload: { iv: 'iv', ciphertext: 'small' },
    },
    'client-1'
  );

  assert.equal(result.table, 'encrypted');
  assert.equal(result.id, 'op-1');
});

test('splits large ciphertext and reassembles out of order', async () => {
  const chunks = await createChunkOperations(
    {
      ...operation,
      encryptedPayload: { iv: 'iv', ciphertext: 'x'.repeat(9000) },
    },
    'client-1'
  );

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => JSON.stringify(chunk.payload).length <= MAX_SHEET_CELL_CHARS));

  const records = chunks.map((chunk) => ({
    ...chunk.payload,
    id: chunk.id,
    keyHash: chunk.keyHash,
    timestamp: chunk.timestamp,
    receivedAt: Date.now(),
  }));
  const assembled = await reassembleChunkGroup([...records].reverse());

  assert.ok(assembled);
  assert.equal(assembled.operation.payload.ciphertext, 'x'.repeat(9000));
});

test('keeps chunks below the server limit with production-sized identities', async () => {
  const chunks = await createChunkOperations(
    {
      ...operation,
      id: '0c27375d-fd36-45e6-8f0c-49823f9beca1',
      encryptedPayload: { iv: 'A'.repeat(24), ciphertext: 'x'.repeat(10000) },
    },
    'client-12345678-1234-1234-1234-123456789012'
  );

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.payload.ciphertext.length <= MAX_CHUNK_CIPHERTEXT_CHARS));
  assert.ok(chunks.every((chunk) => JSON.stringify(chunk.payload).length <= MAX_SHEET_CELL_CHARS));
});

test('does not assemble missing or duplicate indexes', async () => {
  const chunks = await createChunkOperations(
    {
      ...operation,
      encryptedPayload: { iv: 'iv', ciphertext: 'x'.repeat(5000) },
    },
    'client-1'
  );
  const records = chunks.map((chunk) => ({
    ...chunk.payload,
    id: chunk.id,
    keyHash: chunk.keyHash,
    timestamp: chunk.timestamp,
    receivedAt: Date.now(),
  }));

  assert.equal(await reassembleChunkGroup(records.slice(1)), null);
  assert.equal(await reassembleChunkGroup([...records, records[0]]), null);
});

test('rejects chunk groups with mismatched client metadata', async () => {
  const chunks = await createChunkOperations(
    {
      ...operation,
      encryptedPayload: { iv: 'iv', ciphertext: 'x'.repeat(5000) },
    },
    'client-1'
  );
  const records = chunks.map((chunk) => ({
    ...chunk.payload,
    id: chunk.id,
    keyHash: chunk.keyHash,
    timestamp: chunk.timestamp,
    receivedAt: Date.now(),
  }));
  records[0] = { ...records[0], clientId: 'client-2' };

  assert.equal(await reassembleChunkGroup(records), null);
});

test('rejects unsafe chunk totals and mismatched outer metadata', () => {
  const payload = {
    kind: 'chunk-v1',
    operationId: 'op-1',
    chunkIndex: 0,
    chunkTotal: 10001,
    iv: 'iv',
    ciphertext: 'ciphertext',
    ciphertextHash: 'hash',
    clientId: 'client-1',
  };

  assert.equal(parseSyncChunkPayload(payload), null);
  assert.equal(
    toSyncChunkRecord({
      id: 'wrong:chunk:0',
      clientId: 'client-1',
      table: '__sync_chunk__',
      type: 'create',
      key: 'op-1',
      payload: { ...payload, chunkTotal: 1 },
      timestamp: 1,
      synced: 1,
    }),
    null
  );
});
