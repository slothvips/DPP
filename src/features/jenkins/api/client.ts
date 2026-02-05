import { http } from '@/lib/http';

export interface JenkinsCredentials {
  baseUrl: string;
  user: string;
  token: string;
}

export function createJenkinsClient(credentials: JenkinsCredentials) {
  const { baseUrl, user, token } = credentials;
  const rootUrl = baseUrl.replace(/\/$/, '');

  const headers = new Headers();
  headers.set('Authorization', `Basic ${btoa(`${user}:${token}`)}`);

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
    } catch {
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
