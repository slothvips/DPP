import { validateSyncChunkOperation } from './idempotency.ts';

export interface SyncOperation {
  id: string;
  clientId?: string;
  table: string;
  type: string;
  key?: unknown;
  payload: unknown;
  timestamp: number;
  serverTimestamp?: number;
  keyHash?: string;
}

export interface HistoricalOperation {
  serverSeq: number;
  operation: SyncOperation;
}

export interface PushResult {
  success: true;
  cursor: number;
  pushedIds: string[];
}

export interface HistoricalImportResult {
  inserted: number;
  duplicates: number;
  conflicts: number;
  maxCursor: number;
}

export interface D1Stats {
  count: number;
  minCursor: number;
  maxCursor: number;
  payloadBytes: number;
}

interface StoredOperationRow {
  server_seq: number;
  client_op_id: string;
  client_id: string;
  table_name: string;
  operation_type: string;
  key_json: string | null;
  key_hash: string | null;
  payload_json: string;
  client_timestamp: number;
  server_timestamp: number;
  fingerprint: string;
}

interface ExistingOperationRow {
  server_seq: number;
  client_op_id: string;
  client_id: string;
  fingerprint: string;
}

interface SerializedOperation {
  operation: SyncOperation;
  clientId: string;
  keyJson: string | null;
  payloadJson: string;
  fingerprint: string;
}

export class SyncConflictError extends Error {
  constructor(operationId: string) {
    super(`Operation ${operationId} already exists with different content`);
    this.name = 'SyncConflictError';
  }
}

export class SyncValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncValidationError';
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)])
  );
}

function stringifyOptional(value: unknown): string | null {
  if (value === undefined) return null;
  return JSON.stringify(value) ?? null;
}

function normalizeClientIdentity(operation: SyncOperation, clientId: string): SyncOperation {
  if (
    operation.table !== '__sync_chunk__' ||
    typeof operation.payload !== 'object' ||
    operation.payload === null
  ) {
    return { ...operation, clientId };
  }

  return {
    ...operation,
    clientId,
    payload: { ...(operation.payload as Record<string, unknown>), clientId },
  };
}

function validateOperation(operation: SyncOperation, allowHistoricalPayload = false): void {
  if (!operation.id || typeof operation.id !== 'string') {
    throw new SyncValidationError('Operation id is required');
  }
  if (operation.table !== 'encrypted' && operation.table !== '__sync_chunk__') {
    throw new SyncValidationError(`${operation.id}: Unencrypted sync operation rejected`);
  }
  if (!Number.isSafeInteger(operation.timestamp) || operation.timestamp < 0) {
    throw new SyncValidationError(`${operation.id}: Invalid timestamp`);
  }
  if (
    operation.serverTimestamp !== undefined &&
    (!Number.isSafeInteger(operation.serverTimestamp) || operation.serverTimestamp < 0)
  ) {
    throw new SyncValidationError(`${operation.id}: Invalid server timestamp`);
  }
  if (
    operation.table === 'encrypted' &&
    (operation.type !== 'create' ||
      typeof operation.payload !== 'object' ||
      operation.payload === null ||
      typeof (operation.payload as { iv?: unknown }).iv !== 'string' ||
      typeof (operation.payload as { ciphertext?: unknown }).ciphertext !== 'string' ||
      (!allowHistoricalPayload &&
        ((operation.payload as { iv: string }).iv.length > 3000 ||
          (operation.payload as { ciphertext: string }).ciphertext.length > 3000)))
  ) {
    throw new SyncValidationError(`${operation.id}: Invalid encrypted operation`);
  }
  const chunkError = validateSyncChunkOperation(operation);
  if (chunkError) throw new SyncValidationError(`${operation.id}: ${chunkError}`);
}

function serializeOperation(
  operation: SyncOperation,
  requestClientId?: string,
  allowHistoricalPayload = false
): SerializedOperation {
  if (typeof operation !== 'object' || operation === null) {
    throw new SyncValidationError('Invalid operation');
  }
  const clientId = requestClientId || operation.clientId || 'legacy';
  if (typeof clientId !== 'string' || clientId.length === 0 || clientId.length > 256) {
    throw new SyncValidationError(`${operation.id || 'Operation'}: Invalid clientId`);
  }
  const normalized = normalizeClientIdentity(operation, clientId);
  validateOperation(normalized, allowHistoricalPayload);
  const payloadJson = JSON.stringify(normalized.payload);
  if (payloadJson === undefined) {
    throw new SyncValidationError(`${normalized.id}: Invalid payload`);
  }

  const fingerprint = JSON.stringify(
    stableValue({
      id: normalized.id,
      clientId,
      table: normalized.table,
      type: normalized.type,
      key: normalized.key,
      payload: normalized.payload,
      timestamp: normalized.timestamp,
      keyHash: normalized.keyHash,
    })
  );

  return {
    operation: normalized,
    clientId,
    keyJson: stringifyOptional(normalized.key),
    payloadJson,
    fingerprint,
  };
}

