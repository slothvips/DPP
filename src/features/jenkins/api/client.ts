import { http } from '@/lib/http';
import { logger } from '@/utils/logger';
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

  async function fetchApi<T>(url: string, tree: string): Promise<T | null> {
    const normalizedUrl = assertJenkinsUrlAllowed(url, rootUrl).replace(/\/$/, '');
    const apiUrl = `${normalizedUrl}/api/json?tree=${encodeURIComponent(tree)}`;

    try {
      const res = await http(apiUrl, {
        headers,
        redirect: 'manual',
        timeout: 30000,
      });
      if (!res.ok) {
        return null;
      }
      return res.json();
    } catch (error) {
      logger.error('Jenkins API request failed:', error);
      return null;
    }
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
