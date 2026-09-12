// Jenkins message handlers for background script
import { downloadArtifact } from '@/features/jenkins/api/artifacts';
import { cancelBuild, getJobDetails, stopBuild, triggerBuild } from '@/features/jenkins/api/build';
import {
  getBuildDetails,
  getBuildLogChunk,
  getTestDetails,
} from '@/features/jenkins/api/buildDetails';
import { getBuildSummary } from '@/features/jenkins/api/buildStatus';
import { probeJenkinsCapabilities } from '@/features/jenkins/api/capabilities';
import { JenkinsApiError } from '@/features/jenkins/api/contracts';
import { fetchActiveBuilds } from '@/features/jenkins/api/fetchActiveBuilds';
import { fetchAllJobs } from '@/features/jenkins/api/fetchJobs';
import { fetchMyBuilds } from '@/features/jenkins/api/fetchMyBuilds';
import { getJobBuilds } from '@/features/jenkins/api/jobBuilds';
import {
  getPipelineNodeLog,
  getPipelineStageNodes,
  getPipelineStages,
  submitPipelineInput,
} from '@/features/jenkins/api/pipeline';
import { cancelQueueItem, getQueueItem, listQueue } from '@/features/jenkins/api/queue';
import { type JenkinsFeatureKey, isJenkinsFeatureEnabled } from '@/features/jenkins/featureFlags';
import type { JenkinsMessage, JenkinsResponse } from '@/features/jenkins/messages';
import {
  flushJenkinsMetrics,
  recordJenkinsQueue,
  recordJenkinsRequest,
} from '@/features/jenkins/metrics';
import { getJenkinsCredentials as resolveJenkinsCredentials } from '@/lib/db/jenkins';
import {
  createJenkinsBuildOperation,
  recordJenkinsQueueState,
  saveJenkinsCapabilities,
  saveJenkinsPipelineCapability,
  saveJenkinsQueueItem,
  updateJenkinsBuildOperation,
  updateJenkinsBuildOperationByQueue,
} from '@/lib/db/jenkins';
import { logger } from '@/utils/logger';

export type { JenkinsMessage, JenkinsResponse };

/**
 * Handle Jenkins messages
 */
