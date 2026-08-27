import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { withSyncEngineLock } from '../src/lib/sync/SyncEngine.lock.ts';

function deferred() {
  let resolve = () => {};
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('sync engine lock serializes concurrent operations', async () => {
  const firstStarted = deferred();
  const releaseFirst = deferred();
  const events = [];

  const first = withSyncEngineLock(async () => {
    events.push('first:start');
    firstStarted.resolve();
    await releaseFirst.promise;
    events.push('first:end');
  });
  await firstStarted.promise;

  const second = withSyncEngineLock(async () => {
    events.push('second:start');
    events.push('second:end');
  });
  await Promise.resolve();

  assert.deepEqual(events, ['first:start']);
  releaseFirst.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(events, ['first:start', 'first:end', 'second:start', 'second:end']);
});

test('sync engine lock releases the queue after a failure', async () => {
  await assert.rejects(
    withSyncEngineLock(async () => {
      throw new Error('expected failure');
    }),
    /expected failure/
  );

  let completed = false;
  await withSyncEngineLock(async () => {
    completed = true;
  });
  assert.equal(completed, true);
});

test('sync engine lock uses the shared Web Lock name when available', async () => {
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const navigatorObject = globalThis.navigator ?? {};
  if (!globalThis.navigator) {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigatorObject });
  }
  const originalDescriptor = Object.getOwnPropertyDescriptor(navigatorObject, 'locks');
  const requestedNames = [];

  Object.defineProperty(navigatorObject, 'locks', {
    configurable: true,
    value: {
      request: async (name, operation) => {
        requestedNames.push(name);
        return await operation();
      },
    },
  });

  try {
    const result = await withSyncEngineLock(async () => 'completed');
    assert.equal(result, 'completed');
    assert.deepEqual(requestedNames, ['dpp-sync-engine']);
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(navigatorObject, 'locks', originalDescriptor);
    } else {
      Reflect.deleteProperty(navigatorObject, 'locks');
    }
    if (originalNavigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'navigator');
    }
  }
});

test('sync engine composite flows use unlocked methods without reentrant locking', () => {
  const source = readFileSync(new URL('../src/lib/sync/SyncEngine.ts', import.meta.url), 'utf8');
  const migration = source.match(/public async migrateTeamKey[\s\S]*?\n  }\n}/)?.[0];

  assert.ok(migration);
  assert.doesNotMatch(source, /exclusiveDepth/);
  assert.match(migration, /resetSyncStateUnlocked/);
  assert.match(migration, /regenerateOperationsUnlocked/);
  assert.match(migration, /pushUnlocked/);
  assert.match(migration, /clearAllDataUnlocked/);
  assert.match(migration, /pullUnlocked/);
  assert.match(migration, /await storeKey\(key\)/);
});

test('automatic push preserves global sync status coordination', () => {
  const source = readFileSync(
    new URL('../src/entrypoints/background/handlers/syncMessages.ts', import.meta.url),
    'utf8'
  );
  const handler = source.match(
    /export async function handleAutoSyncPush[\s\S]*?\n}\n\nexport async function handleAutoSyncPull/
  )?.[0];

  assert.ok(handler);
  assert.match(handler, /await isGlobalSyncRunning\(\)/);
  assert.match(handler, /await withGlobalSyncStatus\(\(\) => syncEngine\.push\(\)\)/);
});
