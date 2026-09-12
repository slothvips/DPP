import { http } from '@/lib/http';
import { logger } from '@/utils/logger';
import { JenkinsApiError, createJenkinsHttpError, createJenkinsNetworkError } from './contracts';
import { assertJenkinsUrlAllowed, normalizeJenkinsRootUrl } from './urlSafety';

/**
 * Encode string for Basic Auth (supports Unicode)
 */
function encodeBasicAuth(username: string, password: string): string {
  const credentials = `${username}:${password}`;
  // Use TextEncoder to handle Unicode properly, then base64 encode
  const encoder = new TextEncoder();
  const bytes = encoder.encode(credentials);
  // Convert Uint8Array to binary string
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export interface JenkinsCredentials {
  baseUrl: string;
  user: string;
  token: string;
}

export function createJenkinsClient(credentials: JenkinsCredentials) {
  const { baseUrl, user, token } = credentials;
  const rootUrl = normalizeJenkinsRootUrl(baseUrl);

  const headers = new Headers();
  headers.set('Authorization', `Basic ${encodeBasicAuth(user, token)}`);

  async function fetchJson<T>(url: string, maxResponseBytes?: number): Promise<T | null> {
    const normalizedUrl = assertJenkinsUrlAllowed(url, rootUrl);
    try {
      const res = await http(normalizedUrl, {
        headers,
        credentials: 'include',
        redirect: 'manual',
        timeout: 30000,
      });
      if (!res.ok) {
        throw createJenkinsHttpError(res, await res.text());
      }
      const contentLength = Number.parseInt(res.headers.get('Content-Length') || '', 10);
      if (
        maxResponseBytes !== undefined &&
        Number.isSafeInteger(contentLength) &&
        contentLength > maxResponseBytes
      ) {
        throw new JenkinsApiError('invalid_response', 'Jenkins 响应过大', res.status);
      }
      try {
        const text = await res.text();
        if (
          maxResponseBytes !== undefined &&
          new TextEncoder().encode(text).length > maxResponseBytes
        ) {
          throw new JenkinsApiError('invalid_response', 'Jenkins 响应过大', res.status);
        }
        return JSON.parse(text) as T;
      } catch (error) {
        if (error instanceof JenkinsApiError) throw error;
        throw new JenkinsApiError('invalid_response', 'Jenkins 返回了无效的 JSON 响应', res.status);
      }
    } catch (error) {
      logger.error('Jenkins API request failed:', error);
      if (error instanceof JenkinsApiError) throw error;
      throw createJenkinsNetworkError(error);
    }
  }

  async function fetchApi<T>(
    url: string,
    tree: string,
    maxResponseBytes?: number
  ): Promise<T | null> {
    const normalizedUrl = assertJenkinsUrlAllowed(url, rootUrl).replace(/\/$/, '');
    return fetchJson<T>(
      `${normalizedUrl}/api/json?tree=${encodeURIComponent(tree)}`,
      maxResponseBytes
    );
  }

  function isFolder(classType?: string): boolean {
    if (!classType) return false;
    return (
      classType.includes('Folder') ||
      classType.includes('WorkflowMultiBranchProject') ||
      classType.includes('OrganizationFolder')
    );
  }

  return {
    rootUrl,
    headers,
    fetchApi,
    fetchJson,
    isFolder,
    isAllowedUrl(url: string): boolean {
      try {
        assertJenkinsUrlAllowed(url, rootUrl);
        return true;
      } catch {
        return false;
      }
    },
  };
}

export type JenkinsClient = ReturnType<typeof createJenkinsClient>;
