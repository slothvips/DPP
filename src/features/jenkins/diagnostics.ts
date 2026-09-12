import { db } from '@/db';
import type {
  JenkinsCapabilitySnapshot,
  JenkinsMetricSnapshot,
  JenkinsQueueState,
  JenkinsSyncStateRecord,
} from '@/db';
import { getSetting } from '@/lib/db/settings';

const STALE_THRESHOLD_MS = 15 * 60_000;

export interface JenkinsDiagnostics {
  envId: string | null;
  status: JenkinsSyncStateRecord['status'] | 'unknown';
  stale: boolean;
  lastAttemptAt?: number;
  lastSuccessAt?: number;
  errorCode?: string;
  errorMessage?: string;
  capabilities?: JenkinsCapabilitySnapshot;
  pipelineCapability?: {
    status: string;
    reason?: string;
    checkedAt: number;
  };
  queueState?: JenkinsQueueState;
  metrics?: JenkinsMetricSnapshot;
}

export async function getJenkinsDiagnostics(envId?: string): Promise<JenkinsDiagnostics> {
  const currentEnvId = await getSetting('jenkins_current_env');
  const resolvedEnvId = envId ?? currentEnvId;

  if (!resolvedEnvId) {
    return { envId: null, status: 'unknown', stale: false };
  }

  if (envId && envId !== currentEnvId) {
    const environments = (await getSetting('jenkins_environments')) || [];
    if (!environments.some((environment) => environment.id === envId)) {
      throw new Error(`找不到指定的 Jenkins 环境: ${envId}`);
    }
  }

  const state = await db.jenkinsSyncState.get(resolvedEnvId);
  const lastSuccessAt = state?.lastSuccessAt;

  return {
    envId: resolvedEnvId,
    status: state?.status ?? 'unknown',
    stale: Boolean(lastSuccessAt && Date.now() - lastSuccessAt > STALE_THRESHOLD_MS),
    lastAttemptAt: state?.lastAttemptAt,
    lastSuccessAt,
    errorCode: state?.errorCode,
    errorMessage: state?.errorMessage,
    capabilities: state?.capabilities,
    pipelineCapability: state?.capabilities?.pipelineRest,
    queueState: state?.queueState,
    metrics: state?.metrics,
  };
}
