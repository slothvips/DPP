export interface JenkinsMessageBase {
  type: string;
  payload?: unknown;
}

export interface FetchJobsMessage extends JenkinsMessageBase {
  type: 'JENKINS_FETCH_JOBS';
  payload?: undefined;
}

export interface FetchMyBuildsMessage extends JenkinsMessageBase {
  type: 'JENKINS_FETCH_MY_BUILDS';
  payload?: {
    maxBuildsPerJob?: number;
  };
}

export interface FetchActiveBuildsMessage extends JenkinsMessageBase {
  type: 'JENKINS_FETCH_ACTIVE_BUILDS';
  payload?: undefined;
}

export interface FetchQueueMessage extends JenkinsMessageBase {
  type: 'JENKINS_FETCH_QUEUE';
  payload?: {
    envId?: string;
  };
}

export interface FetchJobBuildsMessage extends JenkinsMessageBase {
  type: 'JENKINS_FETCH_JOB_BUILDS';
  payload: {
    jobUrl: string;
    limit?: number;
    envId?: string;
  };
}

export interface GetBuildStatusMessage extends JenkinsMessageBase {
  type: 'JENKINS_GET_BUILD_STATUS';
  payload: {
    buildUrl: string;
    envId?: string;
  };
}

export interface TriggerBuildMessage extends JenkinsMessageBase {
  type: 'JENKINS_TRIGGER_BUILD';
  payload: {
    jobUrl: string;
    parameters?: Record<string, string | boolean | number>;
    envId?: string;
    operationId?: string;
  };
}

export interface JenkinsTriggerResult {
  accepted: boolean;
  status: 'accepted' | 'unknown';
  queueId?: string;
  queueUrl?: string;
  operationId?: string;
}

export interface GetJobDetailsMessage extends JenkinsMessageBase {
  type: 'JENKINS_GET_JOB_DETAILS';
  payload: {
    jobUrl: string;
    envId?: string;
  };
}

export interface GetBuildLogMessage extends JenkinsMessageBase {
  type: 'JENKINS_GET_BUILD_LOG';
  payload: {
    buildUrl: string;
    start: number;
    envId?: string;
  };
}

export interface GetBuildDetailsMessage extends JenkinsMessageBase {
  type: 'JENKINS_GET_BUILD_DETAILS';
  payload: {
    buildUrl: string;
    envId?: string;
    consoleTailLines?: number;
  };
}

export interface JenkinsBuildDetailsResult {
  success: true;
  build: {
    number?: number;
    url: string;
    result?: string;
    building: boolean;
    display_name?: string;
    description?: string;
    timestamp?: number;
    duration_ms?: number;
    estimated_duration_ms?: number;
    queue_id?: number;
    built_on?: string;
    causes: Array<{
      description?: string;
      user_id?: string;
      user_name?: string;
    }>;
    parameters: Array<{ name?: string; value: unknown }>;
    changes: Array<{ commit_id?: string; author?: string; message?: string }>;
    artifacts: Array<{ fileName?: string; relativePath?: string }>;
  };
  test_report?: {
    failCount?: number;
    skipCount?: number;
    passCount?: number;
    totalCount?: number;
    duration?: number;
  };
  test_report_status: 'available' | 'pending' | 'missing' | 'permission' | 'error';
  test_report_error?: string;
  console_tail?: { lines: string; truncated: boolean };
}

export interface GetTestDetailsMessage extends JenkinsMessageBase {
  type: 'JENKINS_GET_TEST_DETAILS';
  payload: {
    buildUrl: string;
    envId?: string;
  };
}

export interface JenkinsTestDetailsResult {
  cases: Array<{
    suite?: string;
    className?: string;
    name?: string;
    status?: string;
    age?: number;
    duration?: number;
    errorDetails?: string;
    errorStackTrace?: string;
  }>;
  totalFailures: number;
  truncated: boolean;
}

export interface DownloadArtifactMessage extends JenkinsMessageBase {
  type: 'JENKINS_DOWNLOAD_ARTIFACT';
  payload: {
    buildUrl: string;
    relativePath: string;
    envId?: string;
  };
}

