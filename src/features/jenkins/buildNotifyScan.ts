import { browser } from 'wxt/browser';
import { type JenkinsEnvironment, syncEngine } from '@/db';
import { getBuildLogChunk } from '@/features/jenkins/api/buildDetails';
import { createJenkinsClient } from '@/features/jenkins/api/client';
import { JenkinsApiError } from '@/features/jenkins/api/contracts';
import {
  type NotifyJenkinsBuild,
  type NotifyJenkinsJob,
  notifyClientLabel,
  scanJenkinsBuildNotifications,
} from '@/features/jenkins/buildNotifyCore';
import { JENKINS_BUILD_SCOPE, canonicalHttpUrl } from '@/features/notify/canonical';
import { deliverOnce } from '@/features/notify/deliverOnce';
import { notifyWorkerRequest } from '@/features/notify/workerApi';
import { getNotifyBotToken, getNotifyConfig, listActiveNotifyTargets } from '@/lib/db/notify';
import { getSetting } from '@/lib/db/settings';
import { getAllActiveTags, getAllJobTags } from '@/lib/db/tagsQueries';
import { logger } from '@/utils/logger';
import { redactSensitiveText } from '@/utils/sensitive';

export const JENKINS_BUILD_NOTIFY_ALARM = 'jenkins-build-notify-alarm';

const JOB_TREE = 'jobs[name,url,fullName,_class,lastBuild[number]]';
const BUILD_TREE =
  'number,url,result,timestamp,duration,building,builtOn,description,actions[parameters[name,value],causes[shortDescription,userId,userName]],changeSet[items[msg,commitId,author[fullName]]],artifacts[fileName]';
const MAX_DEPTH = 10;
const MAX_NODES = 5000;

let scanning = false;

interface JobTreeResponse {
  jobs?: Array<{
    name?: string;
    url?: string;
    fullName?: string;
    _class?: string;
    lastBuild?: { number?: number };
  }>;
}

interface BuildResponse {
  url?: string;
  result?: string | null;
  timestamp?: number | null;
  duration?: number | null;
  building?: boolean;
  builtOn?: string;
  description?: string;
  actions?: Array<{
    parameters?: Array<{ name?: string; value?: unknown }>;
    causes?: Array<{ shortDescription?: string; userId?: string; userName?: string }>;
  }>;
  changeSet?: {
    items?: Array<{ msg?: string; commitId?: string; author?: { fullName?: string } }>;
  };
  artifacts?: Array<{ fileName?: string }>;
}

function readTrigger(actions: BuildResponse['actions']): { userName?: string; userId?: string } {
  let userName: string | undefined;
  let userId: string | undefined;
  for (const action of actions ?? []) {
    for (const cause of action.causes ?? []) {
      if (!userName && cause.userName) userName = cause.userName;
      if (!userId && cause.userId) userId = cause.userId;
    }
  }
  return { userName, userId };
}

function joinLimited(lines: string[], limit: number): string {
  return lines.filter(Boolean).slice(0, limit).join('\n');
}

function readCause(actions: BuildResponse['actions']): string {
  const lines: string[] = [];
  for (const action of actions ?? []) {
    for (const cause of action.causes ?? []) {
      const text = cause.shortDescription?.trim();
      if (text) lines.push(text);
    }
  }
  return joinLimited(lines, 3);
}

function readParameters(actions: BuildResponse['actions']): string {
  const lines: string[] = [];
  for (const action of actions ?? []) {
    for (const param of action.parameters ?? []) {
      const name = param.name?.trim();
      if (!name) continue;
      const value = String(param.value ?? '').replace(/\s+/g, ' ');
      lines.push(redactSensitiveText(`${name}=${value}`).slice(0, 160));
    }
  }
  return joinLimited(lines, 8);
}

function readChanges(changeSet: BuildResponse['changeSet']): string {
  const lines = (changeSet?.items ?? []).map((item) => {
    const hash = item.commitId?.slice(0, 7) ?? '';
    const author = item.author?.fullName?.trim() ?? '';
    const message = item.msg?.trim().split('\n')[0]?.slice(0, 80) ?? '';
    return [hash, author, message].filter(Boolean).join(' ');
  });
  return joinLimited(lines, 5);
}

function readArtifacts(artifacts: BuildResponse['artifacts']): string {
  return (artifacts ?? [])
    .map((item) => item.fileName?.trim() ?? '')
    .filter(Boolean)
    .slice(0, 8)
    .join(' ');
}

