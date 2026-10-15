-- 兼容已执行过 0002 但尚未包含去重索引的环境；新建库由 0002 创建后此处为 no-op。
CREATE UNIQUE INDEX IF NOT EXISTS idx_stats_dedup ON stats_events (instance_id, client_ts, module, action);
