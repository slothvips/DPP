import { loadPersonalKey } from '@/lib/crypto/personalKey';
import { getSetting, updateSetting } from '@/lib/db/settings';
import { logger } from '@/utils/logger';
import type { SyncEngine } from './SyncEngine';

const BOOTSTRAP_SETTING = 'personal_sync_bootstrap_done' as const;

type PersonalSyncEngine = Pick<SyncEngine, 'enqueuePersonalData' | 'sync'>;

/** 个人私钥写入后：补建个人表同步队列，并标记 bootstrap 完成 */
export async function bootstrapPersonalSyncAfterKeyReady(
  engine: Pick<SyncEngine, 'enqueuePersonalData'>
): Promise<number> {
  const enqueued = await engine.enqueuePersonalData();
  await updateSetting(BOOTSTRAP_SETTING, true);
  return enqueued;
}

export type PersonalKeyFinalizeStep = 'enqueue' | 'sync';

/**
 * 个人私钥写入后：补建个人表同步队列，并上传、拉取数据。
 */
export async function finalizePersonalSyncAfterKeyReady(
  engine: PersonalSyncEngine,
  onStep?: (step: PersonalKeyFinalizeStep) => void
): Promise<number> {
  onStep?.('enqueue');
  const enqueued = await bootstrapPersonalSyncAfterKeyReady(engine);
  onStep?.('sync');
  await engine.sync();
  return enqueued;
}

/**
 * 扩展启动时：若已有个人私钥但尚未 bootstrap（例如版本升级刚纳入 totp），补建一次。
 * 不会在每次启动重复全量 enqueue，也不会做破坏性重建。
 */
export async function ensurePersonalSyncBootstrapped(
  engine: Pick<SyncEngine, 'enqueuePersonalData'>
): Promise<void> {
  try {
    const key = await loadPersonalKey();
    if (!key) {
      return;
    }

    const done = await getSetting(BOOTSTRAP_SETTING);
    if (done === true) {
      return;
    }

    const enqueued = await engine.enqueuePersonalData();
    await updateSetting(BOOTSTRAP_SETTING, true);
    if (enqueued > 0) {
      logger.info(`[Sync] Personal sync bootstrap enqueued ${enqueued} ops`);
    }
  } catch (error) {
    logger.warn('[Sync] Personal sync bootstrap failed', error);
    throw error;
  }
}

export async function resetPersonalSyncBootstrapFlag(): Promise<void> {
  await updateSetting(BOOTSTRAP_SETTING, false);
}