function operationKey(operation: SerializedOperation): string {
  return JSON.stringify([operation.clientId, operation.operation.id]);
}

function rowToOperation(row: StoredOperationRow): SyncOperation {
  return {
    id: row.client_op_id,
    clientId: row.client_id,
    table: row.table_name,
    type: row.operation_type,
    key: row.key_json === null ? undefined : JSON.parse(row.key_json),
    keyHash: row.key_hash ?? undefined,
    payload: JSON.parse(row.payload_json),
    timestamp: row.client_timestamp,
    serverTimestamp: row.server_timestamp,
  };
}

export class D1SyncStore {
  private readonly db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async push(operations: SyncOperation[], requestClientId?: string): Promise<PushResult> {
    if (operations.length > 50) {
      throw new SyncValidationError('Push batch exceeds the maximum size of 50 operations');
    }

    const unique = new Map<string, SerializedOperation>();
    for (const operation of operations) {
      const serialized = serializeOperation(operation, requestClientId || 'legacy');
      const key = operationKey(serialized);
      const previous = unique.get(key);
      if (previous && previous.fingerprint !== serialized.fingerprint) {
        throw new SyncConflictError(operation.id);
      }
      unique.set(key, serialized);
    }

    const candidates = [...unique.values()];
    const existing = await this.findExisting(candidates);
    const pending = candidates.filter((operation) => {
      const row = existing.get(operationKey(operation));
      if (!row) return true;
      if (row.fingerprint !== operation.fingerprint) {
        throw new SyncConflictError(operation.operation.id);
      }
      return false;
    });

    const serverTimestamp = Date.now();
    const insertedCursor = await this.insert(pending, (operation) => ({
      serverSeq: undefined,
      serverTimestamp: operation.operation.serverTimestamp ?? serverTimestamp,
    }));
    const existingCursor = Math.max(0, ...[...existing.values()].map((row) => row.server_seq));

    return {
      success: true,
      cursor: Math.max(existingCursor, insertedCursor),
      pushedIds: operations.map((operation) => operation.id),
    };
  }

  async pull(cursor: number, limit: number): Promise<{ ops: SyncOperation[]; cursor: number }> {
    const result = await this.db
      .prepare(
        `SELECT server_seq, client_op_id, client_id, table_name, operation_type,
                key_json, key_hash, payload_json, client_timestamp, server_timestamp, fingerprint
         FROM operations
         WHERE server_seq > ?
         ORDER BY server_seq ASC
         LIMIT ?`
      )
      .bind(cursor, limit)
      .all<StoredOperationRow>();
    const rows = result.results ?? [];
    return {
      ops: rows.map(rowToOperation),
      cursor: rows.length > 0 ? rows[rows.length - 1].server_seq : cursor,
    };
  }

  async countPending(cursor: number, clientId?: string): Promise<number> {
    const statement = clientId
      ? this.db
          .prepare(
            'SELECT COUNT(*) AS count FROM operations WHERE server_seq > ? AND client_id != ?'
          )
          .bind(cursor, clientId)
      : this.db
          .prepare('SELECT COUNT(*) AS count FROM operations WHERE server_seq > ?')
          .bind(cursor);
    const row = await statement.first<{ count: number }>();
    return Number(row?.count ?? 0);
  }

