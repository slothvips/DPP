import type {
  JenkinsBuildOperationRecord,
  JenkinsBuildRecord,
  JenkinsJobRecord,
  JenkinsQueueItemRecord,
  JenkinsSyncStateRecord,
  JobItem,
  MyBuildItem,
  OthersBuildItem,
} from '@/db';
import { db } from '@/db';
import { fetchAllJobs } from '@/features/jenkins/api/fetchJobs';
import { fetchMyBuilds } from '@/features/jenkins/api/fetchMyBuilds';
import type { JenkinsQueueItem } from '@/features/jenkins/api/queue';
import { flushJenkinsMetrics } from '@/features/jenkins/metrics';
import { getSetting, updateSetting } from '@/lib/db/settings';
import { logger } from '@/utils/logger';
import { isSensitiveFieldName, redactSensitiveText } from '@/utils/sensitive';

type JenkinsRefreshSettingKey =
  | 'jenkins_builds_last_refresh_by_env'
  | 'jenkins_jobs_last_refresh_by_env';

type JenkinsSyncStatusPatch = Pick<JenkinsSyncStateRecord, 'status' | 'errorCode' | 'errorMessage'>;

async function saveJenkinsSyncState(envId: string, patch: JenkinsSyncStatusPatch): Promise<void> {
  try {
    await db.transaction('rw', db.jenkinsSyncState, async () => {
      const existing = await db.jenkinsSyncState.get(envId);
      const now = Date.now();
      const status =
        patch.status === 'success' &&
        (existing?.status === 'error' || existing?.status === 'offline')
          ? 'partial'
          : patch.status;
      await db.jenkinsSyncState.put({
        ...existing,
        envId,
        status,
        lastAttemptAt: patch.status === 'syncing' ? now : existing?.lastAttemptAt,
        lastSuccessAt: patch.status === 'success' ? now : existing?.lastSuccessAt,
        errorCode: patch.errorCode,
        errorMessage: patch.errorMessage
          ? redactSensitiveText(patch.errorMessage).slice(0, 300)
          : undefined,
      });
    });
  } catch (error) {
    logger.warn('Failed to persist Jenkins sync diagnostics', error);
  }
}

function getJenkinsErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = error.code;
    if (typeof code === 'string' && code) return code;
  }
  if (error instanceof Error && error.name) return error.name;
  return 'unknown';
}

function getJenkinsErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Jenkins 请求失败';
}

export async function trackJenkinsSync<T>(envId: string, operation: () => Promise<T>): Promise<T> {
  await saveJenkinsSyncState(envId, { status: 'syncing' });
  try {
    const result = await operation();
    await saveJenkinsSyncState(envId, { status: 'success' });
    void flushJenkinsMetrics(envId);
    return result;
  } catch (error) {
    await saveJenkinsSyncState(envId, {
      status: error instanceof TypeError ? 'offline' : 'error',
      errorCode: getJenkinsErrorCode(error),
      errorMessage: getJenkinsErrorMessage(error),
    });
    void flushJenkinsMetrics(envId);
    throw error;
  }
}

export async function createJenkinsBuildOperation(args: {
  id: string;
  envId: string;
  jobUrl: string;
  parameters?: Record<string, string | boolean | number>;
}): Promise<void> {
  const parameterSummary = summarizeJenkinsParameters(args.parameters);
  const existing = await db.jenkinsBuildOperations.get(args.id);
  if (existing) {
    throw new Error('该构建操作已提交，请先确认其队列状态');
  }
  const duplicate = await db.jenkinsBuildOperations
    .where('envId')
    .equals(args.envId)
    .filter(
      (operation) =>
        operation.jobUrl === args.jobUrl &&
        ['pending', 'accepted', 'unknown'].includes(operation.status) &&
        operation.createdAt > Date.now() - 5 * 60_000 &&
        JSON.stringify(operation.parameterSummary || {}) === JSON.stringify(parameterSummary)
    )
    .first();
  if (duplicate) {
    throw new Error('该 Job 存在尚未确认结果的构建操作，请先查询队列后再提交');
  }
  const now = Date.now();
  await db.jenkinsBuildOperations.put({
    id: args.id,
    envId: args.envId,
    jobUrl: args.jobUrl,
    type: 'trigger',
    status: 'pending',
    parameterSummary,
    createdAt: now,
    updatedAt: now,
  });
}

function summarizeJenkinsParameters(
  parameters?: Record<string, string | boolean | number>
): Record<string, string> {
  const summary: Record<string, string> = {};
  for (const [key, value] of Object.entries(parameters || {})) {
    summary[key] = isSensitiveFieldName(key) ? '[redacted]' : String(value).slice(0, 500);
  }
  return summary;
}

