// Recorder message handlers for background script
import { browser } from 'wxt/browser';
import type { RecordingState } from '@/features/recorder/types';
import { addRecording, getAllRecordings, getRecordingById } from '@/lib/db/recorder';
import { logger } from '@/utils/logger';

export type { RecordingState };

export interface RecordingSavedMessage {
  type: 'RECORDER_SAVED';
  recordingId: string;
}

export type RecorderMessage =
  | { type: 'RECORDER_START'; tabId: number }
  | { type: 'RECORDER_STOP'; tabId: number }
  | { type: 'RECORDER_GET_STATUS'; tabId: number }
  | { type: 'RECORDER_GET_STATUS_FOR_CONTENT' }
  | { type: 'RECORDER_GET_ALL_RECORDINGS' }
  | { type: 'RECORDER_GET_RECORDING_BY_ID'; id: string }
  | {
      type: 'RECORDER_COMPLETE';
      events: unknown[];
      url: string;
      favicon?: string;
      duration: number;
    };

// Recording state management
const recordingStates = new Map<number, RecordingState>();
const MAX_RECORDING_STATES = 100;
const RECORDING_STATE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/**
 * Clean up expired recording states to prevent memory leaks
 */
function cleanupExpiredRecordingStates() {
  const now = Date.now();
  for (const [tabId, state] of recordingStates.entries()) {
    if (state.startTime && now - state.startTime > RECORDING_STATE_EXPIRY_MS) {
      logger.debug(`Cleaning up expired recording state for tab ${tabId}`);
      recordingStates.delete(tabId);
    }
  }
}

/**
 * Handle Recorder messages
 */
export async function handleRecorderMessage(
  message: RecorderMessage,
  sender: chrome.runtime.MessageSender
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    switch (message.type) {
      case 'RECORDER_START': {
        const { tabId } = message;
        // Prevent memory leak: cleanup expired states first, then enforce size limit
        cleanupExpiredRecordingStates();
        if (recordingStates.size >= MAX_RECORDING_STATES) {
          const firstKey = recordingStates.keys().next().value;
          if (firstKey !== undefined) {
            recordingStates.delete(firstKey);
          }
        }
        recordingStates.set(tabId, { isRecording: true, startTime: Date.now(), tabId });
        try {
          await browser.tabs.sendMessage(tabId, { type: 'RECORDER_INJECT' });
          return { success: true };
        } catch (e) {
          logger.warn(`Failed to inject recorder on tab ${tabId}:`, e);
          recordingStates.delete(tabId);
          return { success: false, error: 'Content script not ready' };
        }
      }

      case 'RECORDER_STOP': {
        const { tabId } = message;
        try {
          await browser.tabs.sendMessage(tabId, { type: 'RECORDER_STOP_CAPTURE' });
          return { success: true };
        } catch (e) {
          logger.warn(`Failed to stop recorder on tab ${tabId}:`, e);
          recordingStates.delete(tabId);
          return { success: false, error: 'Lost connection to tab' };
        }
      }

      case 'RECORDER_GET_STATUS': {
        const { tabId } = message;
        const state = recordingStates.get(tabId) || { isRecording: false };
        logger.debug('Recorder status requested:', { tabId, state });
        return { success: true, data: state };
      }

      case 'RECORDER_GET_STATUS_FOR_CONTENT': {
        const tabId = sender.tab?.id;
        if (tabId) {
          const state = recordingStates.get(tabId) || { isRecording: false };
          return { success: true, data: state };
        } else {
          return { success: true, data: { isRecording: false } };
        }
      }

      case 'RECORDER_GET_ALL_RECORDINGS': {
        const recordings = await getAllRecordings();
        const metas = recordings.map(({ events: _events, ...meta }) => meta);
        return { success: true, data: metas };
      }

      case 'RECORDER_GET_RECORDING_BY_ID': {
        const recording = await getRecordingById(message.id);
        if (recording) {
          return { success: true, data: recording };
        } else {
          return { success: false, error: 'Recording not found' };
        }
      }

      case 'RECORDER_COMPLETE': {
        const { events, url, favicon, duration } = message;
        const tabId = sender.tab?.id;

        if (tabId) {
          recordingStates.delete(tabId);

          const id = crypto.randomUUID();
          const recording = {
            id,
            title: `Recording - ${new Date().toLocaleString()}`,
            url,
            favicon,
            createdAt: Date.now(),
            duration,
            eventsCount: events.length,
            fileSize: JSON.stringify(events).length,
            events,
          };

          await addRecording(recording);

          const savedMessage: RecordingSavedMessage = {
            type: 'RECORDER_SAVED',
            recordingId: id,
          };
          browser.runtime.sendMessage(savedMessage).catch(() => {});
          return { success: true, data: { recordingId: id } };
        } else {
          return { success: false, error: 'No tab ID' };
        }
      }

      default:
        return { success: false, error: 'Unknown recorder message type' };
    }
  } catch (e) {
    logger.error('Recorder error:', e);
    return { success: false, error: String(e) };
  }
}
