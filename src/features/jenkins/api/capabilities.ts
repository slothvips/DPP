import type {
  JenkinsCapabilityCheck,
  JenkinsCapabilitySnapshot,
  JenkinsCapabilityStatus,
} from '@/db';
import { http } from '@/lib/http';
import { createJenkinsClient } from './client';
import { JenkinsApiError, createJenkinsHttpError, createJenkinsNetworkError } from './contracts';

interface JenkinsMeResponse {
  id?: string;
  fullName?: string;
}

const MAX_CAPABILITY_BYTES = 256_000;

function toCheck(error: unknown, reason: string): JenkinsCapabilityCheck {
  const checkedAt = Date.now();
  if (error instanceof JenkinsApiError) {
    const status: JenkinsCapabilityStatus =
      error.code === 'permission' ? 'permission' : error.code === 'not_found' ? 'unknown' : 'error';
    return { status, checkedAt, reason: error.message || reason };
  }
  return { status: 'error', checkedAt, reason };
}

export async function probeJenkinsCapabilities(
  baseUrl: string,
  user: string,
  token: string
): Promise<JenkinsCapabilitySnapshot> {
  const client = createJenkinsClient({ baseUrl, user, token });
  const checkedAt = Date.now();
  const snapshot: JenkinsCapabilitySnapshot = {
    checkedAt,
    read: { status: 'unknown', checkedAt },
    queue: { status: 'unknown', checkedAt },
    crumb: { status: 'unknown', checkedAt },
    testReport: { status: 'unknown', checkedAt, reason: '按构建探测' },
    artifacts: { status: 'unknown', checkedAt, reason: '按构建探测' },
    parameters: { status: 'unknown', checkedAt, reason: '按 Job 探测' },
    permissions: {
      read: { status: 'unknown', checkedAt },
      discover: { status: 'unknown', checkedAt },
      build: { status: 'unknown', checkedAt, reason: '需要在具体 Job 上确认' },
      cancel: { status: 'unknown', checkedAt, reason: '需要在具体 Job 上确认' },
    },
  };

  try {
    const response = await http(
      `${client.rootUrl}/api/json?tree=mode,useCrumbs,useSecurity,jobs[name]`,
      { headers: client.headers, credentials: 'include', redirect: 'manual', timeout: 15_000 }
    );
    if (!response.ok) throw createJenkinsHttpError(response, await response.text());
    snapshot.version = response.headers.get('X-Jenkins') ?? undefined;
    snapshot.read = { status: 'available', checkedAt };
    snapshot.permissions = {
      read: { status: 'available', checkedAt },
      discover: { status: 'available', checkedAt },
      build: { status: 'unknown', checkedAt, reason: '需要在具体 Job 上确认' },
      cancel: { status: 'unknown', checkedAt, reason: '需要在具体 Job 上确认' },
    };
  } catch (error) {
    const check = toCheck(error, '无法读取 Jenkins 根信息');
    snapshot.read = check;
    snapshot.permissions = {
      read: check,
      discover: check,
      build: { status: 'unknown', checkedAt, reason: '需要在具体 Job 上确认' },
      cancel: { status: 'unknown', checkedAt, reason: '需要在具体 Job 上确认' },
    };
    return snapshot;
  }

  try {
    const me = await client.fetchJson<JenkinsMeResponse>(
      `${client.rootUrl}/me/api/json`,
      MAX_CAPABILITY_BYTES
    );
    if (me) snapshot.user = { id: me.id, fullName: me.fullName };
  } catch {
    // Identity is best-effort; anonymous accounts may not expose it.
  }

  try {
    await client.fetchJson<unknown>(`${client.rootUrl}/queue/api/json`, MAX_CAPABILITY_BYTES);
    snapshot.queue = { status: 'available', checkedAt: Date.now() };
  } catch (error) {
    snapshot.queue = toCheck(error, '无法读取 Jenkins 队列');
  }

  try {
    const response = await http(`${client.rootUrl}/crumbIssuer/api/json`, {
      headers: client.headers,
      credentials: 'include',
      redirect: 'manual',
      timeout: 10_000,
    });
    if (response.ok) {
      snapshot.crumb = { status: 'available', checkedAt: Date.now() };
    } else if (response.status === 404) {
      snapshot.crumb = { status: 'unknown', checkedAt: Date.now(), reason: '未启用 CSRF crumb' };
    } else {
      snapshot.crumb = toCheck(createJenkinsHttpError(response, ''), '无法读取 CSRF crumb');
    }
  } catch (error) {
    snapshot.crumb = toCheck(createJenkinsNetworkError(error), '无法读取 CSRF crumb');
  }

  return snapshot;
}
