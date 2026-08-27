import Dexie from 'dexie';
import { db } from '@/db';
import { withSyncEngineLock } from '@/lib/sync/SyncEngine.runtime';
import { logger } from '@/utils/logger';

async function clearWebStorage(): Promise<void> {
  try {
    localStorage.clear();
  } catch (error) {
    logger.warn('Failed to clear localStorage', error);
  }

  try {
    sessionStorage.clear();
  } catch (error) {
    logger.warn('Failed to clear sessionStorage', error);
  }
}

async function clearExtensionStorage(): Promise<void> {
  const tasks: Array<Promise<unknown>> = [browser.storage.local.clear()];

  if (browser.storage.session) {
    tasks.push(browser.storage.session.clear());
  }

  // 未声明 sync 权限时可能失败，忽略即可
  if (browser.storage.sync) {
    tasks.push(
      browser.storage.sync.clear().catch((error: unknown) => {
        logger.warn('Failed to clear browser.storage.sync', error);
      })
    );
  }

  await Promise.all(tasks);
}

async function clearIndexedDatabases(): Promise<void> {
  // 先关并删主库
  await db.delete();

  // 再扫扩展源下所有 IndexedDB，避免遗留库/历史库名
  if (typeof indexedDB.databases !== 'function') {
    return;
  }

  try {
    const databases = await indexedDB.databases();
    await Promise.all(
      databases.map(async (info) => {
        if (!info.name) return;
        try {
          await Dexie.delete(info.name);
        } catch (error) {
          logger.warn(`Failed to delete IndexedDB database: ${info.name}`, error);
        }
      })
    );
  } catch (error) {
    logger.warn('Failed to enumerate IndexedDB databases', error);
  }
}

async function clearCacheStorage(): Promise<void> {
  if (typeof caches === 'undefined') return;

  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch (error) {
    logger.warn('Failed to clear Cache Storage', error);
  }
}

/**
 * 清空本扩展在本机的全部数据：IndexedDB、local/sessionStorage、
 * chrome.storage（local/session/sync）、Cache Storage。
 * 含验证器、个人私钥等一切本地数据，不可恢复。
 */
export async function clearAllLocalData(): Promise<void> {
  await withSyncEngineLock(async () => {
    await clearIndexedDatabases();
    await clearWebStorage();
    await clearExtensionStorage();
    await clearCacheStorage();
  });
  logger.info('All local extension data cleared');
}
