CREATE TABLE operations (
  server_seq INTEGER PRIMARY KEY AUTOINCREMENT,
  client_op_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  table_name TEXT NOT NULL CHECK (table_name IN ('encrypted', '__sync_chunk__')),
  operation_type TEXT NOT NULL CHECK (operation_type = 'create'),
  key_json TEXT,
  key_hash TEXT,
  payload_json TEXT NOT NULL,
  client_timestamp INTEGER NOT NULL,
  server_timestamp INTEGER NOT NULL,
  fingerprint TEXT NOT NULL,
  UNIQUE (client_id, client_op_id)
);