export async function handleJenkinsMessage(message: JenkinsMessage): Promise<JenkinsResponse> {
  let activeEnvId: string | undefined;
  let requestOk = false;
  const credentialsFor = async (targetEnvId?: string) => {
    const credentials = await resolveJenkinsCredentials(targetEnvId);
    activeEnvId = credentials.envId;
    return credentials;
  };
  try {
    const requiredFeature: JenkinsFeatureKey | undefined =
      message.type === 'JENKINS_FETCH_JOBS' ||
      message.type === 'JENKINS_FETCH_MY_BUILDS' ||
      message.type === 'JENKINS_FETCH_ACTIVE_BUILDS' ||
      message.type === 'JENKINS_FETCH_JOB_BUILDS' ||
      message.type === 'JENKINS_GET_BUILD_STATUS' ||
      message.type === 'JENKINS_GET_JOB_DETAILS' ||
      message.type === 'JENKINS_GET_BUILD_DETAILS' ||
      message.type === 'JENKINS_GET_TEST_DETAILS'
        ? 'workbench'
        : message.type === 'JENKINS_GET_QUEUE_ITEM' ||
            message.type === 'JENKINS_CANCEL_QUEUE_ITEM' ||
            message.type === 'JENKINS_FETCH_QUEUE'
          ? 'queue'
          : message.type === 'JENKINS_TRIGGER_BUILD' ||
              message.type === 'JENKINS_CANCEL_BUILD' ||
              message.type === 'JENKINS_STOP_BUILD'
            ? 'buildLifecycle'
            : message.type === 'JENKINS_GET_BUILD_LOG'
              ? 'fullLog'
              : message.type === 'JENKINS_DOWNLOAD_ARTIFACT'
                ? 'artifacts'
                : message.type === 'JENKINS_GET_PIPELINE_STAGES' ||
                    message.type === 'JENKINS_GET_PIPELINE_STAGE_NODES' ||
                    message.type === 'JENKINS_GET_PIPELINE_NODE_LOG' ||
                    message.type === 'JENKINS_SUBMIT_PIPELINE_INPUT'
                  ? 'pipeline'
                  : undefined;
    if (requiredFeature && !(await isJenkinsFeatureEnabled(requiredFeature))) {
      throw new Error(`Jenkins 能力已关闭：${requiredFeature}`);
    }

    let data: unknown;

    switch (message.type) {
      case 'JENKINS_FETCH_JOBS': {
        const { host, user, token, envId } = await credentialsFor();
        data = await fetchAllJobs(host, user, token, envId);
        void probeJenkinsCapabilities(host, user, token)
          .then((snapshot) => saveJenkinsCapabilities(envId, snapshot))
          .catch((error: unknown) => logger.warn('Jenkins capability probe failed', error));
        break;
      }
      case 'JENKINS_FETCH_MY_BUILDS': {
        const { host, user, token, envId } = await credentialsFor();
        data = await fetchMyBuilds(host, user, token, envId, message.payload?.maxBuildsPerJob);
        break;
      }
      case 'JENKINS_FETCH_ACTIVE_BUILDS': {
        const { host, user, token, envId } = await credentialsFor();
        data = await fetchActiveBuilds(host, user, token, envId);
        break;
      }
      case 'JENKINS_FETCH_QUEUE': {
        const { host, user, token } = await credentialsFor(message.payload?.envId);
        recordJenkinsQueue('poll');
        data = await listQueue(user, token, host);
        break;
      }
      case 'JENKINS_FETCH_JOB_BUILDS': {
        const { jobUrl, limit, envId: targetEnvId } = message.payload;
        const { host, user, token } = await credentialsFor(targetEnvId);
        data = await getJobBuilds(jobUrl, user, token, host, limit);
        break;
      }
      case 'JENKINS_GET_BUILD_STATUS': {
        const { buildUrl, envId: targetEnvId } = message.payload;
        const { host, user, token, envId } = await credentialsFor(targetEnvId);
        data = await getBuildSummary(buildUrl, user, token, host, envId);
        break;
      }
      case 'JENKINS_TRIGGER_BUILD': {
        const { jobUrl, parameters, envId: targetEnvId, operationId } = message.payload;
        const { host, user, token, envId } = await credentialsFor(targetEnvId);
        const resolvedOperationId = operationId || crypto.randomUUID();
        if (envId) {
          await createJenkinsBuildOperation({
            id: resolvedOperationId,
            envId,
            jobUrl,
            parameters,
          });
        }
        try {
          const result = await triggerBuild(jobUrl, user, token, host, parameters);
          result.operationId = resolvedOperationId;
          if (envId) {
            await updateJenkinsBuildOperation(resolvedOperationId, {
              status: result.status === 'accepted' ? 'accepted' : 'unknown',
              queueId: result.queueId,
            });
            if (result.queueId) {
              await saveJenkinsQueueItem(envId, {
                id: result.queueId,
                state: 'queued',
                jobUrl,
              });
            }
          }
          data = result;
        } catch (error) {
          if (envId) {
            const unknownOutcome =
              error instanceof JenkinsApiError &&
              (error.code === 'timeout' || error.code === 'offline');
            await updateJenkinsBuildOperation(resolvedOperationId, {
              status: unknownOutcome ? 'unknown' : 'failed',
              errorCode: error instanceof JenkinsApiError ? error.code : 'unknown',
            });
          }
          throw error;
        }
        break;
      }
      case 'JENKINS_GET_QUEUE_ITEM': {
        const { queueId, envId: targetEnvId } = message.payload;
        const { host, user, token, envId } = await credentialsFor(targetEnvId);
        recordJenkinsQueue('poll');
        let item: Awaited<ReturnType<typeof getQueueItem>>;
        try {
          item = await getQueueItem(queueId, user, token, host);
        } catch (error) {
          if (!(error instanceof JenkinsApiError) || error.code !== 'not_found') {
            if (
              error instanceof JenkinsApiError &&
              (error.code === 'timeout' || error.code === 'offline')
            ) {
              await recordJenkinsQueueState(envId, { timedOut: true });
            }
            throw error;
          }
          item = { id: queueId, state: 'expired' as const };
        }
        await saveJenkinsQueueItem(envId, item);
        await recordJenkinsQueueState(envId, {
          state: item.state,
          expired: item.state === 'expired',
          reason: item.why,
        });
        await updateJenkinsBuildOperationByQueue(envId, queueId, {
          status:
            item.state === 'executable'
              ? 'completed'
              : item.state === 'cancelled' || item.state === 'expired'
                ? 'failed'
                : 'accepted',
          buildId: item.buildUrl,
        });
        data = item;
        break;
      }
      case 'JENKINS_CANCEL_QUEUE_ITEM': {
        const { queueId, envId: targetEnvId } = message.payload;
        const { host, user, token, envId } = await credentialsFor(targetEnvId);
        recordJenkinsQueue('cancel');
        data = await cancelQueueItem(queueId, user, token, host);
        await saveJenkinsQueueItem(envId, {
          id: queueId,
          state: 'cancelled',
        });
        break;
      }
      case 'JENKINS_GET_JOB_DETAILS': {
        const { jobUrl, envId: targetEnvId } = message.payload;
        const { host, user, token } = await credentialsFor(targetEnvId);
        data = await getJobDetails(jobUrl, user, token, host);
        break;
      }
      case 'JENKINS_GET_BUILD_LOG': {
        const { buildUrl, start, envId: targetEnvId } = message.payload;
        const { host, user, token } = await credentialsFor(targetEnvId);
        data = await getBuildLogChunk(buildUrl, user, token, host, start);
        break;
      }
      case 'JENKINS_GET_BUILD_DETAILS': {
        const { buildUrl, envId: targetEnvId, consoleTailLines } = message.payload;
        const { host, user, token } = await credentialsFor(targetEnvId);
        const canReadLog = consoleTailLines ? await isJenkinsFeatureEnabled('fullLog') : false;
        data = await getBuildDetails(
          buildUrl,
          user,
          token,
          host,
          canReadLog ? (consoleTailLines ?? 0) : 0
        );
        break;
      }
      case 'JENKINS_GET_TEST_DETAILS': {
        const { buildUrl, envId: targetEnvId } = message.payload;
        const { host, user, token } = await credentialsFor(targetEnvId);
        data = await getTestDetails(buildUrl, user, token, host);
        break;
      }
      case 'JENKINS_DOWNLOAD_ARTIFACT': {
        const { buildUrl, relativePath, envId: targetEnvId } = message.payload;
        const { host, user, token } = await credentialsFor(targetEnvId);
        data = await downloadArtifact(buildUrl, relativePath, user, token, host);
        break;
      }
      case 'JENKINS_GET_PIPELINE_STAGES': {
        const { buildUrl, envId: targetEnvId } = message.payload;
        const { host, user, token, envId } = await credentialsFor(targetEnvId);
        const result = await getPipelineStages(buildUrl, user, token, host);
        await saveJenkinsPipelineCapability(envId, {
          status: result.capability === 'missing' ? 'unknown' : result.capability,
          checkedAt: Date.now(),
          reason: result.reason,
        });
        data = result;
        break;
      }
      case 'JENKINS_GET_PIPELINE_STAGE_NODES': {
        const { buildUrl, stageId, envId: targetEnvId } = message.payload;
        const { host, user, token } = await credentialsFor(targetEnvId);
        data = await getPipelineStageNodes(buildUrl, stageId, user, token, host);
        break;
      }
      case 'JENKINS_GET_PIPELINE_NODE_LOG': {
        const { buildUrl, nodeId, envId: targetEnvId } = message.payload;
        const { host, user, token } = await credentialsFor(targetEnvId);
        data = await getPipelineNodeLog(buildUrl, nodeId, user, token, host);
        break;
      }
      case 'JENKINS_SUBMIT_PIPELINE_INPUT': {
        const { buildUrl, inputId, decision, envId: targetEnvId } = message.payload;
        const { host, user, token } = await credentialsFor(targetEnvId);
        data = await submitPipelineInput(buildUrl, inputId, decision, user, token, host);
        break;
      }
      case 'JENKINS_CANCEL_BUILD': {
        const { jobUrl, buildNumber, envId: targetEnvId } = message.payload;
        const { host, user, token } = await credentialsFor(targetEnvId);
        data = await cancelBuild(jobUrl, buildNumber, user, token, host);
        break;
      }
      case 'JENKINS_STOP_BUILD': {
        const { buildUrl, envId: targetEnvId } = message.payload;
        const { host, user, token } = await credentialsFor(targetEnvId);
        data = await stopBuild(buildUrl, user, token, host);
        break;
      }
    }
    requestOk = true;
    return { success: true, data };
  } catch (e) {
    const err = e as Error;
    if (activeEnvId) {
      recordJenkinsRequest({
        ok: false,
        code: e instanceof JenkinsApiError ? e.code : undefined,
      });
    }
    logger.error(`Jenkins action ${message.type} failed:`, err);
    return { success: false, error: err.message || String(e) };
  } finally {
    if (requestOk && activeEnvId) {
      recordJenkinsRequest({ ok: true });
    }
    if (activeEnvId) {
      void flushJenkinsMetrics(activeEnvId);
    }
  }
}