const LOG_FILE_MAX_BYTES = 49 * 1024 * 1024;

async function buildNotifyTagLabels(): Promise<Map<string, string>> {
  const [jobTags, tags] = await Promise.all([getAllJobTags(), getAllActiveTags()]);
  const names = new Map(tags.map((tag) => [tag.id, tag.name.trim()]));
  const grouped = new Map<string, string[]>();
  for (const link of jobTags) {
    if (link.deletedAt) continue;
    const name = names.get(link.tagId);
    if (!name) continue;
    const key = canonicalHttpUrl(link.jobUrl) ?? link.jobUrl;
    const list = grouped.get(key) ?? [];
    list.push(name.startsWith('#') ? name : `#${name}`);
    grouped.set(key, list);
  }
  return new Map([...grouped].map(([key, list]) => [key, [...new Set(list)].join(' ')]));
}

async function fetchNotifyLogFile(
  env: { host: string; user: string; token: string },
  buildUrl: string
): Promise<string> {
  // ponytail: 分段拉控制台，拼到 Telegram 50MB 为止。再大就截断。
  try {
    const client = createJenkinsClient({ baseUrl: env.host, user: env.user, token: env.token });
    const parts: string[] = [];
    let start = 0;
    let bytes = 0;
    let truncated = false;
    for (;;) {
      const chunk = await getBuildLogChunk(buildUrl, env.user, env.token, client.rootUrl, start);
      const size = new TextEncoder().encode(chunk.text).length;
      if (bytes + size > LOG_FILE_MAX_BYTES) {
        truncated = true;
        break;
      }
      parts.push(chunk.text);
      bytes += size;
      if (!chunk.moreData) break;
      start = chunk.nextStart;
    }
    const text = redactSensitiveText(parts.join('')).trim();
    return truncated ? `${text}\n\n[日志超过 50MB，已截断]` : text;
  } catch (error) {
    logger.warn(
      '[Notify] 读取构建日志失败',
      error instanceof JenkinsApiError ? error.code : 'error'
    );
    return '';
  }
}

async function listNotifyJobs(env: JenkinsEnvironment): Promise<NotifyJenkinsJob[]> {
  const client = createJenkinsClient({ baseUrl: env.host, user: env.user, token: env.token });
  const jobs: NotifyJenkinsJob[] = [];
  const processed = new Set<string>();

  async function traverse(url: string, depth: number): Promise<void> {
    if (depth >= MAX_DEPTH || !client.isAllowedUrl(url)) return;
    const normalized = url.replace(/\/$/, '');
    if (processed.has(normalized) || processed.size >= MAX_NODES) return;
    processed.add(normalized);

    const data = await client.fetchApi<JobTreeResponse>(url, JOB_TREE);
    if (!data?.jobs) return;
    const folders: string[] = [];
    for (const job of data.jobs) {
      if (!job.url || !client.isAllowedUrl(job.url)) continue;
      if (client.isFolder(job._class)) {
        folders.push(job.url);
        continue;
      }
      const number = job.lastBuild?.number;
      if (typeof number !== 'number' || !Number.isInteger(number) || number <= 0) continue;
      jobs.push({
        name: job.name ?? '',
        fullName: job.fullName,
        url: job.url,
        lastBuildNumber: number,
      });
    }
    for (const folderUrl of folders) await traverse(folderUrl, depth + 1);
  }

  await traverse(client.rootUrl, 0);
  return jobs;
}

async function fetchNotifyBuild(
  env: JenkinsEnvironment,
  jobUrl: string,
  number: number
): Promise<
  | { kind: 'build'; build: NotifyJenkinsBuild }
  | { kind: 'not_found' }
  | { kind: 'env_down' }
  | { kind: 'stop' }
> {
  const client = createJenkinsClient({ baseUrl: env.host, user: env.user, token: env.token });
  const buildUrl = `${jobUrl.replace(/\/$/, '')}/${number}`;
  try {
    const data = await client.fetchApi<BuildResponse>(buildUrl, BUILD_TREE);
    if (!data) return { kind: 'stop' };
    const trigger = readTrigger(data.actions);
    return {
      kind: 'build',
      build: {
        url: data.url || buildUrl,
        result: typeof data.result === 'string' ? data.result : null,
        timestamp: typeof data.timestamp === 'number' ? data.timestamp : null,
        building: data.building === true,
        userName: trigger.userName,
        userId: trigger.userId,
        durationMs: typeof data.duration === 'number' ? data.duration : null,
        builtOn: data.builtOn?.trim() ?? '',
        cause: readCause(data.actions),
        parameters: readParameters(data.actions),
        changes: readChanges(data.changeSet),
        artifacts: readArtifacts(data.artifacts),
        description: data.description
          ? redactSensitiveText(data.description).replace(/\s+/g, ' ').trim().slice(0, 200)
          : '',
      },
    };
  } catch (error) {
    if (error instanceof JenkinsApiError && error.status === 404) return { kind: 'not_found' };
    if (
      error instanceof JenkinsApiError &&
      (error.status === 401 || error.code === 'offline' || error.code === 'timeout')
    ) {
      return { kind: 'env_down' };
    }
    logger.warn('[Notify] 读取构建失败', number);
    return { kind: 'stop' };
  }
}

