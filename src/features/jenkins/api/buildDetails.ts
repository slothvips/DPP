import type {
  JenkinsBuildDetailsResult,
  JenkinsBuildLogChunk,
  JenkinsTestDetailsResult,
} from '@/features/jenkins/messages';
import { recordJenkinsLogChunk } from '@/features/jenkins/metrics';
import { http } from '@/lib/http';
import {
  isSensitiveFieldName,
  redactSensitiveFields,
  redactSensitiveText,
} from '@/utils/sensitive';
import { createJenkinsClient } from './client';
import { JenkinsApiError, createJenkinsHttpError, createJenkinsNetworkError } from './contracts';
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

interface JenkinsTestCase {
  className?: string;
  name?: string;
  status?: string;
  age?: number;
  duration?: number;
  errorDetails?: string;
  errorStackTrace?: string;
}

interface JenkinsTestDetailsReport {
  failCount?: number;
  suites?: Array<{ name?: string; cases?: JenkinsTestCase[] }>;
}

const BUILD_TREE =
  'number,url,result,building,displayName,fullDisplayName,description,timestamp,duration,estimatedDuration,queueId,builtOn,actions[parameters[name,value],causes[shortDescription,userId,userName]],changeSet[items[msg,commitId,author[fullName]]],artifacts[fileName,relativePath]';
const TEST_REPORT_TREE = 'failCount,skipCount,passCount,totalCount,duration';
const TEST_DETAILS_TREE =
  'failCount,suites[name,cases[className,name,status,age,duration,errorDetails,errorStackTrace]]';
const MAX_TEST_DETAILS_BYTES = 2 * 1024 * 1024;
const MAX_FAILED_TESTS = 100;

