import { http } from '@/lib/http';
import { logger } from '@/utils/logger';
import { createJenkinsClient } from './client';

export async function triggerBuild(
  jobUrl: string,
  user: string,
  token: string,
  jenkinsHost: string,
  parameters?: Record<string, string | boolean | number>
): Promise<boolean> {
  const client = createJenkinsClient({ baseUrl: jenkinsHost, user, token });
  const rootUrl = jobUrl.replace(/\/$/, '');

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
      timeout: 30000,
    });

    if (res.status >= 200 && res.status < 300) {
      return true;
    }
    // 201 Created is typical
    logger.error(`Build failed: ${res.status} ${res.statusText}`);
    return false;
  } catch (e) {
    logger.error('Build error:', e);
    return false;
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

export async function getJobDetails(jobUrl: string, user: string, token: string) {
  const client = createJenkinsClient({ baseUrl: jobUrl, user, token });
  const apiUrl = `${client.rootUrl}/api/json`;

  const res = await http(apiUrl, {
    headers: client.headers,
    timeout: 30000,
  });
  if (!res.ok) throw new Error(`Failed to fetch job details: ${res.status}`);
  return res.json();
}

async function getCrumb(baseUrl: string, user: string, token: string) {
  try {
    const client = createJenkinsClient({ baseUrl, user, token });
    const res = await http(`${client.rootUrl}/crumbIssuer/api/json`, {
      headers: client.headers,
      timeout: 30000,
    });
    if (res.ok) {
      const data = (await res.json()) as { crumbRequestField?: string; crumb?: string };
      return { header: data.crumbRequestField || '', value: data.crumb || '' };
    }
  } catch (e) {
    logger.error('Error fetching crumb:', e);
  }
  return null;
}
