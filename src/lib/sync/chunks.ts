import type { EncryptedData } from '@/lib/crypto/encryption';
import type { SyncOperation } from './types';

export const SYNC_CHUNK_TABLE = '__sync_chunk__';
export const MAX_SHEET_CELL_CHARS = 3000;
export const MAX_CHUNK_CIPHERTEXT_CHARS = 2000;
export const MAX_CHUNK_TOTAL = 10_000;
export const MAX_PUSH_REQUEST_BYTES = 64 * 1024;
export const DEFAULT_CHUNK_UPLOAD_ENABLED = true;

export interface SyncChunkPayload {
  kind: 'chunk-v1';
  operationId: string;
  chunkIndex: number;
  chunkTotal: number;
  iv: string;
  ciphertext: string;
  ciphertextHash: string;
  clientId: string;
}

export interface SyncChunkRecord extends SyncChunkPayload {
  id: string;
  keyHash?: string;
  timestamp: number;
  receivedAt: number;
}

export interface ChunkLimits {
  maxCellChars?: number;
  maxChunkCiphertextChars?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseSyncChunkPayload(value: unknown): SyncChunkPayload | null {
  if (!isRecord(value)) return null;
  if (
    value.kind !== 'chunk-v1' ||
    typeof value.operationId !== 'string' ||
    !Number.isSafeInteger(value.chunkIndex) ||
    !Number.isSafeInteger(value.chunkTotal) ||
    typeof value.iv !== 'string' ||
    typeof value.ciphertext !== 'string' ||
    typeof value.ciphertextHash !== 'string' ||
    typeof value.clientId !== 'string'
  ) {
    return null;
  }

  const chunkIndex = value.chunkIndex as number;
  const chunkTotal = value.chunkTotal as number;

  if (
    chunkTotal < 1 ||
    chunkTotal > MAX_CHUNK_TOTAL ||
    chunkIndex < 0 ||
    chunkIndex >= chunkTotal ||
    value.operationId.length === 0 ||
    value.clientId.length === 0
  ) {
    return null;
  }
  if (
    value.operationId.length > 256 ||
    value.clientId.length > 256 ||
    value.iv.length > MAX_SHEET_CELL_CHARS ||
    value.ciphertext.length > MAX_SHEET_CELL_CHARS ||
    value.ciphertextHash.length > MAX_SHEET_CELL_CHARS
  ) {
    return null;
  }

  return value as unknown as SyncChunkPayload;
}

export function isSyncChunkOperation(
  operation: SyncOperation
): operation is SyncOperation & { payload: SyncChunkPayload } {
  return operation.table === SYNC_CHUNK_TABLE && parseSyncChunkPayload(operation.payload) !== null;
}

async function hashCiphertext(ciphertext: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ciphertext));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function chunkPayloadSize(payload: SyncChunkPayload): number {
  return JSON.stringify(payload).length;
}

function createPayloads(
  operation: SyncOperation,
  encrypted: EncryptedData,
  clientId: string,
  ciphertextHash: string,
  chunkSize: number
): SyncChunkPayload[] {
  const chunkTotal = Math.ceil(encrypted.ciphertext.length / chunkSize);
  return Array.from({ length: chunkTotal }, (_, chunkIndex) => ({
    kind: 'chunk-v1' as const,
    operationId: operation.id,
    chunkIndex,
    chunkTotal,
    iv: encrypted.iv,
    ciphertext: encrypted.ciphertext.slice(chunkIndex * chunkSize, (chunkIndex + 1) * chunkSize),
    ciphertextHash,
    clientId,
  }));
}

