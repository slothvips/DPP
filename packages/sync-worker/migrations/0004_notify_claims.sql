-- 构建通知的纸条、接收对象起始时间和通用游标。
-- Worker 只存哈希、构建号、接收对象 id 和 client id。
CREATE TABLE IF NOT EXISTS notify_claims (
  claim_key TEXT PRIMARY KEY,
  owner_client_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('leased', 'sent')),
  lease_until INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS notify_target_since (
  scope TEXT NOT NULL,
  target_id TEXT NOT NULL,
  since_ms INTEGER NOT NULL,
  PRIMARY KEY (scope, target_id)
);

CREATE TABLE IF NOT EXISTS kv_entries (
  entry_key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