export async function updateJenkinsBuildOperation(
  id: string,
  patch: Pick<Partial<JenkinsBuildOperationRecord>, 'status' | 'queueId' | 'buildId' | 'errorCode'>
): Promise<void> {
  await db.jenkinsBuildOperations.update(id, { ...patch, updatedAt: Date.now() });
}

export async function updateJenkinsBuildOperationByQueue(
  envId: string,
  queueId: string,
  patch: Pick<Partial<JenkinsBuildOperationRecord>, 'status' | 'buildId'>
): Promise<void> {
  const operation = await db.jenkinsBuildOperations
    .where('envId')
    .equals(envId)
    .filter((candidate) => candidate.queueId === queueId)
    .first();
  if (operation) {
    await updateJenkinsBuildOperation(operation.id, patch);
  }
}

export async function saveJenkinsQueueItem(envId: string, item: JenkinsQueueItem): Promise<void> {
  const key: [string, string] = [envId, item.id];
  const existing = await db.jenkinsQueueItems.get(key);
  const now = Date.now();
  const record: JenkinsQueueItemRecord = {
    envId,
    queueId: item.id,
    jobUrl: item.jobUrl || existing?.jobUrl || '',
    state: item.state,
    why: item.why,
    buildId: item.buildUrl || existing?.buildId,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await db.jenkinsQueueItems.put(record);
}

export async function saveJenkinsPipelineCapability(
  envId: string,
  pipelineRest: NonNullable<NonNullable<JenkinsSyncStateRecord['capabilities']>['pipelineRest']>
): Promise<void> {
  const existing = await db.jenkinsSyncState.get(envId);
  await db.jenkinsSyncState.put({
    ...existing,
    envId,
    status: existing?.status || 'idle',
    capabilities: {
      ...existing?.capabilities,
      checkedAt: existing?.capabilities?.checkedAt ?? pipelineRest.checkedAt,
      pipelineRest,
    },
  });
}

export async function saveJenkinsCapabilities(
  envId: string,
  snapshot: NonNullable<JenkinsSyncStateRecord['capabilities']>
): Promise<void> {
  await db.transaction('rw', db.jenkinsSyncState, async () => {
    const existing = await db.jenkinsSyncState.get(envId);
    await db.jenkinsSyncState.put({
      ...existing,
      envId,
      status: existing?.status || 'idle',
      capabilities: {
        ...existing?.capabilities,
        ...snapshot,
        // Prefer an already probed Pipeline capability over an unprobed snapshot.
        pipelineRest: existing?.capabilities?.pipelineRest ?? snapshot.pipelineRest,
      },
    });
  });
}

export async function recordJenkinsQueueState(
  envId: string,
  patch: { state?: string; expired?: boolean; reason?: string; timedOut?: boolean }
): Promise<void> {
  await db.transaction('rw', db.jenkinsSyncState, async () => {
    const existing = await db.jenkinsSyncState.get(envId);
    const previous = existing?.queueState;
    await db.jenkinsSyncState.put({
      ...existing,
      envId,
      status: existing?.status || 'idle',
      queueState: {
        lastPollAt: Date.now(),
        state: patch.state ?? previous?.state ?? 'unknown',
        expired: patch.expired ?? previous?.expired ?? false,
        timeouts: (previous?.timeouts ?? 0) + (patch.timedOut ? 1 : 0),
        reason: patch.reason ?? previous?.reason,
      },
    });
  });
}

export async function saveJobs(jobs: JobItem[]): Promise<void> {
  if (jobs.length === 0) return;

  const scopedJobs: JenkinsJobRecord[] = jobs
    .filter(
      (job): job is JobItem & { env: string } => typeof job.env === 'string' && job.env !== ''
    )
    .map((job) => ({ ...job, envId: job.env }));
  if (scopedJobs.length > 0) {
    await db.jenkinsJobs.bulkPut(scopedJobs);
  }
}

export async function pruneJenkinsJobs(envId: string, keepUrls: Set<string>): Promise<void> {
  await db.transaction('rw', ['jenkinsJobs'], async () => {
    await db.jenkinsJobs
      .where('envId')
      .equals(envId)
      .filter((job) => !keepUrls.has(job.url))
      .delete();
  });
}

export async function updateJenkinsRefreshTime(
  settingKey: JenkinsRefreshSettingKey,
  envId: string,
  timestamp = Date.now()
): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const currentSetting = await db.settings.get(settingKey);
    const currentValue = (currentSetting?.value as Record<string, number> | undefined) || {};

    await db.settings.put({
      key: settingKey,
      value: {
        ...currentValue,
        [envId]: timestamp,
      },
    });
  });
}

