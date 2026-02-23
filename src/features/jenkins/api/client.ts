import { http } from '@/lib/http';
import { logger } from '@/utils/logger';

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
  const rootUrl = baseUrl.replace(/\/$/, '');

  const headers = new Headers();
  headers.set('Authorization', `Basic ${encodeBasicAuth(user, token)}`);

  async function fetchApi<T>(url: string, tree: string): Promise<T | null> {
    const normalizedUrl = url.replace(/\/$/, '');
    const apiUrl = `${normalizedUrl}/api/json?tree=${encodeURIComponent(tree)}`;

    try {
      const res = await http(apiUrl, {
        headers,
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
  };
}

export type JenkinsClient = ReturnType<typeof createJenkinsClient>;
