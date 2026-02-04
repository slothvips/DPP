export interface StartRecordingMessage {
  type: 'RECORDER_START';
  tabId: number;
}

export interface StopRecordingMessage {
  type: 'RECORDER_STOP';
  tabId: number;
}

export interface GetRecordingStatusMessage {
  type: 'RECORDER_GET_STATUS';
  tabId: number;
}

export interface GetRecordingStatusForContentMessage {
  type: 'RECORDER_GET_STATUS_FOR_CONTENT';
}

export interface InjectRecorderMessage {
  type: 'RECORDER_INJECT';
}

export interface StopRecorderMessage {
  type: 'RECORDER_STOP_CAPTURE';
}

export interface RecordingEventMessage {
  type: 'RECORDER_EVENT';
  event: unknown;
}

export interface RecordingCompleteMessage {
  type: 'RECORDER_COMPLETE';
  events: unknown[];
  url: string;
  favicon?: string;
  duration: number;
}

export interface RecordingStatusResponse {
  isRecording: boolean;
  startTime?: number;
  tabId?: number;
}

export interface RecordingSavedMessage {
  type: 'RECORDER_SAVED';
  recordingId: string;
}

export type RecorderMessage =
  | StartRecordingMessage
  | StopRecordingMessage
  | GetRecordingStatusMessage
  | GetRecordingStatusForContentMessage
  | InjectRecorderMessage
  | StopRecorderMessage
  | RecordingEventMessage
  | RecordingCompleteMessage
  | RecordingSavedMessage
  | GetAllRecordingsMessage;

export interface GetAllRecordingsMessage {
  type: 'RECORDER_GET_ALL_RECORDINGS';
}

export interface GetAllRecordingsResponse {
  success: boolean;
  recordings?: import('./types').Recording[];
  error?: string;
}
