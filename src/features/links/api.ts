import { db, syncEngine } from '@/db';

export async function syncLinks() {
  const settings = await db.settings.toArray();
  const serverUrl = settings.find((s) => s.key === 'custom_server_url')?.value as string;

  if (!serverUrl) {
    throw new Error('同步服务器 URL 未配置，请前往设置页面配置');
  }

  await syncEngine.push();
  await syncEngine.pull();

  return 1;
}