  async importHistorical(records: HistoricalOperation[]): Promise<HistoricalImportResult> {
    if (records.length > 50) {
      throw new SyncValidationError('Migration batch exceeds the maximum size of 50 operations');
    }
    if (records.length === 0) {
      const { maxCursor } = await this.stats();
      return { inserted: 0, duplicates: 0, conflicts: 0, maxCursor };
    }

    const unique = new Map<string, { serialized: SerializedOperation; serverSeq: number }>();
    let duplicates = 0;
    for (const record of records) {
      if (!Number.isSafeInteger(record.serverSeq) || record.serverSeq < 2) {
        throw new SyncValidationError(`Invalid historical cursor ${record.serverSeq}`);
      }
      const serialized = serializeOperation(record.operation, undefined, true);
      const key = operationKey(serialized);
      const previous = unique.get(key);
      if (previous) {
        if (previous.serialized.fingerprint !== serialized.fingerprint) {
          throw new SyncConflictError(record.operation.id);
        }
        duplicates++;
        continue;
      }
      unique.set(key, { serialized, serverSeq: record.serverSeq });
    }

    const candidates = [...unique.values()];
    const existing = await this.findExisting(candidates.map(({ serialized }) => serialized));
    const occupied = await this.findByServerSeq(candidates.map(({ serverSeq }) => serverSeq));
    const pending = candidates.filter(({ serialized, serverSeq }) => {
      const row = existing.get(operationKey(serialized));
      if (row) {
        if (row.fingerprint !== serialized.fingerprint) {
          throw new SyncConflictError(serialized.operation.id);
        }
        duplicates++;
        return false;
      }
      const cursorRow = occupied.get(serverSeq);
      if (cursorRow) throw new SyncConflictError(cursorRow.client_op_id);
      return true;
    });

    const insertedCursor = await this.insert(
      pending.map(({ serialized }) => serialized),
      (operation) => {
        const record = pending.find((candidate) => candidate.serialized === operation);
        if (!record) throw new Error('Missing historical operation cursor');
        return {
          serverSeq: record.serverSeq,
          serverTimestamp: operation.operation.serverTimestamp ?? operation.operation.timestamp,
        };
      }
    );
    const maxExisting = Math.max(0, ...[...existing.values()].map((row) => row.server_seq));

    return {
      inserted: pending.length,
      duplicates,
      conflicts: 0,
      maxCursor: Math.max(insertedCursor, maxExisting),
    };
  }

  async stats(): Promise<D1Stats> {
    const row = await this.db
      .prepare(
        `SELECT COUNT(*) AS count, COALESCE(MIN(server_seq), 0) AS minCursor,
                COALESCE(MAX(server_seq), 0) AS maxCursor,
                COALESCE(SUM(LENGTH(payload_json)), 0) AS payloadBytes
         FROM operations`
      )
      .first<D1Stats>();
    return {
      count: Number(row?.count ?? 0),
      minCursor: Number(row?.minCursor ?? 0),
      maxCursor: Number(row?.maxCursor ?? 0),
      payloadBytes: Number(row?.payloadBytes ?? 0),
    };
  }

  private async findExisting(
    operations: SerializedOperation[]
  ): Promise<Map<string, ExistingOperationRow>> {
    if (operations.length === 0) return new Map();
    const where = operations.map(() => '(client_id = ? AND client_op_id = ?)').join(' OR ');
    const bindings = operations.flatMap((operation) => [
      operation.clientId,
      operation.operation.id,
    ]);
    const result = await this.db
      .prepare(
        `SELECT server_seq, client_op_id, client_id, fingerprint FROM operations WHERE ${where}`
      )
      .bind(...bindings)
      .all<ExistingOperationRow>();
    return new Map(
      (result.results ?? []).map((row) => [JSON.stringify([row.client_id, row.client_op_id]), row])
    );
  }

  private async findByServerSeq(cursors: number[]): Promise<Map<number, ExistingOperationRow>> {
    if (cursors.length === 0) return new Map();
    const result = await this.db
      .prepare(
        `SELECT server_seq, client_op_id, client_id, fingerprint
         FROM operations WHERE server_seq IN (${cursors.map(() => '?').join(', ')})`
      )
      .bind(...cursors)
      .all<ExistingOperationRow>();
    return new Map((result.results ?? []).map((row) => [row.server_seq, row]));
  }

  private async insert(
    operations: SerializedOperation[],
    metadata: (operation: SerializedOperation) => {
      serverSeq: number | undefined;
      serverTimestamp: number;
    }
  ): Promise<number> {
    if (operations.length === 0) return 0;
    const statements = operations.map((serialized) => {
      const { operation, clientId, keyJson, payloadJson, fingerprint } = serialized;
      const { serverSeq, serverTimestamp } = metadata(serialized);
      return this.db
        .prepare(
          `INSERT INTO operations
             (server_seq, client_op_id, client_id, table_name, operation_type, key_json,
              key_hash, payload_json, client_timestamp, server_timestamp, fingerprint)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          serverSeq ?? null,
          operation.id,
          clientId,
          operation.table,
          operation.type,
          keyJson,
          operation.keyHash ?? null,
          payloadJson,
          operation.timestamp,
          serverTimestamp,
          fingerprint
        );
    });
    const results = await this.db.batch(statements);
    return Math.max(0, ...results.map((result) => Number(result.meta.last_row_id ?? 0)));
  }
}
