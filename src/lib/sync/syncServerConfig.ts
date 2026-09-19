import { getSetting } from '@/lib/db/settings';

/** 规范化团队同步服务器根地址；非法或未配置时返回 null */
export function normalizeSyncServerBaseUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    return trimmed;
  } catch {
    return null;
  }
}

export async function getSyncServerBaseUrl(): Promise<string | null> {
  return normalizeSyncServerBaseUrl(await getSetting('custom_server_url'));
}

/** 是否已配置并保存同步服务器地址（个人私钥配置的前置条件） */
export async function hasConfiguredSyncServer(): Promise<boolean> {
  const serverUrl = await getSetting('custom_server_url');
  return typeof serverUrl === 'string' && serverUrl.trim().length > 0;
}
