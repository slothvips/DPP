import type { SyncMetadata, SyncOperation } from '@/lib/sync/types';

export interface DeferredOp {
  id?: number;
  table: string;
  op: SyncOperation;
  timestamp: number;
  receivedAt: number;
}

export interface RemoteActivityLog {
  id: string;
  clientId: string;
  table: string;
  type: 'create' | 'update' | 'delete';
  timestamp: number;
  payload?: unknown;
  receivedAt: number;
}

export type { SyncMetadata, SyncOperation };
