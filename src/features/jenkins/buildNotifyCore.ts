import { JENKINS_BUILD_SCOPE, canonicalHttpUrl, sha256Hex } from '../notify/canonical.ts';
import { renderNotifyTemplate } from '../notify/template.ts';
import { jenkinsBuildTemplateSource } from './buildNotifyTemplate.ts';

const TERMINAL_RESULTS = new Set(['SUCCESS', 'FAILURE', 'ABORTED', 'UNSTABLE', 'NOT_BUILT']);
const DECIMAL_INTEGER = /^-?(?:0|[1-9]\d*)$/;
// ponytail: 计划里还没确认的单轮上限。要改只改这个数。
const BUILD_BUDGET = 20;

export interface NotifyJenkinsEnv {
  id: string;
  name: string;
  host: string;
  user: string;
  token: string;
  order: number;
}

export interface NotifyJenkinsJob {
  name: string;
  fullName?: string;
  url: string;
  lastBuildNumber: number;
}

export interface NotifyJenkinsBuild {
  url: string;
  result: string | null;
  timestamp: number | null;
  building: boolean;
  userName?: string;
  userId?: string;
  durationMs?: number | null;
  builtOn?: string;
  cause?: string;
  parameters?: string;
  changes?: string;
  artifacts?: string;
  description?: string;
}

export type FetchNotifyBuild =
  | { kind: 'build'; build: NotifyJenkinsBuild }
  | { kind: 'not_found' }
  | { kind: 'env_down' }
  | { kind: 'stop' };

export interface KvResponse {
  status: number;
  value: string | null;
  updated?: boolean;
}

export interface BuildNotifyPorts {
  loadToken(): Promise<string>;
  hasTargets(): Promise<boolean>;
  loadEnvironments(): Promise<NotifyJenkinsEnv[]>;
  listJobs(env: NotifyJenkinsEnv): Promise<{ ok: true; jobs: NotifyJenkinsJob[] } | { ok: false }>;
  fetchBuild(env: NotifyJenkinsEnv, jobUrl: string, number: number): Promise<FetchNotifyBuild>;
  getKv(key: string): Promise<KvResponse>;
  putKv(key: string, value: string): Promise<KvResponse>;
  loadTemplate?(): Promise<string>;
  loadTags?(jobUrl: string): Promise<string>;
  loadLog?(env: NotifyJenkinsEnv, buildUrl: string): Promise<string>;
  /** 早于这个时间的构建只推进游标，不发消息。缺省则逐个处理。 */
  loadFloor?(): Promise<number | null>;
  /** 已拼好的发送端文字。缺省时消息里显示无。 */
  loadClient?(): Promise<string>;
  /** 订了这个 Job 的接收对象。缺省则发给全部对象。空数组不发送，游标照样前进。 */
  subscribers?(jobUrl: string): Promise<string[]>;
  deliverOnce(input: {
    scope: string;
    dedupKey: string;
    text: string;
    occurredAt: number;
    file?: { filename: string; body: string };
    targetIds?: string[];
  }): Promise<{ complete: boolean; halt?: boolean }>;
}

export function jenkinsBuildDedupKey(buildUrl: string): string | null {
  return canonicalHttpUrl(buildUrl);
}

export async function jenkinsJobCursorKey(jobUrl: string): Promise<string | null> {
  const canonical = canonicalHttpUrl(jobUrl);
  if (!canonical) return null;
  return sha256Hex(`${JENKINS_BUILD_SCOPE}\n${canonical}`);
}

const FAILURE_TAIL = 16_000;
const ESC = '\u001b';

/** Jenkins ConsoleNote：`ESC[8mha:<base64>ESC[0m`。去掉颜色码后会粘在日志行前面。 */
function stripConsoleNotes(log: string): string {
  return log
    .replace(new RegExp(`${ESC}\\[8mha:[\\s\\S]*?${ESC}\\[0m`, 'g'), '')
    .replace(/ha:(?:[A-Za-z0-9+/]{4})+={1,2}/g, '');
}

