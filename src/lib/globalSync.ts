import { type JenkinsEnvironment, db } from '@/db';
import { fetchTodayNews } from '@/features/hotNews/api';
import { fetchAllJobs } from '@/features/jenkins/api/fetchJobs';
import { fetchMyBuilds } from '@/features/jenkins/api/fetchMyBuilds';
import { syncLinks } from '@/features/links/api';
import { logger } from '@/utils/logger';

export async function performGlobalSync() {
  interface SyncResult {
    module: string;
    success: boolean;
    error?: string;
  }

  const results: SyncResult[] = [];

  try {
    await db.settings.put({ key: 'global_sync_status', value: 'syncing' });
    await db.settings.put({ key: 'global_sync_start_time', value: Date.now() });
    await db.settings.put({ key: 'global_sync_error', value: '' });

    // Sync Links
    try {
      await syncLinks();
      results.push({ module: 'links', success: true });
      logger.info('[GlobalSync] Links sync completed');
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      logger.error('[GlobalSync] Links sync failed:', e);
      results.push({ module: 'links', success: false, error });
    }

    // Sync Jenkins
    const settings = await db.settings.toArray();
    const currentEnvId = settings.find((s) => s.key === 'jenkins_current_env')?.value as string;
    const environments =
      (settings.find((s) => s.key === 'jenkins_environments')?.value as JenkinsEnvironment[]) || [];

    let jenkinsHost = settings.find((s) => s.key === 'jenkins_host')?.value as string;
    let jenkinsUser = settings.find((s) => s.key === 'jenkins_user')?.value as string;
    let jenkinsToken = settings.find((s) => s.key === 'jenkins_token')?.value as string;
    let envId = 'default';

    if (currentEnvId && environments.length > 0) {
      const env = environments.find((e) => e.id === currentEnvId);
      if (env) {
        jenkinsHost = env.host;
        jenkinsUser = env.user;
        jenkinsToken = env.token;
        envId = env.id;
      }
    }

    if (jenkinsHost && jenkinsUser && jenkinsToken) {
      try {
        await Promise.all([
          fetchAllJobs(jenkinsHost, jenkinsUser, jenkinsToken, envId),
          fetchMyBuilds(jenkinsHost, jenkinsUser, jenkinsToken, envId),
        ]);
        results.push({ module: 'jenkins', success: true });
        logger.info('[GlobalSync] Jenkins sync completed');
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        logger.error('[GlobalSync] Jenkins sync failed:', e);
        results.push({ module: 'jenkins', success: false, error });
      }
    } else {
      logger.debug('[GlobalSync] Jenkins credentials not configured, skipping');
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
    await db.settings.put({ key: 'last_global_sync', value: Date.now() });

    // Check for failures
    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
      const failedModules = failures.map((f) => f.module).join(', ');
      const errorDetails = failures.map((f) => `${f.module}: ${f.error}`).join('; ');

      await db.settings.put({ key: 'global_sync_status', value: 'partial' });
      await db.settings.put({
        key: 'global_sync_error',
        value: `部分模块同步失败 (${failedModules}): ${errorDetails}`,
      });

      logger.warn(`[GlobalSync] Partial success. Failed modules: ${failedModules}`);
    } else {
      await db.settings.put({ key: 'global_sync_status', value: 'idle' });
      logger.info('[GlobalSync] All modules synced successfully');
    }

    return results;
  } catch (err) {
    logger.error('[GlobalSync] Critical failure:', err);
    await db.settings.put({ key: 'global_sync_status', value: 'error' });
    await db.settings.put({
      key: 'global_sync_error',
      value: err instanceof Error ? err.message : 'Unknown error',
    });
    throw err;
  }
}
