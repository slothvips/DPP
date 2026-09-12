import type { JenkinsTriggerResult } from '@/features/jenkins/messages';
import { http } from '@/lib/http';
import { logger } from '@/utils/logger';
import { createJenkinsClient } from './client';
import { JenkinsApiError, createJenkinsHttpError, createJenkinsNetworkError } from './contracts';
import { assertJenkinsRedirectAllowed, assertJenkinsUrlAllowed } from './urlSafety';

export async function triggerBuild(
  jobUrl: string,
  user: string,
  token: string,
  jenkinsHost: string,
  parameters?: Record<string, string | boolean | number>
): Promise<JenkinsTriggerResult> {
  const client = createJenkinsClient({ baseUrl: jenkinsHost, user, token });
  const rootUrl = assertJenkinsUrlAllowed(jobUrl, client.rootUrl).replace(/\/$/, '');

  // Clone headers to avoid mutating the client's base headers
  const headers = new Headers(client.headers);
  headers.set('Content-Type', 'application/x-www-form-urlencoded');

  try {
    const crumb = await getCrumb(jenkinsHost, user, token);
    if (crumb) {
      headers.set(crumb.header, crumb.value);
    }
  } catch (e) {
    logger.warn('Failed to fetch crumb, proceeding without it:', e);
  }

  let apiUrl = `${rootUrl}/build`;
  const params = new URLSearchParams();

  // If parameters are provided, use /buildWithParameters
  if (parameters && Object.keys(parameters).length > 0) {
    apiUrl = `${rootUrl}/buildWithParameters`;
    for (const [key, value] of Object.entries(parameters)) {
      params.append(key, String(value));
    }
  }

  // Usually need json parameter for complex builds, but simple KV works for most
  // Jenkins is tricky. Standard form post usually works.

  try {
    const res = await http(apiUrl, {
      method: 'POST',
      headers,
      body: params,
      credentials: 'include',
      redirect: 'manual',
      timeout: 30000,
    });
    assertJenkinsRedirectAllowed(res, apiUrl, client.rootUrl);

    const successStatuses = [200, 201, 202, 302];
    if (successStatuses.includes(res.status)) {
      const location = res.headers.get('Location');
      if (!location) {
        return { accepted: true, status: 'unknown' };
      }
      const queueUrl = new URL(location, apiUrl).href;
      try {
        assertJenkinsUrlAllowed(queueUrl, client.rootUrl);
      } catch (error) {
        throw new JenkinsApiError(
          'invalid_response',
          error instanceof Error ? `Jenkins 队列地址无效: ${error.message}` : 'Jenkins 队列地址无效'
        );
      }
      const queueMatch = new URL(queueUrl).pathname.match(/\/queue\/item\/(\d+)\/?$/);
      return {
        accepted: true,
        status: queueMatch ? 'accepted' : 'unknown',
        queueId: queueMatch?.[1],
        queueUrl,
      };
    }
    const body = await res.text();
    throw createJenkinsHttpError(res, body);
  } catch (e) {
    logger.error('Build error:', e);
    if (e instanceof Error && e.name === 'JenkinsApiError') throw e;
    throw createJenkinsNetworkError(e);
  }
}

export interface BuildParameter {
  _class: string;
  name: string;
  type: string;
  description?: string;
  defaultParameterValue?: { value: string | boolean | number };
  choices?: string[];
}

export async function getJobDetails(
  jobUrl: string,
  user: string,
  token: string,
  jenkinsHost: string
) {
  const client = createJenkinsClient({ baseUrl: jenkinsHost, user, token });
  const rootUrl = assertJenkinsUrlAllowed(jobUrl, client.rootUrl).replace(/\/$/, '');
  const apiUrl = `${rootUrl}/api/json`;
  return client.fetchJson<unknown>(apiUrl, 512_000);
}

export async function getCrumb(baseUrl: string, user: string, token: string) {
  try {
    const client = createJenkinsClient({ baseUrl, user, token });
    const res = await http(`${client.rootUrl}/crumbIssuer/api/json`, {
      headers: client.headers,
      credentials: 'include',
      redirect: 'manual',
      timeout: 30000,
    });
    if (res.ok) {
      const data = (await res.json()) as { crumbRequestField?: string; crumb?: string };
      if (data.crumbRequestField && data.crumb) {
        return { header: data.crumbRequestField, value: data.crumb };
      }
    }
  } catch (e) {
    logger.error('Error fetching crumb:', e);
  }
  return null;
}

export async function cancelBuild(
  jobUrl: string,
  buildNumber: number,
  user: string,
  token: string,
  jenkinsHost: string
): Promise<boolean> {
  const buildUrl = `${assertJenkinsUrlAllowed(jobUrl, createJenkinsClient({ baseUrl: jenkinsHost, user, token }).rootUrl).replace(/\/$/, '')}/${buildNumber}`;
  return stopBuild(buildUrl, user, token, jenkinsHost);
}

export async function stopBuild(
  buildUrl: string,
  user: string,
  token: string,
  jenkinsHost: string
): Promise<boolean> {
  const client = createJenkinsClient({ baseUrl: jenkinsHost, user, token });
  const rootUrl = assertJenkinsUrlAllowed(buildUrl, client.rootUrl).replace(/\/$/, '');

  const headers = new Headers(client.headers);

  try {
    const crumb = await getCrumb(jenkinsHost, user, token);
    if (crumb) {
      headers.set(crumb.header, crumb.value);
    }
  } catch (e) {
    logger.warn('Failed to fetch crumb, proceeding without it:', e);
  }

  const apiUrl = `${rootUrl}/stop`;

  try {
    const res = await http(apiUrl, {
      method: 'POST',
      headers,
      credentials: 'include',
      redirect: 'manual',
      timeout: 30000,
    });
    assertJenkinsRedirectAllowed(res, apiUrl, client.rootUrl);

    // Jenkins answers /stop with 302 to the build page, so accept 2xx and 3xx.
    if (res.status >= 200 && res.status < 400) {
      return true;
    }
    throw createJenkinsHttpError(res, await res.text());
  } catch (e) {
    logger.error('Cancel build error:', e);
    if (e instanceof Error && e.name === 'JenkinsApiError') throw e;
    throw createJenkinsNetworkError(e);
  }
}