function isFailureNoise(text: string): boolean {
  const plain = text.replace(/^(?:\[ERROR\]|npm ERR!)\s*/, '');
  return (
    !plain ||
    /ha:[A-Za-z0-9+/]{24,}/.test(plain) ||
    plain.startsWith('Finished:') ||
    plain.startsWith('[Pipeline]') ||
    plain.startsWith('[INFO]') ||
    plain.startsWith('[DEBUG]') ||
    plain.startsWith('[WARNING]') ||
    plain.startsWith('To see the full stack') ||
    plain.startsWith('Re-run Maven') ||
    plain.startsWith('For more information') ||
    plain.startsWith('[Help ') ||
    plain.startsWith('Get more help') ||
    plain.startsWith('Run with --') ||
    plain.startsWith('A complete log of this run') ||
    plain === '* Try:' ||
    plain === 'Also:' ||
    plain.startsWith('BUILD FAILED in ')
  );
}

/** 只有退出码、没有具体报错。有更具体的行时丢掉这些。 */
function isGenericFailureLine(text: string): boolean {
  return (
    /^(?:ERROR:\s*)?script returned exit code \d+$/i.test(text) ||
    /^hudson\.AbortException:\s*script returned exit code \d+$/i.test(text)
  );
}

/** 从日志末尾摘失败原因。ponytail: 只看最后 16KB，结构化错误报告以后再加。 */
export function extractBuildFailure(log: string): string {
  const tail = stripConsoleNotes(log.length > FAILURE_TAIL ? log.slice(-FAILURE_TAIL) : log)
    .replace(new RegExp(`${ESC}\\[[0-9;]*m`, 'g'), '')
    .replace(/\r\n/g, '\n');
  const lines = tail.split('\n');
  while (lines.length > 0) {
    const last = lines[lines.length - 1]?.trim() ?? '';
    if (last && !last.startsWith('Finished:')) break;
    lines.pop();
  }
  const window = lines.slice(-80);
  const keep = (line: string) => {
    const text = line.trim();
    return text.length >= 4 && !isFailureNoise(text) && !/^\s+at\s/.test(line);
  };
  const specific = window.filter((line) => keep(line) && !isGenericFailureLine(line.trim()));
  const picked = (specific.length > 0 ? specific : window.filter(keep)).slice(-8);
  const unique: string[] = [];
  for (const line of picked) {
    const text = line.trim();
    if (unique[unique.length - 1] !== text) unique.push(text);
  }
  const text = unique.join('\n');
  return text.length > 800 ? `${text.slice(0, 799)}…` : text;
}

function resultLabel(result: string): string {
  switch (result) {
    case 'SUCCESS':
      return '🟢 成功';
    case 'FAILURE':
      return '🔴 失败';
    case 'UNSTABLE':
      return '🟡 不稳定';
    case 'ABORTED':
      return '⚪ 已中止';
    case 'NOT_BUILT':
      return '⬛ 未构建';
    default:
      return result;
  }
}

function filled(value: string | undefined): string {
  const text = value?.trim();
  return text || '无';
}

function describeCause(value: string | undefined): string {
  return (value ?? '')
    .split('\n')
    .map((line) => {
      const text = line.trim();
      const user = /^Started by user (.+)$/.exec(text);
      if (user) return `用户 ${user[1]}`;
      if (text === 'Started by timer') return '定时';
      if (text === 'Started by an SCM change') return '代码变更';
      const upstream = /^Started by upstream project "([^"]+)" build number (\d+)$/.exec(text);
      if (upstream) return `上游 ${upstream[1]} #${upstream[2]}`;
      const remote = /^Started by remote host (.+)$/.exec(text);
      if (remote) return `远程 ${remote[1]}`;
      return text;
    })
    .filter(Boolean)
    .join('\n');
}

function block(value: string | undefined): string {
  const text = filled(value);
  if (text === '无') return text;
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' · ');
}

