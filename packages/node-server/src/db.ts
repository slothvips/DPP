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
  clientId: z.string().optional(),
  table: z.string(),
  type: z.enum(['create', 'update', 'delete']),
  key: z.unknown(),
  payload: z.unknown().optional(),
  timestamp: z.number(),
  synced: z.number().optional(),
});

export type SyncOperation = z.infer<typeof OperationSchema>;

interface DbRow {
  server_seq: number;
  client_op_id: string;
  client_id: string | null;
  table_name: string;
  type: 'create' | 'update' | 'delete';
  key: string;
  payload: string | null;
  timestamp: number;
  server_timestamp: number;
}

export const dbOps = {
  push: (ops: SyncOperation[], clientId?: string) => {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO operations (client_op_id, client_id, table_name, type, key, payload, timestamp)
      VALUES (@id, @clientId, @table, @type, @key, @payload, @timestamp)
    `);

    const insertMany = db.transaction((operations: SyncOperation[]) => {
      for (const op of operations) {
        insert.run({
          id: op.id,
          clientId: op.clientId || clientId || null,
          table: op.table,
          type: op.type,
          key: JSON.stringify(op.key),
          payload: op.payload ? JSON.stringify(op.payload) : null,
          timestamp: op.timestamp,
        });
      }
    });

    insertMany(ops);
  },

  pull: (cursor: number, excludeClientId?: string, limit = 1000) => {
    let rows: DbRow[];

    if (excludeClientId) {
      const stmt = db.prepare(`
        SELECT * FROM operations
        WHERE server_seq > ?
          AND (client_id IS NULL OR client_id != ?)
        ORDER BY server_seq ASC
        LIMIT ?
      `);
      rows = stmt.all([cursor, excludeClientId, limit]) as DbRow[];
    } else {
      const stmt = db.prepare(`
        SELECT * FROM operations
        WHERE server_seq > ?
        ORDER BY server_seq ASC
        LIMIT ?
      `);
      rows = stmt.all([cursor, limit]) as DbRow[];
    }

    return rows.map((row) => ({
      server_seq: row.server_seq,
      id: row.client_op_id,
      clientId: row.client_id,
      table: row.table_name,
      type: row.type,
      key: JSON.parse(row.key),
      payload: row.payload ? JSON.parse(row.payload) : undefined,
      timestamp: row.timestamp,
      serverTimestamp: row.server_timestamp,
      synced: 1,
    }));
  },

  countPending: (cursor: number, excludeClientId?: string): number => {
    let result: { count: number };

    if (excludeClientId) {
      const stmt = db.prepare(`
        SELECT COUNT(*) as count FROM operations
        WHERE server_seq > ?
          AND (client_id IS NULL OR client_id != ?)
      `);
      result = stmt.get([cursor, excludeClientId]) as { count: number };
    } else {
      const stmt = db.prepare(`
        SELECT COUNT(*) as count FROM operations
        WHERE server_seq > ?
      `);
      result = stmt.get([cursor]) as { count: number };
    }

    return result.count;
  },
};
