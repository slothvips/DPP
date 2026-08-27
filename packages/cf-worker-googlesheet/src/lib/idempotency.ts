export interface SyncChunkValidationOperation {
  id: string;
  clientId?: string;
  table: string;
  type: string;
  key: string;
  keyHash?: string;
  payload: unknown;
}

export function validateSyncChunkOperation(operation: SyncChunkValidationOperation): string | null {
  if (operation.table !== '__sync_chunk__') return null;
  if (typeof operation.payload !== 'object' || operation.payload === null) {
    return 'Sync chunk payload must be an object';
  }
  const payload = operation.payload as Record<string, unknown>;
  if (
    payload.kind !== 'chunk-v1' ||
    typeof payload.operationId !== 'string' ||
    payload.operationId.length === 0 ||
    payload.operationId.length > 256 ||
    typeof payload.chunkIndex !== 'number' ||
    !Number.isSafeInteger(payload.chunkIndex) ||
    typeof payload.chunkTotal !== 'number' ||
    !Number.isSafeInteger(payload.chunkTotal) ||
    typeof payload.iv !== 'string' ||
    typeof payload.ciphertext !== 'string' ||
    typeof payload.ciphertextHash !== 'string' ||
    typeof payload.clientId !== 'string'
  ) {
    return 'Invalid sync chunk payload';
  }
  if (
    payload.clientId.length === 0 ||
    payload.clientId.length > 256 ||
    payload.iv.length > 3000 ||
    payload.ciphertext.length > 3000 ||
    payload.ciphertextHash.length > 3000
  ) {
    return 'Invalid sync chunk payload';
  }
  if (
    operation.type !== 'create' ||
    payload.operationId !== operation.key ||
    payload.chunkTotal < 1 ||
    payload.chunkTotal > 10000 ||
    payload.chunkIndex < 0 ||
    payload.chunkIndex >= payload.chunkTotal ||
    operation.id !== `${payload.operationId}:chunk:${payload.chunkIndex}` ||
    payload.clientId !== operation.clientId ||
    typeof operation.keyHash !== 'string' ||
    operation.keyHash.length === 0
  ) {
    return 'Invalid sync chunk metadata';
  }
  if (JSON.stringify(payload).length > 3000) return 'Sync chunk payload is too large';
  return null;
}

export function getOperationIdempotencyKey(
  operation: { id: string; clientId?: string },
  requestClientId?: string
): string {
  const clientId = operation.clientId || requestClientId || 'legacy';
  return `sync:op:${clientId}:${operation.id}`;
}

export function fingerprintOperation(operation: object & { serverTimestamp?: number }): string {
  const copy = { ...operation };
  delete copy.serverTimestamp;
  return JSON.stringify(copy);
}
