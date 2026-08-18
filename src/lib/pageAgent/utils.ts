// src/lib/pageAgent/utils.ts
// PageAgent 共享工具函数

/**
 * 将各种格式的 headers 转换为 Record<string, string>
 */
export function serializeHeaders(
  headers: Headers | Record<string, string> | [string, string][] | undefined
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers) return result;

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      result[key] = value;
    });
  } else if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      result[key] = value;
    }
  } else if (typeof headers === 'object') {
    for (const [key, value] of Object.entries(headers)) {
      result[key] = String(value);
    }
  }

  return result;
}

export function isInjectable(url: string): boolean {
  return /^https?:\/\//.test(url);
}

interface BrowserTabCandidate {
  id?: number;
  url?: string;
}

interface ActiveTabQuery {
  active: true;
  lastFocusedWindow: true;
}

export async function resolveActivePageTabId(
  queryTabs: (query: ActiveTabQuery) => Promise<BrowserTabCandidate[]>
): Promise<number | null> {
  const tabs = await queryTabs({ active: true, lastFocusedWindow: true });
  const activeTab = tabs.find(
    (tab) => tab.id !== undefined && tab.url !== undefined && isInjectable(tab.url)
  );
  return activeTab?.id ?? null;
}
