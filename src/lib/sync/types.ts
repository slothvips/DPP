export type OperationType = 'create' | 'update' | 'delete';
export type SyncStatus = 'idle' | 'pushing' | 'pulling' | 'error';

export interface SyncOperation {
  id: string;
  clientId?: string;
  table: string;
  type: OperationType;
  key: unknown;
  payload?: unknown;
  timestamp: number; // 客户端时间戳（用于本地排序）
  serverTimestamp?: number; // 服务端时间戳（用于冲突解决）
  synced: number;
}

export interface SyncMetadata {
  id: string;
  lastServerCursor?: string | number;
  lastSyncTimestamp: number;
}

export interface SyncPendingCounts {
  push: number;
  pull: number;
}

export interface SyncProvider {
  push(ops: SyncOperation[], clientId: string): Promise<{ cursor?: number | string } | undefined>;
  pull(
    cursor?: string | number,
    clientId?: string
  ): Promise<{ ops: SyncOperation[]; nextCursor: string | number }>;
  getPendingCount?(cursor?: string | number, clientId?: string): Promise<number>;
}

export interface DeferredOperation {
  id?: number; // Auto-incremented
  table: string;
  op: SyncOperation;
  timestamp: number;
  receivedAt: number;
}
