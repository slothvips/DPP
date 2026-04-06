import { fetchTodayNews } from '@/features/hotNews/api';
import { fetchAllJobs } from '@/features/jenkins/api/fetchJobs';
import { fetchMyBuilds } from '@/features/jenkins/api/fetchMyBuilds';
import { getJenkinsCredentials } from '@/lib/db/jenkins';
import { getSetting, updateSetting } from '@/lib/db/settings';
import { syncDatabase } from '@/lib/sync/api';
import { logger } from '@/utils/logger';

export async function performGlobalSync() {
  interface SyncResult {
    module: string;
    success: boolean;
    error?: string;
  }

  const results: SyncResult[] = [];

  try {
    const currentStatus = await getSetting('global_sync_status');
    if (currentStatus === 'syncing') {
      logger.info('[GlobalSync] Sync already in progress, skipping...');
      return [];
    }

    await updateSetting('global_sync_status', 'syncing');
    await updateSetting('global_sync_start_time', Date.now());
    await updateSetting('global_sync_error', '');

    // Sync Database
    try {
      await syncDatabase();
      results.push({ module: 'database', success: true });
      logger.info('[GlobalSync] Database sync completed');
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      logger.error('[GlobalSync] Database sync failed:', e);
      results.push({ module: 'database', success: false, error });
    }

    // Sync Jenkins
    try {
      const { host, user, token, envId } = await getJenkinsCredentials();
      await Promise.all([
        fetchAllJobs(host, user, token, envId),
        fetchMyBuilds(host, user, token, envId),
      ]);
      results.push({ module: 'jenkins', success: true });
      logger.info('[GlobalSync] Jenkins sync completed');
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      if (error === 'Jenkins credentials not configured') {
        logger.debug('[GlobalSync] Jenkins credentials not configured, skipping');
      } else {
        logger.error('[GlobalSync] Jenkins sync failed:', e);
        results.push({ module: 'jenkins', success: false, error });
      }
    }

    // Sync Hot News
    try {
      await fetchTodayNews();
      results.push({ module: 'hotNews', success: true });
      logger.info('[GlobalSync] Hot news sync completed');
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      logger.error('[GlobalSync] Hot news sync failed:', e);
      results.push({ module: 'hotNews', success: false, error });
    }

    // Update sync metadata
    await updateSetting('last_global_sync', Date.now());

    // Check for failures
    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
      const failedModules = failures.map((f) => f.module).join(', ');
      const errorDetails = failures.map((f) => `${f.module}: ${f.error}`).join('; ');

      await updateSetting('global_sync_status', 'partial');
      await updateSetting(
        'global_sync_error',
        `部分模块同步失败 (${failedModules}): ${errorDetails}`
      );

      logger.warn(`[GlobalSync] Partial success. Failed modules: ${failedModules}`);
    } else {
      await updateSetting('global_sync_status', 'idle');
      await updateSetting('global_sync_error', '');
      logger.info('[GlobalSync] All modules synced successfully');
    }

    return results;
  } catch (err) {
    logger.error('[GlobalSync] Critical failure:', err);
    await updateSetting('global_sync_status', 'error');
    await updateSetting('global_sync_error', err instanceof Error ? err.message : 'Unknown error');
    throw err;
  }
}
