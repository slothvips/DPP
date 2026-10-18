import Dexie from 'dexie';
import { logger } from '@/utils/logger';
import { registerDatabaseSchema } from './schema';
import { createSyncEngineFacade, getSyncEngine as loadSyncEngine } from './syncEngine';
import type {
  DPPDatabase,
  HotNewsCache,
  JobItem,
  JobTagItem,
  LinkItem,
  MyBuildItem,
  TagItem,
} from './types';

export * from './types';
export type { Recording } from '@/features/recorder/types';

export const db = new Dexie('DPPDB') as DPPDatabase;

registerDatabaseSchema(db);

// 同步钩子跟随每个运行上下文自己的 Dexie 实例(设置页、黑板单页等页面引入本模块时会得到
// 一个新实例),必须在模块加载时就注册同步引擎,否则这些上下文里的写库不会产生同步操作
// —— 设置页保存消息配置曾因此不进团队共享(见 tests/syncHookRegistration.test.mjs)。
// 无 indexedDB 的环境(Node 单测引用本模块)跳过,由显式 getSyncEngine 调用方控制。
if (typeof indexedDB !== 'undefined') {
  void loadSyncEngine(db, { start: false }).catch((error) => {
    logger.warn('[DB] Sync engine bootstrap at module load failed', error);
  });
}

export async function getSyncEngine() {
  return loadSyncEngine(db);
}

export const syncEngine = createSyncEngineFacade(db);

export type { LinkItem, JobItem, TagItem, JobTagItem, MyBuildItem, HotNewsCache };
