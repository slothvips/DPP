import type { EncryptedData } from '@/lib/crypto/encryption';

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
  serverTimestamp?: number; // 服务端存储时间戳（仅用于元数据，冲突解决使用本地 timestamp）
  synced: number;
  keyHash?: string; // SHA-256 hash of the key used for encryption (first 8 bytes hex)
  /** 本地待上传缓存，成功上传后清理，不会发送到服务端。 */
  encryptedPayload?: EncryptedData;
}

export interface SyncMetadata {
  id: string;
  lastServerCursor?: string | number;
  lastSyncTimestamp: number;
  syncProtocolVersion?: number;
  chunkRecoveryCursor?: string | number;
  chunkRecoveryCompleted?: boolean;
}

export interface SyncPendingCounts {
  push: number;
  pull: number;
}

export interface SyncPushResult {
  cursor?: number | string;
  /** 实际上传成功的 op id；被跳过（如缺个人私钥）的不在此列 */
  pushedIds: string[];
}

export interface SyncProvider {
  push(ops: SyncOperation[], clientId: string): Promise<SyncPushResult>;
  pull(
    cursor?: string | number,
    clientId?: string
  ): Promise<{ ops: SyncOperation[]; nextCursor: string | number }>;
  getPendingCount?(cursor?: string | number, clientId?: string): Promise<number>;
}
