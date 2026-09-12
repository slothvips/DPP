import type {
  JenkinsPipelineInput,
  JenkinsPipelineNode,
  JenkinsPipelineNodeLog,
  JenkinsPipelineResult,
  JenkinsPipelineStage,
} from '@/features/jenkins/messages';
import { http } from '@/lib/http';
import { redactSensitiveText } from '@/utils/sensitive';
import { getCrumb } from './build';
import { createJenkinsClient } from './client';
import { JenkinsApiError, createJenkinsHttpError, createJenkinsNetworkError } from './contracts';
import { assertJenkinsRedirectAllowed, assertJenkinsUrlAllowed } from './urlSafety';

interface JenkinsWorkflowStage {
  id?: string;
  name?: string;
  status?: string;
  startTimeMillis?: number;
  durationMillis?: number;
  pauseDurationMillis?: number;
}

interface JenkinsWorkflowNode extends JenkinsWorkflowStage {
  _links?: { log?: { href?: string } };
  error?: { message?: string; type?: string };
}

interface JenkinsWorkflowStageDescription {
  stageFlowNodes?: JenkinsWorkflowNode[];
}

interface JenkinsWorkflowNodeLog {
  nodeId?: string;
  nodeStatus?: string;
  length?: number;
  hasMore?: boolean;
  text?: string;
  consoleUrl?: string;
}

interface JenkinsWorkflowDescription {
  status?: string;
  stages?: JenkinsWorkflowStage[];
}

interface JenkinsWorkflowInput {
  id?: string;
  message?: string;
  proceedUrl?: string;
}

const MAX_PIPELINE_RESPONSE_BYTES = 1_000_000;
const PIPELINE_INPUT_ID_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;

function getPipelineBuildUrl(buildUrl: string, rootUrl: string): string {
  const normalized = assertJenkinsUrlAllowed(buildUrl, rootUrl).replace(/\/$/, '');
  const build = new URL(normalized);
  const buildNumber = build.pathname.split('/').filter(Boolean).at(-1);
  if (build.search) throw new Error('Pipeline 资源必须属于有效构建');
  if (!buildNumber || !/^\d+$/.test(buildNumber)) {
    throw new Error('Pipeline 资源必须属于有效构建');
  }
  return normalized;
}

function getPipelineNodeUrl(
  buildUrl: string,
  nodeId: string,
  rootUrl: string,
  action: 'describe' | 'log'
) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(nodeId)) {
    throw new Error('Pipeline 节点 ID 无效');
  }
  return `${getPipelineBuildUrl(buildUrl, rootUrl)}/execution/node/${encodeURIComponent(nodeId)}/wfapi/${action}`;
}

function getPipelineInputUrl(
  buildUrl: string,
  inputId: string,
  rootUrl: string,
  decision: 'proceed' | 'abort'
): string {
  if (!PIPELINE_INPUT_ID_PATTERN.test(inputId)) throw new Error('Pipeline 审批 ID 无效');
  if (decision !== 'proceed' && decision !== 'abort') throw new Error('Pipeline 审批操作无效');
  const action = decision === 'proceed' ? 'proceedEmpty' : 'abort';
  return `${getPipelineBuildUrl(buildUrl, rootUrl)}/input/${encodeURIComponent(inputId)}/${action}`;
}

function supportsEmptyProceed(
  proceedUrl: string | undefined,
  buildUrl: string,
  inputId: string,
  rootUrl: string
): boolean {
  if (!proceedUrl) return false;
  try {
    const received = assertJenkinsUrlAllowed(new URL(proceedUrl, rootUrl).href, rootUrl);
    return received === getPipelineInputUrl(buildUrl, inputId, rootUrl, 'proceed');
  } catch {
    return false;
  }
}

async function getPendingInputs(
  buildUrl: string,
  rootUrl: string,
  fetchJson: <T>(url: string, maxResponseBytes?: number) => Promise<T | null>
): Promise<JenkinsPipelineInput[]> {
  const inputs = await fetchJson<JenkinsWorkflowInput[]>(
    `${buildUrl}/wfapi/pendingInputActions`,
    MAX_PIPELINE_RESPONSE_BYTES
  );
  if (!Array.isArray(inputs))
    throw new JenkinsApiError('invalid_response', 'Pipeline 审批返回无效响应');

  return inputs
    .filter((input): input is JenkinsWorkflowInput & { id: string } =>
      PIPELINE_INPUT_ID_PATTERN.test(input.id || '')
    )
    .slice(0, 20)
    .map((input) => ({
      id: input.id,
      message: redactSensitiveText(input.message || '等待人工确认').slice(0, 1_000),
      canProceed: supportsEmptyProceed(input.proceedUrl, buildUrl, input.id, rootUrl),
    }));
}

