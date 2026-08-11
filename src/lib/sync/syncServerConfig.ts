import { getSetting } from '@/lib/db/settings';

/** 是否已配置并保存同步服务器地址（个人私钥配置的前置条件） */
export async function hasConfiguredSyncServer(): Promise<boolean> {
  const serverUrl = await getSetting('custom_server_url');
  return typeof serverUrl === 'string' && serverUrl.trim().length > 0;
}
