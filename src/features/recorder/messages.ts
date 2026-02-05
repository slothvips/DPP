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

export interface RequestStreamMessage {
  type: 'RECORDER_REQUEST_STREAM';
}

export interface PreviewSignalMessage {
  type: 'PREVIEW_SIGNAL';
  payload: {
    signal: unknown;
    target: 'offscreen' | 'preview';
  };
}

export interface PreviewOpenMessage {
  type: 'PREVIEW_OPEN';
}

export type RecorderMessage =
  | StartRecordingMessage
  | StopRecordingMessage
  | GetRecordingStatusMessage
  | GetRecordingStatusForContentMessage
  | InjectRecorderMessage
  | StopRecorderMessage
  | RecordingCompleteMessage
  | RecordingSavedMessage
  | GetAllRecordingsMessage
  | GetRecordingByIdMessage
  | RequestStreamMessage
  | PreviewSignalMessage
  | PreviewOpenMessage;

export interface GetAllRecordingsMessage {
  type: 'RECORDER_GET_ALL_RECORDINGS';
}

/** 录像元数据（不含 events，用于列表展示） */
export interface RecordingMeta {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  createdAt: number;
  duration: number;
  eventsCount: number;
  fileSize: number;
}

export interface GetAllRecordingsResponse {
  success: boolean;
  recordings?: RecordingMeta[];
  error?: string;
}

export interface GetRecordingByIdMessage {
  type: 'RECORDER_GET_RECORDING_BY_ID';
  id: string;
}

export interface GetRecordingByIdResponse {
  success: boolean;
  recording?: import('./types').Recording;
  error?: string;
}
