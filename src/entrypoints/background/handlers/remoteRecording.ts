// Remote recording cache handlers for background script
import { browser } from 'wxt/browser';
import { logger } from '@/utils/logger';

interface CachedRecording {
  events: unknown[];
  title: string;
  timestamp: number;
}

const remoteRecordingCache = new Map<string, CachedRecording>();
const CACHE_EXPIRY_MS = 5 * 60 * 1000;

export type RemoteRecordingMessage =
  | {
      type: 'REMOTE_RECORDING_CACHE';
      payload: { cacheId: string; events: unknown[]; title: string };
    }
  | { type: 'REMOTE_RECORDING_GET'; payload: { cacheId: string } }
  | { type: 'OPEN_PLAYER_TAB'; payload: { cacheId: string } };

/**
 * Handle remote recording cache messages
 */
export function handleRemoteRecordingMessage(message: RemoteRecordingMessage): {
  success: boolean;
  data?: unknown;
  error?: string;
} {
  switch (message.type) {
    case 'REMOTE_RECORDING_CACHE': {
      const { cacheId, events, title } = message.payload;
      remoteRecordingCache.set(cacheId, { events, title, timestamp: Date.now() });
      logger.debug('Cached remote recording:', cacheId, 'events:', events.length);
      return { success: true };
    }

    case 'REMOTE_RECORDING_GET': {
      const { cacheId } = message.payload;
      const cached = remoteRecordingCache.get(cacheId);

      if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
        const result = { success: true, data: { events: cached.events, title: cached.title } };
        setTimeout(() => remoteRecordingCache.delete(cacheId), 5000);
        return result;
      } else {
        if (cached) remoteRecordingCache.delete(cacheId);
        return { success: false, error: 'Cache expired or not found' };
      }
    }

    case 'OPEN_PLAYER_TAB': {
      const { cacheId } = message.payload;
      const playerUrl = browser.runtime.getURL(`/player.html?cache=${cacheId}`);
      browser.tabs.create({ url: playerUrl });
      return { success: true };
    }

    default:
      return { success: false, error: 'Unknown remote recording message type' };
  }
}