function serverHost(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  try {
    const withScheme = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withScheme).host || trimmed;
  } catch {
    return trimmed;
  }
}

function jenkinsServer(name: string, host: string | undefined): { 环境: string; 地址: string } {
  const address = serverHost(host ?? '');
  const title = name.trim();
  const same =
    !title ||
    serverHost(title) === (address || title) ||
    title.replace(/\/+$/, '') === (host ?? '').trim().replace(/\/+$/, '');
  return { 环境: same ? address || title || '无' : title, 地址: address || '无' };
}

/** 空引用块去掉。字段行一律保留，成功和失败用同一套内容。 */
function tightenNotifyText(text: string): string {
  return text
    .replace(/<blockquote>\s*<\/blockquote>\n?/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatDuration(ms: number | null | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '无';
  const total = Math.round(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}小时${minutes}分${seconds}秒`;
  if (minutes > 0) return `${minutes}分${seconds}秒`;
  return `${seconds}秒`;
}

/** 浏览器、系统和同步客户端短编号。认不出浏览器时只留编号。 */
export function notifyClientLabel(clientId: string, userAgent: string): string {
  const id = clientId.replace(/-/g, '').trim().slice(0, 8);
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Firefox\//.test(userAgent)
      ? 'Firefox'
      : /Chrome\//.test(userAgent)
        ? 'Chrome'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : '';
  const os = /Mac OS X|Macintosh/.test(userAgent)
    ? 'macOS'
    : /Windows/.test(userAgent)
      ? 'Windows'
      : /Android/.test(userAgent)
        ? 'Android'
        : /Linux/.test(userAgent)
          ? 'Linux'
          : '';
  return [browser, os, id].filter(Boolean).join(' · ');
}

function formatStart(timestamp: number | undefined): string {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return '无';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '无';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatBuildNotifyText(input: {
  envName: string;
  envHost?: string;
  jobName: string;
  number: number;
  result: string;
  trigger: string;
  buildUrl: string;
  tags?: string;
  template?: string;
  startedAt?: number;
  durationMs?: number | null;
  node?: string;
  cause?: string;
  failure?: string;
  parameters?: string;
  changes?: string;
  artifacts?: string;
  description?: string;
  client?: string;
}): string {
  const node = filled(input.node);
  const server = jenkinsServer(input.envName, input.envHost);
  return tightenNotifyText(
    renderNotifyTemplate(jenkinsBuildTemplateSource(input.template ?? ''), {
      环境: server.环境,
      地址: server.地址,
      任务: input.jobName,
      编号: String(input.number),
      结果: resultLabel(input.result),
      触发: input.trigger,
      原因: block(describeCause(input.cause)),
      错误: block(input.failure),
      开始: formatStart(input.startedAt),
      耗时: formatDuration(input.durationMs),
      节点: node === '无' ? '内置节点' : node,
      参数: block(input.parameters),
      变更: block(input.changes),
      产物: filled(input.artifacts),
      说明: filled(input.description),
      标签: input.tags?.trim() || '无',
      发出者: filled(input.client),
      日志: '',
      链接: input.buildUrl,
    })
  );
}

function notifyLogFilename(jobName: string, number: number): string {
  const base =
    [...jobName]
      .map((char) => (char.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(char) ? '_' : char))
      .join('')
      .slice(0, 60) || 'build';
  return `日志-${base}-${number}.txt`;
}

function triggerLabel(build: NotifyJenkinsBuild): string {
  if (build.userName) return build.userName;
  if (build.userId) return build.userId;
  return '自动';
}

function parseCursor(value: string): number | null {
  if (value === '') return 0;
  if (!DECIMAL_INTEGER.test(value) || !Number.isSafeInteger(Number(value))) return null;
  const parsed = Number(value);
  return parsed < 0 ? null : parsed;
}

function isTerminal(build: NotifyJenkinsBuild): build is NotifyJenkinsBuild & {
  result: string;
  timestamp: number;
} {
  return (
    build.building !== true &&
    typeof build.result === 'string' &&
    TERMINAL_RESULTS.has(build.result) &&
    typeof build.timestamp === 'number' &&
    Number.isFinite(build.timestamp) &&
    build.timestamp > 0
  );
}

function credentialsReady(env: NotifyJenkinsEnv): boolean {
  return Boolean(env.host?.trim() && env.user?.trim() && env.token?.trim());
}

function kvHalt(status: number): boolean {
  return status === 401 || status === 429;
}

type JobOutcome = 'next' | 'halt' | 'env_down';

async function advanceCursor(
  ports: BuildNotifyPorts,
  key: string,
  buildNumber: number,
  spend: boolean
): Promise<{ cursor: number; spent: boolean } | JobOutcome> {
  const written = await ports.putKv(key, String(buildNumber));
  if (kvHalt(written.status)) return 'halt';
  if (written.status !== 200) return 'next';
  if (written.updated) return { cursor: buildNumber, spent: spend };
  if (typeof written.value !== 'string') return 'next';
  const remote = parseCursor(written.value);
  if (remote === null || remote <= buildNumber) return 'next';
  return { cursor: remote, spent: false };
}

/**
 * 构建号越大越晚。一次跳到第一条需要通知的构建前面，避免把名额耗在历史构建上。
 * ponytail: 二分假设时间随构建号递增；中间号缺失时当旧构建跳过。
 */
async function cursorPastOld(
  ports: BuildNotifyPorts,
  env: NotifyJenkinsEnv,
  jobUrl: string,
  cursor: number,
  last: number,
  floor: number
): Promise<number | JobOutcome> {
  const tip = await ports.fetchBuild(env, jobUrl, last);
  if (tip.kind === 'env_down') return 'env_down';
  if (tip.kind === 'stop') return 'next';
  if (tip.kind !== 'build') return cursor;

  let high = last;
  if (!isTerminal(tip.build)) {
    high = last - 1;
    if (high <= cursor) return cursor;
  } else if (tip.build.timestamp < floor) {
    return last;
  }

  let low = cursor + 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const fetched = await ports.fetchBuild(env, jobUrl, mid);
    if (fetched.kind === 'env_down') return 'env_down';
    if (fetched.kind === 'stop') return 'next';
    if (fetched.kind !== 'build' || !isTerminal(fetched.build) || fetched.build.timestamp < floor) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low - 1;
}

async function processJob(
  ports: BuildNotifyPorts,
  env: NotifyJenkinsEnv,
  job: NotifyJenkinsJob & { canonical: string },
  budget: { left: number },
  template: string,
  floor: number | null,
  client: string
): Promise<JobOutcome> {
  const key = await sha256Hex(`${JENKINS_BUILD_SCOPE}\n${job.canonical}`);
  const current = await ports.getKv(key);
  if (kvHalt(current.status)) return 'halt';
  if (current.status !== 200 || typeof current.value !== 'string') return 'next';
  const initialCursor = parseCursor(current.value);
  if (initialCursor === null) return 'next';
  let cursor: number = initialCursor;

  const recipientIds = ports.subscribers ? await ports.subscribers(job.canonical) : undefined;
  if (recipientIds && recipientIds.length === 0) {
    if (job.lastBuildNumber <= cursor) return 'next';
    const tip = await ports.fetchBuild(env, job.url, job.lastBuildNumber);
    if (tip.kind === 'env_down') return 'env_down';
    if (tip.kind === 'stop' || tip.kind !== 'build') return 'next';
    const landed = isTerminal(tip.build) ? job.lastBuildNumber : job.lastBuildNumber - 1;
    if (landed <= cursor) return 'next';
    const advanced = await advanceCursor(ports, key, landed, false);
    return typeof advanced === 'string' ? advanced : 'next';
  }

  if (floor !== null && job.lastBuildNumber > cursor + 1) {
    const jumped = await cursorPastOld(ports, env, job.url, cursor, job.lastBuildNumber, floor);
    if (typeof jumped === 'string') return jumped;
    if (jumped > cursor) {
      const advanced = await advanceCursor(ports, key, jumped, false);
      if (typeof advanced === 'string') return advanced;
      cursor = advanced.cursor;
    }
  }

  while (budget.left > 0) {
    if (job.lastBuildNumber <= cursor) return 'next';
    const buildNumber = cursor + 1;
    const fetched = await ports.fetchBuild(env, job.url, buildNumber);
    if (fetched.kind === 'env_down') return 'env_down';
    if (fetched.kind !== 'build' || !isTerminal(fetched.build)) return 'next';
    if (floor !== null && fetched.build.timestamp < floor) {
      const advanced = await advanceCursor(ports, key, buildNumber, false);
      if (typeof advanced === 'string') return advanced;
      cursor = advanced.cursor;
      continue;
    }

    const dedupKey = canonicalHttpUrl(fetched.build.url);
    if (!dedupKey) return 'next';
    const tags = ports.loadTags ? await ports.loadTags(job.canonical) : '无';
    const jobName = job.fullName?.trim() || job.name.trim() || job.url;
    let logBody = '';
    if (ports.loadLog) {
      try {
        logBody = (await ports.loadLog(env, fetched.build.url)).trim();
      } catch {
        logBody = '';
      }
    }
    const delivered = await ports.deliverOnce({
      scope: JENKINS_BUILD_SCOPE,
      dedupKey,
      occurredAt: fetched.build.timestamp,
      file: ports.loadLog
        ? { filename: notifyLogFilename(jobName, buildNumber), body: logBody || '无' }
        : undefined,
      ...(recipientIds ? { targetIds: recipientIds } : {}),
      text: formatBuildNotifyText({
        envName: env.name,
        envHost: env.host,
        jobName,
        number: buildNumber,
        result: fetched.build.result,
        trigger: triggerLabel(fetched.build),
        buildUrl: fetched.build.url,
        tags,
        template,
        startedAt: fetched.build.timestamp,
        durationMs: fetched.build.durationMs,
        node: fetched.build.builtOn,
        cause: fetched.build.cause,
        failure: fetched.build.result === 'SUCCESS' ? '' : extractBuildFailure(logBody),
        parameters: fetched.build.parameters,
        changes: fetched.build.changes,
        artifacts: fetched.build.artifacts,
        description: fetched.build.description,
        client,
      }),
    });
    if (!delivered.complete) return delivered.halt ? 'halt' : 'next';

    const advanced = await advanceCursor(ports, key, buildNumber, true);
    if (typeof advanced === 'string') return advanced;
    cursor = advanced.cursor;
    if (advanced.spent) budget.left -= 1;
  }
  return 'next';
}

export async function scanJenkinsBuildNotifications(ports: BuildNotifyPorts): Promise<void> {
  const token = (await ports.loadToken()).trim();
  if (!token || !(await ports.hasTargets())) return;

  const environments = [...(await ports.loadEnvironments())].sort(
    (left, right) => (left.order ?? 0) - (right.order ?? 0)
  );
  const budget = { left: BUILD_BUDGET };
  const template = (await ports.loadTemplate?.()) ?? '';
  const floor = (await ports.loadFloor?.()) ?? null;
  const client = (await ports.loadClient?.())?.trim() ?? '';

  for (const env of environments) {
    if (budget.left <= 0) return;
    if (!credentialsReady(env)) continue;
    const listed = await ports.listJobs(env);
    if (!listed.ok) continue;

    const jobs = listed.jobs.flatMap((job) => {
      const canonical = canonicalHttpUrl(job.url);
      return canonical ? [{ ...job, canonical }] : [];
    });
    jobs.sort((left, right) =>
      left.canonical < right.canonical ? -1 : left.canonical > right.canonical ? 1 : 0
    );

    for (const job of jobs) {
      if (budget.left <= 0) return;
      const outcome = await processJob(ports, env, job, budget, template, floor, client);
      if (outcome === 'halt') return;
      if (outcome === 'env_down') break;
    }
  }
}
