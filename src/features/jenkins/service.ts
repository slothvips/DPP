import type { MyBuildItem } from '@/db';
import type { JenkinsQueueItem } from './api/queue';
import type {
  JenkinsArtifactDownload,
  JenkinsBuildDetailsResult,
  JenkinsBuildLogChunk,
  JenkinsJobBuildsResult,
  JenkinsMessage,
  JenkinsPipelineNode,
  JenkinsPipelineNodeLog,
  JenkinsPipelineResult,
  JenkinsResponse,
  JenkinsTestDetailsResult,
  JenkinsTriggerResult,
  TriggerBuildMessage,
} from './messages';

async function send<T>(message: JenkinsMessage): Promise<T> {
  const response = (await browser.runtime.sendMessage(message)) as JenkinsResponse<T>;
  if (!response) {
    throw new Error('Failed to communicate with background service');
  }
  if (!response.success) {
    throw new Error(response.error || 'Unknown error');
  }
  return response.data as T;
}

export const JenkinsService = {
  async fetchAllJobs(): Promise<number> {
    return send<number>({ type: 'JENKINS_FETCH_JOBS' });
  },

  async fetchMyBuilds(maxBuildsPerJob?: number): Promise<MyBuildItem[]> {
    const result = await send<MyBuildItem[]>({
      type: 'JENKINS_FETCH_MY_BUILDS',
      payload: { maxBuildsPerJob },
    });
    return Array.isArray(result) ? result : [];
  },

  async fetchActiveBuilds(): Promise<MyBuildItem[]> {
    const result = await send<MyBuildItem[]>({ type: 'JENKINS_FETCH_ACTIVE_BUILDS' });
    return Array.isArray(result) ? result : [];
  },

  async fetchQueue(envId?: string): Promise<JenkinsQueueItem[]> {
    const result = await send<JenkinsQueueItem[]>({
      type: 'JENKINS_FETCH_QUEUE',
      payload: { envId },
    });
    return Array.isArray(result) ? result : [];
  },

  async fetchJobBuilds(
    jobUrl: string,
    envId?: string,
    limit?: number
  ): Promise<JenkinsJobBuildsResult> {
    return send<JenkinsJobBuildsResult>({
      type: 'JENKINS_FETCH_JOB_BUILDS',
      payload: { jobUrl, envId, limit },
    });
  },

  async getBuildSummary(buildUrl: string, envId?: string): Promise<MyBuildItem | null> {
    const result = await send<MyBuildItem | null>({
      type: 'JENKINS_GET_BUILD_STATUS',
      payload: { buildUrl, envId },
    });
    return result && typeof result === 'object' ? result : null;
  },

  async triggerBuild(payload: TriggerBuildMessage['payload']): Promise<JenkinsTriggerResult> {
    return send<JenkinsTriggerResult>({
      type: 'JENKINS_TRIGGER_BUILD',
      payload: { ...payload, operationId: payload.operationId || crypto.randomUUID() },
    });
  },

  async getQueueItem(queueId: string, envId?: string): Promise<JenkinsQueueItem> {
    return send<JenkinsQueueItem>({
      type: 'JENKINS_GET_QUEUE_ITEM',
      payload: { queueId, envId },
    });
  },

  async cancelQueueItem(queueId: string, envId?: string): Promise<boolean> {
    return send<boolean>({
      type: 'JENKINS_CANCEL_QUEUE_ITEM',
      payload: { queueId, envId },
    });
  },

  async stopBuild(buildUrl: string, envId?: string): Promise<boolean> {
    return send<boolean>({
      type: 'JENKINS_STOP_BUILD',
      payload: { buildUrl, envId },
    });
  },

  async getJobDetails(jobUrl: string, envId?: string): Promise<unknown> {
    return send<unknown>({
      type: 'JENKINS_GET_JOB_DETAILS',
      payload: { jobUrl, envId },
    });
  },

  async getBuildLogChunk(
    buildUrl: string,
    start: number,
    envId?: string
  ): Promise<JenkinsBuildLogChunk> {
    return send<JenkinsBuildLogChunk>({
      type: 'JENKINS_GET_BUILD_LOG',
      payload: { buildUrl, start, envId },
    });
  },

  async getBuildDetails(
    buildUrl: string,
    envId?: string,
    consoleTailLines?: number
  ): Promise<JenkinsBuildDetailsResult> {
    return send<JenkinsBuildDetailsResult>({
      type: 'JENKINS_GET_BUILD_DETAILS',
      payload: { buildUrl, envId, consoleTailLines },
    });
  },

  async getTestDetails(buildUrl: string, envId?: string): Promise<JenkinsTestDetailsResult> {
    return send<JenkinsTestDetailsResult>({
      type: 'JENKINS_GET_TEST_DETAILS',
      payload: { buildUrl, envId },
    });
  },

  async downloadArtifact(
    buildUrl: string,
    relativePath: string,
    envId?: string
  ): Promise<JenkinsArtifactDownload> {
    return send<JenkinsArtifactDownload>({
      type: 'JENKINS_DOWNLOAD_ARTIFACT',
      payload: { buildUrl, relativePath, envId },
    });
  },

  async getPipelineStages(buildUrl: string, envId?: string): Promise<JenkinsPipelineResult> {
    return send<JenkinsPipelineResult>({
      type: 'JENKINS_GET_PIPELINE_STAGES',
      payload: { buildUrl, envId },
    });
  },

  async getPipelineStageNodes(
    buildUrl: string,
    stageId: string,
    envId?: string
  ): Promise<JenkinsPipelineNode[]> {
    return send<JenkinsPipelineNode[]>({
      type: 'JENKINS_GET_PIPELINE_STAGE_NODES',
      payload: { buildUrl, stageId, envId },
    });
  },

  async getPipelineNodeLog(
    buildUrl: string,
    nodeId: string,
    envId?: string
  ): Promise<JenkinsPipelineNodeLog> {
    return send<JenkinsPipelineNodeLog>({
      type: 'JENKINS_GET_PIPELINE_NODE_LOG',
      payload: { buildUrl, nodeId, envId },
    });
  },

  async submitPipelineInput(
    buildUrl: string,
    inputId: string,
    decision: 'proceed' | 'abort',
    envId?: string
  ): Promise<boolean> {
    return send<boolean>({
      type: 'JENKINS_SUBMIT_PIPELINE_INPUT',
      payload: { buildUrl, inputId, decision, envId },
    });
  },

  async cancelBuild(jobUrl: string, buildNumber: number, envId?: string): Promise<boolean> {
    return send<boolean>({
      type: 'JENKINS_CANCEL_BUILD',
      payload: { jobUrl, buildNumber, envId },
    });
  },
};