export async function getBuildDetails(
  buildUrl: string,
  user: string,
  token: string,
  jenkinsHost: string,
  consoleTailLines = 100
): Promise<JenkinsBuildDetailsResult> {
  const client = createJenkinsClient({ baseUrl: jenkinsHost, user, token });
  const rootUrl = assertJenkinsUrlAllowed(buildUrl, client.rootUrl).replace(/\/$/, '');
  const details = await client.fetchApi<JenkinsBuildDetails>(rootUrl, BUILD_TREE);
  if (!details) throw new Error('无法读取 Jenkins 构建详情');

  const [testReportResult, consoleLog] = await Promise.all([
    client
      .fetchApi<JenkinsTestReport>(`${rootUrl}/testReport`, TEST_REPORT_TREE)
      .then((report) =>
        report
          ? { status: 'available' as const, report }
          : { status: details.building ? ('pending' as const) : ('missing' as const) }
      )
      .catch((error: unknown) => {
        if (error instanceof JenkinsApiError && error.code === 'not_found') {
          return { status: details.building ? ('pending' as const) : ('missing' as const) };
        }
        if (error instanceof JenkinsApiError && error.code === 'permission') {
          return { status: 'permission' as const };
        }
        return {
          status: 'error' as const,
          error: redactSensitiveText(error instanceof Error ? error.message : String(error)).slice(
            0,
            300
          ),
        };
      }),
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
    test_report: testReportResult.status === 'available' ? testReportResult.report : undefined,
    test_report_status: testReportResult.status,
    test_report_error: testReportResult.status === 'error' ? testReportResult.error : undefined,
    console_tail: consoleLog,
  };
}

export async function getTestDetails(
  buildUrl: string,
  user: string,
  token: string,
  jenkinsHost: string
): Promise<JenkinsTestDetailsResult> {
  const client = createJenkinsClient({ baseUrl: jenkinsHost, user, token });
  const rootUrl = assertJenkinsUrlAllowed(buildUrl, client.rootUrl).replace(/\/$/, '');
  const report = await client.fetchApi<JenkinsTestDetailsReport>(
    `${rootUrl}/testReport`,
    TEST_DETAILS_TREE,
    MAX_TEST_DETAILS_BYTES
  );
  if (!report) throw new JenkinsApiError('invalid_response', 'Jenkins 测试报告为空');

  const failedCases = (report.suites || []).flatMap((suite) =>
    (suite.cases || [])
      .filter(
        (testCase) =>
          ['FAILED', 'REGRESSION'].includes(testCase.status || '') ||
          Boolean(testCase.errorDetails || testCase.errorStackTrace)
      )
      .map((testCase) => ({
        suite: suite.name,
        className: testCase.className,
        name: testCase.name,
        status: testCase.status,
        age: testCase.age,
        duration: testCase.duration,
        errorDetails: testCase.errorDetails
          ? redactSensitiveText(testCase.errorDetails).slice(0, 2_000)
          : undefined,
        errorStackTrace: testCase.errorStackTrace
          ? redactSensitiveText(testCase.errorStackTrace).slice(0, 20_000)
          : undefined,
      }))
  );

  return {
    cases: failedCases.slice(0, MAX_FAILED_TESTS),
    totalFailures: Math.max(report.failCount || 0, failedCases.length),
    truncated: failedCases.length > MAX_FAILED_TESTS,
  };
}

export async function getBuildLogChunk(
  buildUrl: string,
  user: string,
  token: string,
  jenkinsHost: string,
  start: number
): Promise<JenkinsBuildLogChunk> {
  if (!Number.isSafeInteger(start) || start < 0) {
    throw new Error('Jenkins 日志偏移量无效');
  }

  const client = createJenkinsClient({ baseUrl: jenkinsHost, user, token });
  const rootUrl = assertJenkinsUrlAllowed(buildUrl, client.rootUrl).replace(/\/$/, '');
  const url = new URL(`${rootUrl}/logText/progressiveText`);
  url.searchParams.set('start', String(start));
  let response: Response;
  try {
    response = await http(url.toString(), {
      headers: client.headers,
      credentials: 'include',
      redirect: 'manual',
      timeout: 30_000,
    });
  } catch (error) {
    throw createJenkinsNetworkError(error);
  }
  if (!response.ok) throw createJenkinsHttpError(response, await response.text());
  const contentLength = Number.parseInt(response.headers.get('Content-Length') || '', 10);
  if (Number.isSafeInteger(contentLength) && contentLength > 1_000_000) {
    throw new Error('Jenkins 单次日志响应过大，请使用 Jenkins 页面或下载完整日志');
  }

  const text = await response.text();
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > 1_000_000) {
    throw new Error('Jenkins 单次日志响应过大，请使用 Jenkins 页面或下载完整日志');
  }
  recordJenkinsLogChunk(bytes);
  const headerOffset = Number.parseInt(response.headers.get('X-Text-Size') || '', 10);
  const nextStart =
    Number.isSafeInteger(headerOffset) && headerOffset >= start ? headerOffset : start + bytes;

  if (response.headers.get('X-More-Data')?.toLowerCase() === 'true' && nextStart <= start) {
    throw new Error('Jenkins 日志偏移量没有前进');
  }

  return {
    text,
    nextStart,
    moreData: response.headers.get('X-More-Data')?.toLowerCase() === 'true',
  };
}

async function getConsoleTail(
  buildUrl: string,
  headers: Headers,
  lineLimit: number
): Promise<{ lines: string; truncated: boolean } | undefined> {
  try {
    const text = await fetchConsoleText(buildUrl, headers);
    const lines = text.split(/\r?\n/);
    return {
      lines: redactSensitiveText(lines.slice(-lineLimit).join('\n')).slice(-20_000),
      truncated: lines.length > lineLimit,
    };
  } catch {
    return undefined;
  }
}

async function fetchConsoleText(buildUrl: string, headers: Headers): Promise<string> {
  const response = await http(`${buildUrl}/consoleText`, {
    headers,
    credentials: 'include',
    redirect: 'manual',
    timeout: 30_000,
  });
  if (!response.ok) {
    throw new Error(`无法读取 Jenkins 构建日志 (${response.status})`);
  }
  return response.text();
}
