// Recorder message handlers for background script
import { logger } from '@/utils/logger';
import {
  type RecorderMessage,
  type RecordingSavedMessage,
  handleGetAllRecordings,
  handleGetRecordingById,
  handleRecorderComplete,
  handleRecorderStart,
  handleRecorderStatus,
  handleRecorderStatusForContent,
  handleRecorderStop,
} from './recorderMessages';

export type { RecorderMessage, RecordingSavedMessage };

export async function handleRecorderMessage(
  message: RecorderMessage,
  sender: chrome.runtime.MessageSender
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    switch (message.type) {
      case 'RECORDER_START':
        return await handleRecorderStart(message.tabId);
      case 'RECORDER_STOP':
        return await handleRecorderStop(message.tabId);
      case 'RECORDER_GET_STATUS':
        return handleRecorderStatus(message.tabId);
      case 'RECORDER_GET_STATUS_FOR_CONTENT':
        return handleRecorderStatusForContent(sender);
      case 'RECORDER_GET_ALL_RECORDINGS':
        return await handleGetAllRecordings();
      case 'RECORDER_GET_RECORDING_BY_ID':
        return await handleGetRecordingById(message.id);
      case 'RECORDER_COMPLETE':
        return await handleRecorderComplete(message, sender);
      default:
        return { success: false, error: 'Unknown recorder message type' };
    }
  } catch (error) {
    logger.error('Recorder error:', error);
    return { success: false, error: String(error) };
  }
}
