import { http } from '@/lib/http';
import { createJenkinsClient } from './client';
import { createJenkinsHttpError, createJenkinsNetworkError } from './contracts';
import { assertJenkinsRedirectAllowed, assertJenkinsUrlAllowed } from './urlSafety';

export interface JenkinsQueueApiItem {
  id?: number;
  why?: string;
  blocked?: boolean;
  buildable?: boolean;
  stuck?: boolean;
  cancelled?: boolean;
  inQueueSince?: number;
  executable?: { number?: number; url?: string };
  task?: { name?: string; url?: string };
}

export interface JenkinsQueueItem {
  id: string;
  state: 'queued' | 'blocked' | 'executable' | 'cancelled' | 'expired' | 'unknown';
  why?: string;
  buildUrl?: string;
  buildNumber?: number;
  jobUrl?: string;
  jobName?: string;
  inQueueSince?: number;
}

const QUEUE_TREE = 'id,why,blocked,buildable,stuck,cancelled,executable[number,url],task[name,url]';
const QUEUE_LIST_TREE =
  'items[id,why,blocked,buildable,stuck,cancelled,inQueueSince,executable[number,url],task[name,url]]';
const MAX_QUEUE_ITEMS = 200;

function safeAllowedUrl(value: string | undefined, rootUrl: string): string | undefined {
  if (!value) return undefined;
  try {
    return assertJenkinsUrlAllowed(value, rootUrl);
  } catch {
    return undefined;
  }
}

function toQueueItem(item: JenkinsQueueApiItem, rootUrl: string): JenkinsQueueItem | null {
  if (item.id === undefined || item.id === null) return null;
  const jobUrl = safeAllowedUrl(item.task?.url, rootUrl);
  const jobName = item.task?.name;
  const base = {
    id: String(item.id),
    why: item.why,
    jobUrl,
    jobName,
    inQueueSince: item.inQueueSince,
  };

  if (item.cancelled) {
    return { ...base, state: 'cancelled' };
  }
  if (item.executable?.url) {
    return {
      ...base,
      state: 'executable',
      buildUrl: safeAllowedUrl(item.executable.url, rootUrl),
      buildNumber: item.executable.number,
    };
  }
  return {
    ...base,
    state: item.blocked || item.stuck ? 'blocked' : item.buildable ? 'queued' : 'unknown',
  };
}

export async function getQueueItem(
  queueId: string,
  user: string,
  token: string,
  jenkinsHost: string
): Promise<JenkinsQueueItem> {
  if (!/^\d+$/.test(queueId)) throw new Error('Jenkins 队列 ID 无效');
  const client = createJenkinsClient({ baseUrl: jenkinsHost, user, token });
  const data = await client.fetchApi<JenkinsQueueApiItem>(
    `${client.rootUrl}/queue/item/${queueId}/`,
    QUEUE_TREE
  );
  if (!data) throw new Error('Jenkins 队列返回为空');
  return toQueueItem(data, client.rootUrl) ?? { id: queueId, state: 'unknown' };
}

/**
 * Enumerates the live Jenkins queue rather than the locally triggered subset.
 */
export async function listQueue(
  user: string,
  token: string,
  jenkinsHost: string
): Promise<JenkinsQueueItem[]> {
  const client = createJenkinsClient({ baseUrl: jenkinsHost, user, token });
  const data = await client.fetchApi<{ items?: JenkinsQueueApiItem[] }>(
    `${client.rootUrl}/queue`,
    QUEUE_LIST_TREE
  );
  const items = Array.isArray(data?.items) ? data.items : [];
  return items
    .slice(0, MAX_QUEUE_ITEMS)
    .map((item) => toQueueItem(item, client.rootUrl))
    .filter((item): item is JenkinsQueueItem => item !== null);
}

export async function cancelQueueItem(
  queueId: string,
  user: string,
  token: string,
  jenkinsHost: string
): Promise<boolean> {
  if (!/^\d+$/.test(queueId)) throw new Error('Jenkins 队列 ID 无效');
  const client = createJenkinsClient({ baseUrl: jenkinsHost, user, token });
  const url = `${client.rootUrl}/queue/cancelItem?id=${encodeURIComponent(queueId)}`;
  const headers = new Headers(client.headers);
  const crumb = await getCrumb(client.rootUrl, client.headers);
  if (crumb) headers.set(crumb.header, crumb.value);

  try {
    const response = await http(url, {
      method: 'POST',
      headers,
      credentials: 'include',
      redirect: 'manual',
      timeout: 30_000,
    });
    assertJenkinsRedirectAllowed(response, url, client.rootUrl);
    if (!response.ok && response.status !== 302) {
      throw createJenkinsHttpError(response, await response.text());
    }
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'JenkinsApiError') throw error;
    throw createJenkinsNetworkError(error);
  }
}

async function getCrumb(rootUrl: string, headers: Headers) {
  try {
    const response = await http(`${rootUrl}/crumbIssuer/api/json`, {
      headers,
      credentials: 'include',
      redirect: 'manual',
      timeout: 10_000,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { crumbRequestField?: string; crumb?: string };
    return data.crumbRequestField && data.crumb
      ? { header: data.crumbRequestField, value: data.crumb }
      : null;
  } catch {
    return null;
  }
}
