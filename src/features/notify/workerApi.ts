import { getSetting } from '@/lib/db/settings';
import { getSyncServerBaseUrl } from '@/lib/sync/syncServerConfig';

export async function hasNotifyTeamSync(): Promise<boolean> {
  const key = await getSetting('sync_encryption_key');
  const server = await getSetting('custom_server_url');
  return (
    typeof key === 'string' &&
    key.trim() !== '' &&
    typeof server === 'string' &&
    server.trim() !== ''
  );
}

/** Worker 请求不携带机器人 Token、正文或 Jenkins 地址。 */
export async function notifyWorkerRequest(
  path: string,
  options?: { method?: 'GET' | 'POST' | 'PUT'; json?: unknown }
): Promise<Response> {
  const base = await getSyncServerBaseUrl();
  const tokenSetting = await getSetting('sync_access_token');
  const token = typeof tokenSetting === 'string' ? tokenSetting : '';
  if (!base) return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });

  const headers = new Headers({ 'X-Access-Token': token });
  const init: RequestInit = {
    method: options?.method ?? 'POST',
    headers,
    signal: AbortSignal.timeout(30_000),
  };
  if (options?.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    init.body = JSON.stringify(options.json);
  }
  try {
    return await fetch(`${base}${path}`, init);
  } catch {
    return new Response(JSON.stringify({ error: 'network' }), { status: 503 });
  }
}
