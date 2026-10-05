import type Dexie from 'dexie';
import { logger } from '@/utils/logger';

/**
 * 已同步本地操作（operations 表 synced=1）的保留期。
 * 过期清理是安全的：回拉时本端发出的 op 靠稳定的 clientId 过滤，
 * 远端 op 的应用幂等由 remoteActivityLog（有上限修剪）保证。
 */
const SYNCED_OP_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * 清理保留期之外已推送的操作记录，防止 operations 表随使用时间无限增长。
 * 清理失败只告警、不影响同步主流程。
 *
 * @returns 清理掉的记录数
 */
export async function pruneSyncedOperations(db: Dexie, now = Date.now()): Promise<number> {
  try {
    const cutoff = now - SYNCED_OP_RETENTION_MS;
    const staleIds = await db
      .table('operations')
      .where('timestamp')
      .below(cutoff)
      .filter((operation) => (operation as { synced?: number }).synced === 1)
      .primaryKeys();
    if (staleIds.length === 0) {
      return 0;
    }
    await db.table('operations').bulkDelete(staleIds);
    logger.info(`[Sync] Pruned ${staleIds.length} synced operations past retention`);
    return staleIds.length;
  } catch (error) {
    logger.warn('[Sync] Failed to prune synced operations:', error);
    return 0;
  }
}