export interface JenkinsArtifactDownload {
  base64: string;
  contentType: string;
  size: number;
}

export type JenkinsPipelineCapability = 'available' | 'missing' | 'permission' | 'error';

export interface JenkinsPipelineStage {
  id?: string;
  name?: string;
  status?: string;
  startTimeMillis?: number;
  durationMillis?: number;
  pauseDurationMillis?: number;
}

export interface GetPipelineStagesMessage extends JenkinsMessageBase {
  type: 'JENKINS_GET_PIPELINE_STAGES';
  payload: {
    buildUrl: string;
    envId?: string;
  };
}

export interface JenkinsPipelineResult {
  capability: JenkinsPipelineCapability;
  reason?: string;
  status?: string;
  stages: JenkinsPipelineStage[];
  pendingInputs: JenkinsPipelineInput[];
  pendingInputError?: string;
}

export interface JenkinsPipelineInput {
  id: string;
  message: string;
  canProceed: boolean;
}

export interface GetPipelineStageNodesMessage extends JenkinsMessageBase {
  type: 'JENKINS_GET_PIPELINE_STAGE_NODES';
  payload: {
    buildUrl: string;
    stageId: string;
    envId?: string;
  };
}

export interface JenkinsPipelineNode {
  id?: string;
  name?: string;
  status?: string;
  durationMillis?: number;
  error?: string;
  hasLog: boolean;
}

export interface GetPipelineNodeLogMessage extends JenkinsMessageBase {
  type: 'JENKINS_GET_PIPELINE_NODE_LOG';
  payload: {
    buildUrl: string;
    nodeId: string;
    envId?: string;
  };
}

export interface JenkinsPipelineNodeLog {
  nodeId: string;
  status?: string;
  text: string;
  truncated: boolean;
}

export interface SubmitPipelineInputMessage extends JenkinsMessageBase {
  type: 'JENKINS_SUBMIT_PIPELINE_INPUT';
  payload: {
    buildUrl: string;
    inputId: string;
    decision: 'proceed' | 'abort';
    envId?: string;
  };
}

export interface JenkinsBuildLogChunk {
  text: string;
  nextStart: number;
  moreData: boolean;
}

export interface JenkinsJobBuildsResult {
  job: { name: string; url: string; lastStatus?: string };
  builds: Array<{
    id: string;
    number: number;
    result?: string;
    timestamp: number;
    duration: number;
    building: boolean;
    userName?: string;
  }>;
  total: number;
}

export interface CancelBuildMessage extends JenkinsMessageBase {
  type: 'JENKINS_CANCEL_BUILD';
  payload: {
    jobUrl: string;
    buildNumber: number;
    envId?: string;
  };
}

export interface GetQueueItemMessage extends JenkinsMessageBase {
  type: 'JENKINS_GET_QUEUE_ITEM';
  payload: {
    queueId: string;
    envId?: string;
  };
}

export interface CancelQueueItemMessage extends JenkinsMessageBase {
  type: 'JENKINS_CANCEL_QUEUE_ITEM';
  payload: {
    queueId: string;
    envId?: string;
  };
}

export interface StopBuildMessage extends JenkinsMessageBase {
  type: 'JENKINS_STOP_BUILD';
  payload: {
    buildUrl: string;
    envId?: string;
  };
}

export type JenkinsMessage =
  | FetchJobsMessage
  | FetchMyBuildsMessage
  | FetchActiveBuildsMessage
  | FetchQueueMessage
  | FetchJobBuildsMessage
  | GetBuildStatusMessage
  | TriggerBuildMessage
  | GetQueueItemMessage
  | CancelQueueItemMessage
  | StopBuildMessage
  | GetJobDetailsMessage
  | GetBuildDetailsMessage
  | GetTestDetailsMessage
  | DownloadArtifactMessage
  | GetPipelineStagesMessage
  | GetPipelineStageNodesMessage
  | GetPipelineNodeLogMessage
  | SubmitPipelineInputMessage
  | GetBuildLogMessage
  | CancelBuildMessage;

export interface JenkinsResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
