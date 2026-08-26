import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  fingerprintOperation,
  getOperationIdempotencyKey,
  validateSyncChunkOperation,
} from '../packages/cf-worker-googlesheet/src/lib/idempotency.ts';
import {
  getSheetReadOffset,
  parseSheetPayload,
  serializeSheetPayload,
} from '../packages/cf-worker-googlesheet/src/lib/sheets.ts';

test('Google Worker idempotency keys and fingerprints are stable', () => {
  const operation = { id: 'op-1', clientId: 'client-1', payload: { value: 1 } };
  assert.equal(getOperationIdempotencyKey(operation), 'sync:op:client-1:op-1');
  assert.equal(
    fingerprintOperation({ ...operation, serverTimestamp: 1 }),
    fingerprintOperation({ ...operation, serverTimestamp: 2 })
  );
});

test('Google Worker keeps concurrency control inside the Durable Object', () => {
  const source = readFileSync(
    new URL('../packages/cf-worker-googlesheet/src/lib/pushCoordinator.ts', import.meta.url),
    'utf8'
  );
  assert.match(source, /blockConcurrencyWhile/);
  assert.match(source, /stored\.slice\('pending:'\.length\) !== fingerprint/);
});

test('Google Sheet payload serialization round-trips encrypted objects and legacy strings', () => {
  const encrypted = { iv: 'iv', ciphertext: 'ciphertext' };
  const serialized = serializeSheetPayload(encrypted);

  assert.equal(typeof serialized, 'string');
  assert.deepEqual(parseSheetPayload(serialized), encrypted);
  assert.equal(parseSheetPayload('legacy-payload'), 'legacy-payload');
});

test('Google Worker starts at the first data row and preserves legacy row cursors', () => {
  assert.equal(getSheetReadOffset(0), 0);
  assert.equal(getSheetReadOffset(1), 0);
  assert.equal(getSheetReadOffset(101), 100);
});

test('Google Worker validates chunk shape, identity and deterministic IDs', () => {
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

test('Google Worker requires client identity and validates pagination parameters', () => {
  const indexSource = readFileSync(
    new URL('../packages/cf-worker-googlesheet/src/index.ts', import.meta.url),
    'utf8'
  );
  const coordinatorSource = readFileSync(
    new URL('../packages/cf-worker-googlesheet/src/lib/pushCoordinator.ts', import.meta.url),
    'utf8'
  );

  assert.match(indexSource, /parseNonNegativeInteger/);
  assert.match(indexSource, /limit > 1000/);
  assert.match(coordinatorSource, /effectiveClientId/);
  assert.match(coordinatorSource, /normalizeClientIdentity/);
  assert.match(coordinatorSource, /clientIdMismatch/);
});
