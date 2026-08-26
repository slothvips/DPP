import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_SHEET_CELL_CHARS,
  createChunkOperations,
  reassembleChunkGroup,
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
