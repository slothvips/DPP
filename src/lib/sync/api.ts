import { syncEngine } from '@/db';
import { getSetting } from '@/lib/db/settings';
import { logger } from '@/utils/logger';

export async function syncDatabase() {
  const serverUrl = await getSetting('custom_server_url');

  if (!serverUrl) {
    logger.debug('[GlobalSync] Sync server URL not configured, skipping');
    return 0;
  }

  await syncEngine.push();
  await syncEngine.pull();

  return 1;
}
