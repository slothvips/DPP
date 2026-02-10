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
  keyHash?: string; // SHA-256 hash of the key used for encryption (first 8 bytes hex)
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
