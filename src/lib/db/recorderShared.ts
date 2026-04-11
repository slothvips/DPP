export interface DeleteRecordingResult {
  success: boolean;
  message: string;
}

export interface ClearRecordingsResult {
  success: boolean;
  message: string;
}

export interface UpdateRecordingTitleResult {
  success: boolean;
  message: string;
}

export interface ImportRecordingResult {
  success: boolean;
  id: string;
  message: string;
}

export interface ExportRecordingResult {
  success: boolean;
  data: unknown;
  filename: string;
  message: string;
}
