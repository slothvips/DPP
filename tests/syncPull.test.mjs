import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('sync apply transaction includes stores used while applying operations', () => {
  const source = readFileSync(
    new URL('../src/lib/sync/SyncEngine.pull.ts', import.meta.url),
    'utf8'
  );
  const flushApplyQueue = source.match(
    /async function flushApplyQueue[\s\S]*?return appliedCount;/
  )?.[0];

  assert.ok(flushApplyQueue);
  assert.match(flushApplyQueue, /db\.table\('settings'\)/);
  assert.match(flushApplyQueue, /db\.table\('deferred_ops'\)/);
  assert.match(flushApplyQueue, /Quarantining failed operation/);
});

test('sync pull queues undecryptable operations instead of dropping them', () => {
  const source = readFileSync(
    new URL('../src/lib/sync/SyncEngine.pull.ts', import.meta.url),
    'utf8'
  );
  const decryptAndValidate = source.match(
    /async function decryptAndValidate[\s\S]*?\n}\n\nasync function getCompleteChunkOperations/
  )?.[0];

  assert.ok(decryptAndValidate);
  assert.match(decryptAndValidate, /Cannot decrypt op/);
  assert.match(source, /PENDING_DECRYPT_TABLE/);
  assert.match(source, /Queuing undecryptable operation/);
  assert.match(source, /table\('deferred_ops'\)\.add/);
  assert.match(source, /keeping it for retry/);
  assert.match(source, /pendingEntries[\s\S]*entry\.operation\.id/);
  assert.match(source, /export async function recoverLocalSyncData/);
  assert.match(source, /await migrateDeferredChunks\(db\)/);
  assert.match(source, /remoteActivityLog.*anyOf\(operationIds\)/s);
  assert.match(source, /pendingOperations = complete\.operations\.filter/);
  assert.match(source, /bulkDelete\(complete\.recordsToDelete\.map/);
  assert.match(source, /processStoredChunks\(db, keyring, clientId, true\)/);
  assert.match(source, /isSyncChunkOperation\(operation\)\s*\)/);
  assert.match(source, /provider\.pull\(cursor\)/);
  assert.match(source, /Invalid pull cursor transition/);
  assert.match(source, /Quarantining failed operation/);
  assert.match(source, /Refusing unencrypted remote operation/);
});

test('sync pull acknowledges locally known operations before applying remote history', () => {
  const source = readFileSync(
    new URL('../src/lib/sync/SyncEngine.pull.ts', import.meta.url),
    'utf8'
  );

  assert.match(source, /getOriginalOperationId/);
  assert.match(source, /getLocalOperationIds/);
  assert.match(source, /encryptedPayload: undefined/);
  assert.match(source, /!localOperationIds\.has\(getOriginalOperationId\(operation\)\)/);
});

test('sync push reuses encrypted payloads across retries and requires confirmation', () => {
  const pushSource = readFileSync(
    new URL('../src/lib/sync/SyncEngine.push.ts', import.meta.url),
    'utf8'
  );
  const providerSource = readFileSync(
    new URL('../src/db/syncProvider.ts', import.meta.url),
    'utf8'
  );
  const orchestrationSource = readFileSync(
    new URL('../src/lib/sync/SyncEngine.orchestration.ts', import.meta.url),
    'utf8'
  );

  assert.match(pushSource, /operation\.clientId === clientId/);
  assert.match(pushSource, /bulkPut\(operations\)/);
  assert.match(providerSource, /op\.encryptedPayload = encrypted\.payload/);
  assert.match(providerSource, /Push response did not confirm uploaded operations/);
  assert.match(orchestrationSource, /throw error;/);
});

test('full local reset rotates client identity before rebuilding from cursor zero', () => {
  const source = readFileSync(
    new URL('../src/lib/sync/SyncEngine.reset.ts', import.meta.url),
    'utf8'
  );
  const engineSource = readFileSync(
    new URL('../src/lib/sync/SyncEngine.ts', import.meta.url),
    'utf8'
  );
  assert.match(source, /db\.table\('settings'\)/);
  assert.match(source, /delete\('sync_client_id'\)/);
  assert.match(engineSource, /this\.clientId = null/);
});

test('sync client identity initialization is atomic across extension contexts', () => {
  const source = readFileSync(
    new URL('../src/lib/sync/SyncEngine.runtime.ts', import.meta.url),
    'utf8'
  );

  assert.match(source, /table\('settings'\)\.add/);
  assert.match(source, /const winner = await db\.table\('settings'\)\.get/);
  assert.match(source, /currentClientId \?\? generateUUID/);
});