export async function saveBuilds(
  envId: string,
  myBuilds: MyBuildItem[],
  othersBuilds: OthersBuildItem[]
): Promise<void> {
  const scopedBuilds: JenkinsBuildRecord[] = [...myBuilds, ...othersBuilds].map((build) => ({
    id: build.id,
    envId,
    jobUrl: build.jobUrl,
    jobName: build.jobName,
    number: build.number,
    result: build.result,
    lifecycle: build.building ? 'running' : 'completed',
    building: build.building,
    owner: build.userName,
    timestamp: build.timestamp,
    duration: build.duration,
    lastSeenAt: Date.now(),
  }));
  if (scopedBuilds.length === 0) return;
  await db.jenkinsBuilds.bulkPut(scopedBuilds);
}

export const MAX_OTHERS_BUILDS_PER_ENV = 50;
const MAX_BUILDS_PER_ENV = 500;

function selectStaleBuilds<T extends { timestamp: number }>(rows: T[], keep: number): T[] {
  if (rows.length <= keep) return [];
  return [...rows].sort((left, right) => right.timestamp - left.timestamp).slice(keep);
}

/**
 * Bounds the per-environment build cache so live queries cannot grow unbounded.
 */
export async function pruneJenkinsBuilds(envId: string, keep = MAX_BUILDS_PER_ENV): Promise<void> {
  const rows = await db.jenkinsBuilds.where('envId').equals(envId).toArray();
  const stale = selectStaleBuilds(rows, keep);
  if (stale.length === 0) return;

  const staleIds = new Set(stale.map((build) => build.id));
  await db.jenkinsBuilds
    .where('envId')
    .equals(envId)
    .filter((build) => staleIds.has(build.id))
    .delete();
}

export async function syncJenkins(args: { envId?: string }): Promise<{
  success: boolean;
  message: string;
  syncedCount?: number;
}> {
  try {
    const [environments = [], currentEnvId] = await Promise.all([
      getSetting('jenkins_environments'),
      getSetting('jenkins_current_env'),
    ]);

    const targetEnvId = args.envId || currentEnvId;

    if (!targetEnvId) {
      return {
        success: false,
        message: '未设置当前 Jenkins 环境',
      };
    }

    const env = environments.find((environment) => environment.id === targetEnvId);

    if (!env) {
      return {
        success: false,
        message: `找不到指定的 Jenkins 环境: ${targetEnvId}`,
      };
    }

    const { host, user, token } = env;

    if (!host || !user || !token) {
      return {
        success: false,
        message: `Jenkins 环境 ${targetEnvId} 缺少必要的配置信息`,
      };
    }

    const [jobsCount, builds] = await Promise.all([
      fetchAllJobs(host, user, token, targetEnvId),
      fetchMyBuilds(host, user, token, targetEnvId),
    ]);

    return {
      success: true,
      message: `同步成功: ${jobsCount} 个 Jobs, ${builds.length} 个 Builds`,
      syncedCount: jobsCount + builds.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `同步失败: ${errorMessage}`,
    };
  }
}

export async function switchJenkinsEnv(args: { envId: string }): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const { envId } = args;

    if (!envId) {
      return {
        success: false,
        message: '环境 ID 不能为空',
      };
    }

    const environments = (await getSetting('jenkins_environments')) || [];
    const env = environments.find((environment) => environment.id === envId);

    if (!env) {
      return {
        success: false,
        message: `找不到指定的 Jenkins 环境: ${envId}`,
      };
    }

    await updateSetting('jenkins_current_env', envId);

    return {
      success: true,
      message: `已切换到 Jenkins 环境: ${env.name || envId}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `切换环境失败: ${errorMessage}`,
    };
  }
}

export async function deleteJenkinsEnv(envId: string): Promise<void> {
  await db.transaction(
    'rw',
    [
      'jenkinsJobs',
      'jenkinsBuilds',
      'jenkinsQueueItems',
      'jenkinsSyncState',
      'jenkinsBuildOperations',
    ],
    async () => {
      await Promise.all([
        db.jenkinsJobs.where('envId').equals(envId).delete(),
        db.jenkinsBuilds.where('envId').equals(envId).delete(),
        db.jenkinsQueueItems.where('envId').equals(envId).delete(),
        db.jenkinsSyncState.delete(envId),
        db.jenkinsBuildOperations.where('envId').equals(envId).delete(),
      ]);
    }
  );
}
