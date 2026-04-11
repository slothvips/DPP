// Sync message handlers for background script
import {
  type SyncMessage,
  handleAutoSyncPull,
  handleAutoSyncPush,
  handleGlobalSyncPull,
  handleGlobalSyncPush,
  handleGlobalSyncStart,
} from './syncMessages';
import { setupAutoSync } from './syncShared';

export { setupAutoSync };
export type { SyncMessage };

export async function handleSyncMessage(
  message: SyncMessage
): Promise<{ success: boolean; error?: string }> {
  switch (message.type) {
    case 'AUTO_SYNC_TRIGGER_PUSH':
      return await handleAutoSyncPush();
    case 'AUTO_SYNC_TRIGGER_PULL':
      return await handleAutoSyncPull();
    case 'GLOBAL_SYNC_START':
      return await handleGlobalSyncStart();
    case 'GLOBAL_SYNC_PUSH':
      return await handleGlobalSyncPush();
    case 'GLOBAL_SYNC_PULL':
      return await handleGlobalSyncPull();
    default:
      return { success: false, error: 'Unknown sync message type' };
  }
}
