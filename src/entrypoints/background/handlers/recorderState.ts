import type { RecordingState } from '@/features/recorder/types';
import { logger } from '@/utils/logger';

const recordingStates = new Map<number, RecordingState>();
const MAX_RECORDING_STATES = 100;
const RECORDING_STATE_EXPIRY_MS = 60 * 60 * 1000;

export function cleanupExpiredRecordingStates() {
  const now = Date.now();
  for (const [tabId, state] of recordingStates.entries()) {
    if (state.startTime && now - state.startTime > RECORDING_STATE_EXPIRY_MS) {
      logger.debug(`Cleaning up expired recording state for tab ${tabId}`);
      recordingStates.delete(tabId);
    }
  }
}

export function setRecordingState(tabId: number, state: RecordingState) {
  cleanupExpiredRecordingStates();
  if (recordingStates.size >= MAX_RECORDING_STATES) {
    const firstKey = recordingStates.keys().next().value;
    if (firstKey !== undefined) {
      recordingStates.delete(firstKey);
    }
  }

  recordingStates.set(tabId, state);
}

export function clearRecordingState(tabId: number) {
  recordingStates.delete(tabId);
}

export function getRecordingState(tabId: number): RecordingState {
  return recordingStates.get(tabId) || { isRecording: false };
}
