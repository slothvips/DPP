import { browser } from 'wxt/browser';
import type { RecordingState } from '@/features/recorder/types';
import { addRecording, getAllRecordings, getRecordingById } from '@/lib/db/recorder';
import { logger } from '@/utils/logger';
import { clearRecordingState, getRecordingState, setRecordingState } from './recorderState';

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

export async function handleRecorderStart(tabId: number) {
  setRecordingState(tabId, { isRecording: true, startTime: Date.now(), tabId });
  try {
    await browser.tabs.sendMessage(tabId, { type: 'RECORDER_INJECT' });
    return { success: true };
  } catch (error) {
    logger.warn(`Failed to inject recorder on tab ${tabId}:`, error);
    clearRecordingState(tabId);
    return { success: false, error: 'Content script not ready' };
  }
}

export async function handleRecorderStop(tabId: number) {
  try {
    await browser.tabs.sendMessage(tabId, { type: 'RECORDER_STOP_CAPTURE' });
    return { success: true };
  } catch (error) {
    logger.warn(`Failed to stop recorder on tab ${tabId}:`, error);
    clearRecordingState(tabId);
    return { success: false, error: 'Lost connection to tab' };
  }
}

export function handleRecorderStatus(tabId: number) {
  const state = getRecordingState(tabId);
  logger.debug('Recorder status requested:', { tabId, state });
  return { success: true, data: state };
}

export function handleRecorderStatusForContent(sender: chrome.runtime.MessageSender) {
  const tabId = sender.tab?.id;
  if (!tabId) {
    return { success: true, data: { isRecording: false } };
  }

  return { success: true, data: getRecordingState(tabId) };
}

export async function handleGetAllRecordings() {
  const recordings = await getAllRecordings();
  const metas = recordings.map(({ events: _events, ...meta }) => meta);
  return { success: true, data: metas };
}

export async function handleGetRecordingById(id: string) {
  const recording = await getRecordingById(id);
  if (!recording) {
    return { success: false, error: 'Recording not found' };
  }

  return { success: true, data: recording };
}

export async function handleRecorderComplete(
  message: Extract<RecorderMessage, { type: 'RECORDER_COMPLETE' }>,
  sender: chrome.runtime.MessageSender
) {
  const tabId = sender.tab?.id;
  if (!tabId) {
    return { success: false, error: 'No tab ID' };
  }

  clearRecordingState(tabId);

  const id = crypto.randomUUID();
  const recording = {
    id,
    title: `Recording - ${new Date().toLocaleString()}`,
    url: message.url,
    favicon: message.favicon,
    createdAt: Date.now(),
    duration: message.duration,
    eventsCount: message.events.length,
    fileSize: JSON.stringify(message.events).length,
    events: message.events,
  };

  await addRecording(recording);

  const savedMessage: RecordingSavedMessage = {
    type: 'RECORDER_SAVED',
    recordingId: id,
  };
  browser.runtime.sendMessage(savedMessage).catch(() => {});
  return { success: true, data: { recordingId: id } };
}
