export interface DebugOperation {
  id: string;
  table: string;
  type: string;
  payload: unknown;
  timestamp: number;
}

export type DebugOperationStatus = 'success' | 'plain' | 'error';

export interface DecryptedDebugOperation extends DebugOperation {
  decryptedPayload?: unknown;
  error?: string;
  status: DebugOperationStatus;
}