export async function getPipelineStages(
  buildUrl: string,
  user: string,
  token: string,
  jenkinsHost: string
): Promise<JenkinsPipelineResult> {
  const client = createJenkinsClient({ baseUrl: jenkinsHost, user, token });
  const rootUrl = getPipelineBuildUrl(buildUrl, client.rootUrl);

  try {
    const description = await client.fetchJson<JenkinsWorkflowDescription>(
      `${rootUrl}/wfapi/describe`,
      MAX_PIPELINE_RESPONSE_BYTES
    );
    if (!description) {
      return {
        capability: 'error',
        reason: 'Pipeline API 返回空响应',
        stages: [],
        pendingInputs: [],
      };
    }
    const stages: JenkinsPipelineStage[] = (description.stages || [])
      .slice(0, 100)
      .map((stage) => ({
        id: stage.id,
        name: stage.name ? redactSensitiveText(stage.name).slice(0, 300) : undefined,
        status: stage.status,
        startTimeMillis: stage.startTimeMillis,
        durationMillis: stage.durationMillis,
        pauseDurationMillis: stage.pauseDurationMillis,
      }));
    let pendingInputs: JenkinsPipelineInput[] = [];
    let pendingInputError: string | undefined;
    if (description.status === 'PAUSED_PENDING_INPUT') {
      try {
        pendingInputs = await getPendingInputs(rootUrl, client.rootUrl, client.fetchJson);
      } catch (error) {
        pendingInputError =
          error instanceof JenkinsApiError && error.code === 'permission'
            ? '当前账号无权读取 Pipeline 审批'
            : 'Pipeline 审批读取失败';
      }
    }
    return {
      capability: 'available',
      status: description.status,
      stages,
      pendingInputs,
      pendingInputError,
    };
  } catch (error) {
    if (!(error instanceof JenkinsApiError)) throw error;
    if (error.code === 'not_found') {
      return {
        capability: 'missing',
        reason: '此构建不是 Pipeline，或 Jenkins 未安装 Pipeline REST API 插件',
        stages: [],
        pendingInputs: [],
      };
    }
    if (error.code === 'permission') {
      return {
        capability: 'permission',
        reason: '当前账号无权读取 Pipeline 阶段',
        stages: [],
        pendingInputs: [],
      };
    }
    return {
      capability: 'error',
      reason: redactSensitiveText(error.message).slice(0, 300),
      stages: [],
      pendingInputs: [],
    };
  }
}

export async function submitPipelineInput(
  buildUrl: string,
  inputId: string,
  decision: 'proceed' | 'abort',
  user: string,
  token: string,
  jenkinsHost: string
): Promise<boolean> {
  const client = createJenkinsClient({ baseUrl: jenkinsHost, user, token });
  const apiUrl = getPipelineInputUrl(buildUrl, inputId, client.rootUrl, decision);
  const headers = new Headers(client.headers);
  const crumb = await getCrumb(jenkinsHost, user, token);
  if (crumb) headers.set(crumb.header, crumb.value);

  try {
    const response = await http(apiUrl, {
      method: 'POST',
      headers,
      credentials: 'include',
      redirect: 'manual',
      timeout: 30_000,
    });
    assertJenkinsRedirectAllowed(response, apiUrl, client.rootUrl);
    if (response.status >= 200 && response.status < 400) return true;
    throw createJenkinsHttpError(response, await response.text());
  } catch (error) {
    if (error instanceof JenkinsApiError) throw error;
    throw createJenkinsNetworkError(error);
  }
}

export async function getPipelineStageNodes(
  buildUrl: string,
  stageId: string,
  user: string,
  token: string,
  jenkinsHost: string
): Promise<JenkinsPipelineNode[]> {
  const client = createJenkinsClient({ baseUrl: jenkinsHost, user, token });
  const description = await client.fetchJson<JenkinsWorkflowStageDescription>(
    getPipelineNodeUrl(buildUrl, stageId, client.rootUrl, 'describe'),
    MAX_PIPELINE_RESPONSE_BYTES
  );
  if (!description) throw new JenkinsApiError('invalid_response', 'Pipeline 阶段返回空响应');

  return (description.stageFlowNodes || []).slice(0, 100).map((node) => ({
    id: node.id,
    name: node.name ? redactSensitiveText(node.name).slice(0, 300) : undefined,
    status: node.status,
    durationMillis: node.durationMillis,
    error: node.error?.message
      ? redactSensitiveText(node.error.message).slice(0, 1_000)
      : undefined,
    hasLog: Boolean(node._links?.log?.href),
  }));
}

export async function getPipelineNodeLog(
  buildUrl: string,
  nodeId: string,
  user: string,
  token: string,
  jenkinsHost: string
): Promise<JenkinsPipelineNodeLog> {
  const client = createJenkinsClient({ baseUrl: jenkinsHost, user, token });
  const result = await client.fetchJson<JenkinsWorkflowNodeLog>(
    getPipelineNodeUrl(buildUrl, nodeId, client.rootUrl, 'log'),
    MAX_PIPELINE_RESPONSE_BYTES
  );
  if (!result) throw new JenkinsApiError('invalid_response', 'Pipeline 节点日志返回空响应');

  return {
    nodeId: result.nodeId || nodeId,
    status: result.nodeStatus,
    text: result.text || '',
    truncated: result.hasMore === true,
  };
}
