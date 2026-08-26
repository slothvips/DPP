import Database from 'better-sqlite3';

export { OperationSchema } from './protocol.js';
const db = new Database('sync.db');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS operations (
    server_seq INTEGER PRIMARY KEY AUTOINCREMENT,
    client_op_id TEXT NOT NULL UNIQUE,
    client_id TEXT,
    table_name TEXT NOT NULL,
    type TEXT NOT NULL,
    key TEXT,
    key_hash TEXT,
    payload TEXT,
    timestamp INTEGER NOT NULL,
    server_timestamp INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_ops_seq ON operations(server_seq);
`);
const operationColumns = db.prepare('PRAGMA table_info(operations)').all();
if (!operationColumns.some((column) => column.name === 'client_id')) {
  db.exec('ALTER TABLE operations ADD COLUMN client_id TEXT');
}
export class SyncConflictError extends Error {
  constructor(operationId) {
    super(`Operation ${operationId} already exists with different content`);
    this.name = 'SyncConflictError';
  }
}
function normalizeChunkPayload(payload, clientId) {
  if (!clientId || typeof payload !== 'object' || payload === null || payload.kind !== 'chunk-v1') {
    return payload;
  }
  return { ...payload, clientId };
}
function serializePayload(payload, clientId) {
  return payload === undefined ? null : JSON.stringify(normalizeChunkPayload(payload, clientId));
}
function serializeOperation(op) {
  return {
    clientId: op.clientId ?? null,
    table: op.table,
    type: op.type,
    key: JSON.stringify(op.key),
    keyHash: op.keyHash ?? null,
    payload: serializePayload(op.payload, op.clientId ?? null),
    timestamp: op.timestamp,
  };
}
function sameStoredOperation(row, op) {
  const serialized = serializeOperation(op);
  const storedPayload = row.payload === null ? undefined : JSON.parse(row.payload);
  return (
    row.table_name === serialized.table &&
    row.type === serialized.type &&
    row.key === serialized.key &&
    row.key_hash === serialized.keyHash &&
    serializePayload(storedPayload, serialized.clientId) === serialized.payload &&
    row.timestamp === serialized.timestamp
  );
}
export const dbOps = {
  push: (ops) => {
    const insert = db.prepare(`
      INSERT INTO operations (client_op_id, client_id, table_name, type, key, key_hash, payload, timestamp, server_timestamp)
      VALUES (@id, @clientId, @table, @type, @key, @keyHash, @payload, @timestamp, @serverTimestamp)
    `);
    const findById = db.prepare('SELECT * FROM operations WHERE client_op_id = ?');
    let lastSeq = 0;
    const pushedIds = [];
    const insertMany = db.transaction((operations) => {
      for (const op of operations) {
        const existing = findById.get(op.id);
        if (existing) {
          if (!sameStoredOperation(existing, op)) {
            throw new SyncConflictError(op.id);
          }
          pushedIds.push(op.id);
          continue;
        }
        const result = insert.run({
          id: op.id,
          ...serializeOperation(op),
          serverTimestamp: op.serverTimestamp ?? Date.now(),
        });
        if (result.lastInsertRowid) {
          lastSeq = Number(result.lastInsertRowid);
          pushedIds.push(op.id);
        }
      }
    });
    insertMany(ops);
    if (lastSeq === 0) {
      const maxSeq = db.prepare('SELECT MAX(server_seq) as seq FROM operations').get();
      return { cursor: maxSeq.seq || 0, pushedIds };
    }
    return { cursor: lastSeq, pushedIds };
  },
  pull: (cursor, limit = 100) => {
    const stmt = db.prepare(`
      SELECT * FROM operations
      WHERE server_seq > ?
      ORDER BY server_seq ASC
      LIMIT ?
    `);
    const rows = stmt.all([cursor, limit]);
    const ops = rows.map((row) => ({
      id: row.client_op_id,
      clientId: row.client_id || undefined,
      table: row.table_name,
      type: row.type,
      key: row.key === null ? undefined : JSON.parse(row.key),
      keyHash: row.key_hash || undefined,
      payload: row.payload ? JSON.parse(row.payload) : undefined,
      timestamp: row.timestamp,
      serverTimestamp: row.server_timestamp,
    }));
    const nextCursor = rows.length > 0 ? rows[rows.length - 1].server_seq : cursor;
    return { ops, nextCursor };
  },
  countPending: (cursor, clientId) => {
    const stmt = clientId
      ? db.prepare(`
          SELECT COUNT(*) as count FROM operations
          WHERE server_seq > ? AND (client_id IS NULL OR client_id != ?)
        `)
      : db.prepare(`
          SELECT COUNT(*) as count FROM operations
          WHERE server_seq > ?
        `);
    const result = clientId ? stmt.get(cursor, clientId) : stmt.get(cursor);
    return result.count;
  },
};