async function readKv(path: string, method: 'GET' | 'PUT', json?: unknown) {
  const response = await notifyWorkerRequest(path, { method, json });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const record =
    typeof body === 'object' && body !== null
      ? (body as { value?: unknown; updated?: unknown })
      : null;
  return {
    status: response.status,
    value: typeof record?.value === 'string' ? record.value : null,
    updated: record?.updated === true,
  };
}

/** 所有目标里最早的起始时间。读不到就返回 null，扫描保持逐个处理。 */
async function loadNotifyFloor(): Promise<number | null> {
  const targets = await listActiveNotifyTargets();
  if (targets.length === 0) return null;
  let floor = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    const response = await notifyWorkerRequest('/api/notify/since', {
      json: { scope: JENKINS_BUILD_SCOPE, targetId: target.id, create: false },
    });
    if (!response.ok) return null;
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      return null;
    }
    const sinceMs =
      typeof body === 'object' && body !== null && 'sinceMs' in body
        ? (body as { sinceMs: unknown }).sinceMs
        : null;
    if (typeof sinceMs !== 'number' || !Number.isFinite(sinceMs)) return null;
    floor = Math.min(floor, sinceMs);
  }
  return floor;
}

export async function ensureJenkinsBuildNotifyAlarm(): Promise<void> {
  if (!browser.alarms?.get || !browser.alarms?.create) return;
  try {
    const existing = await browser.alarms.get(JENKINS_BUILD_NOTIFY_ALARM);
    if (existing) return;
    await browser.alarms.create(JENKINS_BUILD_NOTIFY_ALARM, { periodInMinutes: 1 });
  } catch (error) {
    logger.error('[Notify] 创建构建通知闹钟失败', error);
  }
}

export async function runJenkinsBuildNotifyScan(): Promise<void> {
  if (scanning) return;
  scanning = true;
  try {
    let tagLabels = new Map<string, string>();
    try {
      tagLabels = await buildNotifyTagLabels();
    } catch (error) {
      logger.warn('[Notify] 读取任务标签失败', error);
    }
    await scanJenkinsBuildNotifications({
      loadToken: getNotifyBotToken,
      async hasTargets() {
        return (await listActiveNotifyTargets()).length > 0;
      },
      async loadEnvironments() {
        return (await getSetting('jenkins_environments')) ?? [];
      },
      async listJobs(env) {
        try {
          return { ok: true, jobs: await listNotifyJobs(env) };
        } catch (error) {
          logger.warn(
            '[Notify] 跳过 Jenkins 环境',
            env.name,
            error instanceof JenkinsApiError ? error.code : 'error'
          );
          return { ok: false };
        }
      },
      fetchBuild: fetchNotifyBuild,
      getKv(key) {
        return readKv(`/api/kv?key=${encodeURIComponent(key)}`, 'GET');
      },
      putKv(key, value) {
        return readKv('/api/kv', 'PUT', { key, value, type: 'number', order: 'increase' });
      },
      async loadTemplate() {
        return (await getNotifyConfig())?.jenkinsBuildTemplate ?? '';
      },
      async loadTags(jobUrl) {
        return tagLabels.get(canonicalHttpUrl(jobUrl) ?? jobUrl) ?? '无';
      },
      loadLog: fetchNotifyLogFile,
      loadFloor: loadNotifyFloor,
      async loadClient() {
        try {
          return notifyClientLabel((await syncEngine.getClientId()) ?? '', navigator.userAgent);
        } catch (error) {
          logger.warn('[Notify] 读取客户端标识失败', error);
          return '';
        }
      },
      deliverOnce,
    });
  } catch (error) {
    logger.error('[Notify] 构建通知扫描失败', error);
  } finally {
    scanning = false;
  }
}
