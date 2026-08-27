const SYNC_ENGINE_LOCK_NAME = 'dpp-sync-engine';

let fallbackLock = Promise.resolve();

export async function withSyncEngineLock<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return await navigator.locks.request(SYNC_ENGINE_LOCK_NAME, operation);
  }

  const previous = fallbackLock;
  let release = () => {};
  fallbackLock = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}
