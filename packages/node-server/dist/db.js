import Database from 'better-sqlite3';
import { z } from 'zod';

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
    payload TEXT,
    timestamp INTEGER NOT NULL,
    server_timestamp INTEGER DEFAULT (cast(strftime('%s','now') as int) * 1000 + cast(strftime('%f','now') * 1000 as int) % 1000),
    received_at INTEGER DEFAULT (cast(strftime('%s','now') as int) * 1000)
  );

  CREATE INDEX IF NOT EXISTS idx_ops_seq ON operations(server_seq);
  CREATE INDEX IF NOT EXISTS idx_ops_client ON operations(client_id);
`);
export const OperationSchema = z.object({
  id: z.string(),
  table: z.string(),
  type: z.enum(['create', 'update', 'delete']),
  key: z.unknown(),
  payload: z.unknown().optional(),
  timestamp: z.number(),
  synced: z.number().optional(),
});
export const dbOps = {
  push: (ops) => {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO operations (client_op_id, table_name, type, key, payload, timestamp)
      VALUES (@id, @table, @type, @key, @payload, @timestamp)
    `);
    let lastInsertRowId = 0;
    const insertMany = db.transaction((operations) => {
      for (const op of operations) {
        const info = insert.run({
          id: op.id,
          table: op.table,
          type: op.type,
          key: JSON.stringify(op.key),
          payload: op.payload ? JSON.stringify(op.payload) : null,
          timestamp: op.timestamp,
        });
        if (info.changes > 0) {
          lastInsertRowId = info.lastInsertRowid;
        }
      }
    });
    insertMany(ops);
    if (lastInsertRowId === 0) {
      const stmt = db.prepare('SELECT MAX(server_seq) as maxSeq FROM operations');
      const row = stmt.get();
      return row.maxSeq || 0;
    }
    return Number(lastInsertRowId);
  },
  pull: (cursor, limit = 1000) => {
    const stmt = db.prepare(`
      SELECT * FROM operations
      WHERE server_seq > ?
      ORDER BY server_seq ASC
      LIMIT ?
    `);
    const rows = stmt.all([cursor, limit]);
    return rows.map((row) => ({
      server_seq: row.server_seq,
      id: row.client_op_id,
      table: row.table_name,
      type: row.type,
      key: JSON.parse(row.key),
      payload: row.payload ? JSON.parse(row.payload) : undefined,
      timestamp: row.timestamp,
      serverTimestamp: row.server_timestamp,
      synced: 1,
    }));
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
