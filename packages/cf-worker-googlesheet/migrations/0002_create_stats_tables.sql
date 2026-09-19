CREATE TABLE stats_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id TEXT NOT NULL,
  ext_version TEXT,
  browser TEXT,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  value REAL,
  meta_json TEXT,
  client_ts INTEGER NOT NULL,
  server_ts INTEGER NOT NULL
);
CREATE INDEX idx_stats_time ON stats_events (server_ts);
CREATE INDEX idx_stats_module ON stats_events (module, action, server_ts);
CREATE INDEX idx_stats_instance ON stats_events (instance_id, server_ts);
CREATE UNIQUE INDEX idx_stats_dedup ON stats_events (instance_id, client_ts, module, action);
