export interface Recording {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  createdAt: number;
  duration: number;
  eventsCount: number;
  fileSize: number;
  events: unknown[];
}

export interface RecordingState {
  isRecording: boolean;
  startTime?: number;
  tabId?: number;
}
