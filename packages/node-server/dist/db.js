import Database from 'better-sqlite3';
import { z } from 'zod';

const db = new Database('sync.db');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS operations (
    server_seq INTEGER PRIMARY KEY AUTOINCREMENT,
    client_op_id TEXT NOT NULL UNIQUE,
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
export const OperationSchema = z.object({
  id: z.string(),
  table: z.string(),
  type: z.enum(['create', 'update', 'delete']),
  key: z.unknown(),
  keyHash: z.string().optional(),
  payload: z.unknown().optional(),
  timestamp: z.number(),
  serverTimestamp: z.number().optional(),
});
export const dbOps = {
  push: (ops) => {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO operations (client_op_id, table_name, type, key, key_hash, payload, timestamp, server_timestamp)
      VALUES (@id, @table, @type, @key, @keyHash, @payload, @timestamp, @serverTimestamp)
    `);
    let lastSeq = 0;
    const insertMany = db.transaction((operations) => {
      for (const op of operations) {
        const result = insert.run({
          id: op.id,
          table: op.table,
          type: op.type,
          key: JSON.stringify(op.key),
          keyHash: op.keyHash || null,
          payload: op.payload ? JSON.stringify(op.payload) : null,
          timestamp: op.timestamp,
          serverTimestamp: op.serverTimestamp || Date.now(),
        });
        if (result.lastInsertRowid) {
          lastSeq = Number(result.lastInsertRowid);
        }
      }
    });
    insertMany(ops);
    // 如果没有插入任何行（全部重复），返回当前最大 seq
    if (lastSeq === 0) {
      const maxSeq = db.prepare('SELECT MAX(server_seq) as seq FROM operations').get();
      return maxSeq.seq || 0;
    }
    return lastSeq;
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
      table: row.table_name,
      type: row.type,
      key: JSON.parse(row.key),
      keyHash: row.key_hash || undefined,
      payload: row.payload ? JSON.parse(row.payload) : undefined,
      timestamp: row.timestamp,
      serverTimestamp: row.server_timestamp,
    }));
    const nextCursor = rows.length > 0 ? rows[rows.length - 1].server_seq : cursor;
    return { ops, nextCursor };
  },
  countPending: (cursor) => {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM operations
      WHERE server_seq > ?
    `);
    const result = stmt.get([cursor]);
    return result.count;
  },
};
