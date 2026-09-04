import { http } from '@/lib/http';
import {
  isSensitiveFieldName,
  redactSensitiveFields,
  redactSensitiveText,
} from '@/utils/sensitive';
import { createJenkinsClient } from './client';
import { assertJenkinsUrlAllowed } from './urlSafety';

interface JenkinsBuildAction {
  parameters?: Array<{ name?: string; value?: unknown }>;
  causes?: Array<{ shortDescription?: string; userId?: string; userName?: string }>;
}

interface JenkinsBuildDetails {
  number?: number;
  url?: string;
  result?: string;
  building?: boolean;
  displayName?: string;
  fullDisplayName?: string;
  description?: string;
  timestamp?: number;
  duration?: number;
  estimatedDuration?: number;
  queueId?: number;
  builtOn?: string;
  actions?: JenkinsBuildAction[];
  changeSet?: {
    items?: Array<{ msg?: string; commitId?: string; author?: { fullName?: string } }>;
  };
  artifacts?: Array<{ fileName?: string; relativePath?: string }>;
}

interface JenkinsTestReport {
  failCount?: number;
  skipCount?: number;
  passCount?: number;
  totalCount?: number;
  duration?: number;
}

const BUILD_TREE =
  'number,url,result,building,displayName,fullDisplayName,description,timestamp,duration,estimatedDuration,queueId,builtOn,actions[parameters[name,value],causes[shortDescription,userId,userName]],changeSet[items[msg,commitId,author[fullName]]],artifacts[fileName,relativePath]';
const TEST_REPORT_TREE = 'failCount,skipCount,passCount,totalCount,duration';

export async function getBuildDetails(
  buildUrl: string,
  user: string,
  token: string,
  jenkinsHost: string,
  consoleTailLines = 100
) {
  const client = createJenkinsClient({ baseUrl: jenkinsHost, user, token });
  const rootUrl = assertJenkinsUrlAllowed(buildUrl, client.rootUrl).replace(/\/$/, '');
  const details = await client.fetchApi<JenkinsBuildDetails>(rootUrl, BUILD_TREE);
  if (!details) throw new Error('无法读取 Jenkins 构建详情');

  const [testReport, consoleLog] = await Promise.all([
    client.fetchApi<JenkinsTestReport>(`${rootUrl}/testReport`, TEST_REPORT_TREE),
    consoleTailLines > 0 ? getConsoleTail(rootUrl, client.headers, consoleTailLines) : undefined,
  ]);
  const parameters = (details.actions || []).flatMap((action) => action.parameters || []);
  const causes = (details.actions || []).flatMap((action) => action.causes || []);

  return {
    success: true,
    build: {
      number: details.number,
      url: details.url || rootUrl,
      result: details.result,
      building: details.building === true,
      display_name: details.fullDisplayName || details.displayName,
      description: details.description
        ? redactSensitiveText(details.description).slice(0, 2_000)
        : undefined,
      timestamp: details.timestamp,
      duration_ms: details.duration,
      estimated_duration_ms: details.estimatedDuration,
      queue_id: details.queueId,
      built_on: details.builtOn,
      causes: causes.slice(0, 20).map((cause) => ({
        description: cause.shortDescription
          ? redactSensitiveText(cause.shortDescription)
          : undefined,
        user_id: cause.userId,
        user_name: cause.userName,
      })),
      parameters: parameters.slice(0, 100).map((parameter) => ({
        name: parameter.name,
        value:
          parameter.name && isSensitiveFieldName(parameter.name)
            ? '[redacted]'
            : redactSensitiveFields(parameter.value),
      })),
      changes: (details.changeSet?.items || []).slice(0, 50).map((change) => ({
        commit_id: change.commitId,
        author: change.author?.fullName,
        message: change.msg ? redactSensitiveText(change.msg).slice(0, 1_000) : undefined,
      })),
      artifacts: (details.artifacts || []).slice(0, 100),
    },
    test_report: testReport || undefined,
    console_tail: consoleLog,
  };
}

async function getConsoleTail(
  buildUrl: string,
  headers: Headers,
  lineLimit: number
): Promise<{ lines: string; truncated: boolean } | undefined> {
  try {
    const response = await http(`${buildUrl}/consoleText`, {
      headers,
      redirect: 'manual',
      timeout: 30_000,
    });
    if (!response.ok) return undefined;
    const text = await response.text();
    const lines = text.split(/\r?\n/);
    return {
      lines: redactSensitiveText(lines.slice(-lineLimit).join('\n')).slice(-20_000),
      truncated: lines.length > lineLimit,
    };
  } catch {
    return undefined;
  }
}