export async function createChunkOperations(
  operation: SyncOperation,
  clientId: string,
  limits: ChunkLimits = {}
): Promise<SyncOperation[]> {
  const encrypted = operation.encryptedPayload ?? (operation.payload as EncryptedData);
  if (!encrypted?.ciphertext || !encrypted.iv) {
    throw new Error(`Operation ${operation.id} has no encrypted payload`);
  }

  const maxCellChars = limits.maxCellChars ?? MAX_SHEET_CELL_CHARS;
  const maxChunkCiphertextChars = limits.maxChunkCiphertextChars ?? MAX_CHUNK_CIPHERTEXT_CHARS;

  if (JSON.stringify(encrypted).length <= maxCellChars) {
    return [operation];
  }

  const ciphertextHash = await hashCiphertext(encrypted.ciphertext);
  let chunkSize = Math.min(maxChunkCiphertextChars, encrypted.ciphertext.length);

  while (chunkSize > 0) {
    const payloads = createPayloads(operation, encrypted, clientId, ciphertextHash, chunkSize);
    if (payloads.every((payload) => chunkPayloadSize(payload) <= maxCellChars)) {
      return payloads.map((payload) => ({
        id: `${operation.id}:chunk:${payload.chunkIndex}`,
        clientId,
        table: SYNC_CHUNK_TABLE,
        type: 'create',
        key: operation.id,
        keyHash: operation.keyHash,
        timestamp: operation.timestamp,
        payload,
        synced: 1,
      }));
    }

    chunkSize = Math.floor(chunkSize * 0.8);
  }

  throw new Error(`Unable to fit sync chunks for operation ${operation.id}`);
}

export function toSyncChunkRecord(
  operation: SyncOperation,
  receivedAt = Date.now()
): SyncChunkRecord | null {
  const payload = parseSyncChunkPayload(operation.payload);
  if (!payload) return null;
  if (
    operation.id !== `${payload.operationId}:chunk:${payload.chunkIndex}` ||
    operation.key !== payload.operationId ||
    (operation.clientId !== undefined && operation.clientId !== payload.clientId)
  ) {
    return null;
  }
  return {
    id: operation.id,
    keyHash: operation.keyHash,
    timestamp: operation.timestamp,
    receivedAt,
    ...payload,
  };
}

function sameChunkContent(left: SyncChunkRecord, right: SyncChunkRecord): boolean {
  return (
    left.operationId === right.operationId &&
    left.chunkIndex === right.chunkIndex &&
    left.chunkTotal === right.chunkTotal &&
    left.iv === right.iv &&
    left.ciphertext === right.ciphertext &&
    left.ciphertextHash === right.ciphertextHash &&
    left.clientId === right.clientId &&
    left.keyHash === right.keyHash &&
    left.timestamp === right.timestamp
  );
}

export async function reassembleChunkGroup(
  records: SyncChunkRecord[]
): Promise<{ operation: SyncOperation; records: SyncChunkRecord[] } | null> {
  if (records.length === 0) return null;
  const first = records[0];
  const uniqueIndexes = new Set<number>();
  for (const record of records) {
    if (
      record.operationId !== first.operationId ||
      record.chunkTotal !== first.chunkTotal ||
      record.iv !== first.iv ||
      record.keyHash !== first.keyHash ||
      record.ciphertextHash !== first.ciphertextHash ||
      record.clientId !== first.clientId ||
      record.timestamp !== first.timestamp ||
      record.id !== `${record.operationId}:chunk:${record.chunkIndex}`
    ) {
      return null;
    }
    uniqueIndexes.add(record.chunkIndex);
  }

  if (
    records.length !== first.chunkTotal ||
    uniqueIndexes.size !== first.chunkTotal ||
    !Array.from({ length: first.chunkTotal }, (_, index) => index).every((index) =>
      uniqueIndexes.has(index)
    )
  ) {
    return null;
  }

  const ordered = [...records].sort((left, right) => left.chunkIndex - right.chunkIndex);
  const ciphertext = ordered.map((record) => record.ciphertext).join('');
  if ((await hashCiphertext(ciphertext)) !== first.ciphertextHash) {
    return null;
  }

  return {
    operation: {
      id: first.operationId,
      clientId: first.clientId,
      table: 'encrypted',
      type: 'create',
      key: first.operationId,
      keyHash: first.keyHash,
      timestamp: first.timestamp,
      payload: { iv: first.iv, ciphertext },
      synced: 1,
    },
    records: ordered,
  };
}

export function mergeChunkRecords(
  existing: SyncChunkRecord[],
  incoming: SyncChunkRecord[]
): { records: SyncChunkRecord[]; conflicts: SyncChunkRecord[] } {
  const byId = new Map(existing.map((record) => [record.id, record]));
  const conflicts: SyncChunkRecord[] = [];
  for (const record of incoming) {
    const current = byId.get(record.id);
    if (!current) {
      byId.set(record.id, record);
    } else if (!sameChunkContent(current, record)) {
      conflicts.push(record);
    }
  }
  return { records: Array.from(byId.values()), conflicts };
}
