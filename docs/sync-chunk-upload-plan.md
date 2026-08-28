# 同步大内容分片上传设计（已归档）

本草案已被 `docs/sync-chunk-upload-plan-v2.md` 取代，不再代表当前实现。

当前实现使用单一同步日志、单一 cursor 和 `__sync_chunk__` 记录，由 Cloudflare Worker + D1 持久化。请以 v2 方案和实际代码为准。
