# Google Sheets 到 Cloudflare D1 迁移计划

状态：阶段 A、B、C 已完成；生产 D1 已迁移并切换到 D1-only Worker，阶段 D 等待稳定观察后清理。

本文档是独立的实施说明。目标是在不改变浏览器扩展同步协议、加密边界和已有客户端 cursor 的前提下，用 Cloudflare D1 替换 Google Sheets。生产和测试环境分别使用独立 D1 数据库。

## 1. 目标

- 保持现有接口不变：
  - `POST /api/sync/push`
  - `GET /api/sync/pull`
  - `GET /api/sync/pending`
- 保持 `X-Access-Token`、`X-Client-ID`、请求体和响应结构兼容。
- 服务端继续只保存密文或密文分片，不解密业务数据。
- 完整迁移生产和测试 Google Sheet 的 `Operations` 历史。
- 保留 Google Sheet 物理行号对应的 cursor，已有客户端不重置同步状态。
- 迁移完成后删除 Worker 对 Google API、Service Account 和 Spreadsheet ID 的依赖。
- 使用 Cloudflare Workers 和 D1 免费额度运行。

## 2. 非目标

- 不修改扩展端 `SyncEngine`、加密流程和冲突解决逻辑。
- 不增加新的同步接口或第二个长期 cursor。
- 不取消现有密文分片协议。D1 单行限制更高，但旧客户端和已有历史仍依赖当前协议。
- 不引入 ORM。D1 prepared statements 足够覆盖当前单表追加日志模型。
- 不在本次迁移中增加日志清理或压缩机制。
- 不重命名 `packages/cf-worker-googlesheet`。包名已经是 `dpp-worker`，目录改名只会扩大无关改动。

## 3. 当前架构

```text
业务表变更
-> Dexie operations(synced=0)
-> SyncEngine.push()
-> 客户端整体加密
-> 必要时切分 ciphertext
-> POST /api/sync/push
-> Durable Object 串行化写入
-> Google Sheets Operations
```

拉取使用 Google Sheet 物理行号作为 cursor：

```text
GET /api/sync/pull?cursor=N
-> 从 N 之后读取
-> 返回 ops 和最后一行的物理行号
-> 客户端保存 lastServerCursor
```

Worker 当前还使用 KV 和 Durable Object storage 保存幂等状态。Google Sheet 本身没有唯一约束，因此需要额外协调。

## 4. 目标架构

```text
浏览器扩展
-> /api/sync/push|pull|pending
-> Cloudflare Worker
-> Durable Object 串行化 push
-> D1 operations
```

第一版保留现有 Durable Object，只负责串行化 push，不再保存幂等状态。这样可复用已部署的并发边界，并避免在迁移时重新设计跨请求事务。

D1 负责：

- 自增 server cursor。
- 操作唯一约束。
- fingerprint 冲突检测。
- 增量分页查询。
- pending 数量统计。

最终 Worker 不再依赖 Google API 和 KV。是否移除只用于串行化的 Durable Object，应在 D1 版本稳定后单独评估，不放入本次迁移。

## 5. D1 Schema

新增 `migrations/0001_create_operations.sql`：

```sql
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
```

不额外创建 `server_seq` 索引。`INTEGER PRIMARY KEY` 已使用 SQLite rowid 索引。

`UNIQUE (client_id, client_op_id)` 同时用于幂等查询和约束。当前每个 push 请求中的操作都会被规范为同一个有效 `clientId`，因此查询可以使用：

```sql
SELECT client_op_id, fingerprint, server_seq
FROM operations
WHERE client_id = ? AND client_op_id IN (...);
```

单批客户端操作最多 50 条，连同 `client_id` 不超过 D1 每条查询 100 个绑定参数的限制。

## 6. D1 存储行为

### 6.1 Push

1. 从请求体或 `X-Client-ID` 得到有效 `clientId`，缺失时使用 `legacy`。
2. 将操作及 chunk payload 中的 `clientId` 规范为有效值。
3. 复用现有密文、chunk 元数据和 3,000 字符限制校验。
4. 在请求内部按 `(clientId, operationId)` 检查重复项：
   - fingerprint 相同：只处理一次。
   - fingerprint 不同：返回 `409`。
5. 在 D1 查询已有 fingerprint：
   - 相同：作为幂等重试确认。
   - 不同：返回 `409`，本次不插入任何新行。
6. 将缺失操作用 prepared statements 和 `DB.batch()` 原子写入。
7. 返回所有已确认的原始操作 ID：

```json
{
  "success": true,
  "cursor": 123,
  "pushedIds": ["op-1", "op-2"]
}
```

Durable Object 继续将所有 push 路由到固定实例，避免“查询已有记录”和“批量插入”之间出现并发竞争。

### 6.2 Pull

```sql
SELECT *
FROM operations
WHERE server_seq > ?
ORDER BY server_seq ASC
LIMIT ?;
```

返回值保持：

```json
{
  "ops": [],
  "cursor": 123
}
```

有结果时 cursor 为最后一条 `server_seq`；无结果时保持请求 cursor。

### 6.3 Pending

有 `clientId` 时：

```sql
SELECT COUNT(*) AS count
FROM operations
WHERE server_seq > ? AND client_id != ?;
```

没有 `clientId` 时只按 `server_seq > ?` 统计。

## 7. Cursor 兼容

Google Worker 返回的是 Sheet 物理行号，而不是从 1 开始的业务记录序号。表头占第 1 行，因此第一条数据通常使用 cursor `2`。

迁移时必须显式写入：

```text
Google Sheet rowNumber -> D1 operations.server_seq
```

示例：

| Google 行号 | D1 server_seq |
| ----------- | ------------- |
| 2           | 2             |
| 3           | 3             |
| 101         | 101           |

显式插入最大 `server_seq` 后，SQLite `AUTOINCREMENT` 会从当前最大值之后继续生成新 cursor。

即使历史中存在被确认可忽略的完全重复行，也保留后续记录的原物理行号。允许中间出现 cursor 空洞，因为拉取条件使用 `server_seq > cursor`。

## 8. 历史数据迁移

生产和测试环境分别执行以下流程。

### 8.1 迁移前检查

- 记录源 Sheet 数据行数、最小行号和最大行号。
- 估算 payload 总字节数，确认目标 D1 低于免费版单库 500 MB 限制。
- 检查必需表头：`id`、`clientId`、`table`、`type`、`key`、`payload`、`timestamp`、`serverTimestamp`、`keyHash`。
- 扫描重复 `(clientId, id)`：
  - fingerprint 相同可幂等合并。
  - fingerprint 不同必须停止迁移并人工确认，不能静默覆盖。
- 导出或保留一份只读 Sheet 快照。

### 8.2 临时迁移 Worker

迁移期间使用一个临时版本，继续包含 Google 读取代码和现有 Secrets，并增加受 `SYNC_ACCESS_TOKEN` 保护的迁移入口。该入口不保留在最终版本。

临时版本提供：

- push 维护锁：锁定后返回可重试的 `503`，客户端继续保留本地待同步操作。
- 分页读取 Google Sheet。
- 使用原物理行号写入 D1。
- 幂等重复执行能力。
- 迁移状态输出：读取数、插入数、重复数、冲突数、最大 cursor。

### 8.3 切换顺序

1. 创建目标 D1 并应用 migration。
2. 部署临时迁移 Worker，正常同步仍使用 Google Sheet。
3. 启用 push 维护锁。
4. 将全部 Sheet 历史迁移到 D1。
5. 再执行一次最终扫描，确认锁定前最后写入的数据全部进入 D1。
6. 校验源和目标。
7. 部署 D1-only Worker。
8. 验证 push、pull、pending 和多客户端同步。
9. 保留 Google Sheet 为只读基线备份。
10. 稳定观察后删除 Google Secrets，不立即删除 Sheet。

Wrangler 部署是原子替换。如果最终 D1-only Worker 部署失败，临时 Worker 和 push 锁仍然存在，可以解除锁并恢复 Google 写入。D1-only Worker 接受新写入后，不再直接回切 Google，因为 Google 不包含切换后的增量。

## 9. 生产与测试隔离

使用两个独立数据库：

| 环境 | Worker            | D1 建议名称     | 域名                       |
| ---- | ----------------- | --------------- | -------------------------- |
| 生产 | `dpp-sync-worker` | `dpp-sync`      | `dpp-sync.586726.xyz`      |
| 测试 | `dpp-sync-test`   | `dpp-sync-test` | `dpp-sync-test.586726.xyz` |

`DB` 是 Wrangler 非继承 binding，必须在顶层和 `env.test` 中分别配置。

账号侧操作包括创建 D1、应用远程 migration、部署 Worker 和修改 Secrets。这些操作在代码与本地验证完成后再次获得用户确认，不在代码阶段自动执行。

## 10. 代码改动范围

预计修改：

- `packages/cf-worker-googlesheet/src/index.ts`
- `packages/cf-worker-googlesheet/src/lib/pushCoordinator.ts`
- `packages/cf-worker-googlesheet/src/lib/idempotency.ts`
- `packages/cf-worker-googlesheet/wrangler.toml`
- `packages/cf-worker-googlesheet/package.json`
- `packages/cf-worker-googlesheet/tsconfig.json`
- `packages/DEPLOY.md`
- `tests/syncWorker.test.mjs`
- `pnpm-lock.yaml`

预计新增：

- `packages/cf-worker-googlesheet/src/lib/d1.ts`
- `packages/cf-worker-googlesheet/migrations/0001_create_operations.sql`
- Wrangler 生成的 Worker binding 类型文件

最终删除：

- `packages/cf-worker-googlesheet/src/lib/sheets.ts`
- `packages/cf-worker-googlesheet/src/lib/google-auth.ts`
- `packages/cf-worker-googlesheet/google-sheets-template.csv`
- `google-auth-library`
- `google-spreadsheet`
- 仅由 Google 鉴权使用的 `jose`
- 最终 Wrangler 配置中的 KV binding
- `GOOGLE_SERVICE_ACCOUNT` 和 `GOOGLE_SPREADSHEET_ID` 部署说明

临时迁移入口和维护锁代码在远程迁移完成后删除，不进入最终长期实现。

## 11. 测试计划

### 11.1 自动测试

- 首次 push 写入并返回 cursor。
- 相同操作重复 push，行数不增加且仍返回确认 ID。
- 相同 `(clientId, id)` 使用不同内容时返回冲突。
- 单个请求内存在冲突重复项时整批拒绝。
- 50 条操作批量写入。
- 密文操作校验。
- chunk shape、client identity、确定性 ID 和大小校验。
- pull 从 cursor 之后分页，并在空结果时保持 cursor。
- pending 排除当前客户端。
- 历史导入保留 Google 物理行号。
- 迁移重复执行不会重复插入。
- 历史冲突不会被覆盖。

### 11.2 本地 D1 集成验证

1. 应用本地 migration。
2. 启动 `wrangler dev` 本地 D1。
3. 验证未授权请求返回 `401`。
4. push 一条密文操作。
5. 重试相同操作。
6. push 相同 ID 的不同内容，确认 `409`。
7. 用 cursor 分页 pull。
8. 用两个 clientId 验证 pending。
9. 并发提交同一操作，确认只产生一行。

### 11.3 项目质量检查

```bash
pnpm test
pnpm --filter dpp-worker exec tsc --noEmit
pnpm compile
pnpm lint
pnpm build
pnpm --filter dpp-worker exec wrangler deploy --dry-run
```

只对本次修改文件执行自动格式化和修复，避免改写工作区中已有的无关用户变更。

## 12. 远程验收

测试环境必须先完成：

- Sheet 与 D1 迁移记录数一致，或所有差异都有重复行说明。
- 最大 Google 行号等于最大 D1 `server_seq`。
- 旧 cursor 可以继续拉取下一条记录。
- 两个独立浏览器 profile 可以互相同步。
- 大内容 chunk 可以上传、拉取、重组和解密。
- 重复 push 不产生重复记录。
- pending 数量正确。

生产环境切换后检查：

- `/health` 正常。
- 新操作进入 D1。
- 客户端本地待上传队列可以清空。
- Worker 日志没有 D1 overload、绑定缺失、migration 或解析错误。
- D1 dashboard 中 rows read、rows written 和存储量符合预期。

## 13. 免费额度与容量边界

截至 2026-08-27，Cloudflare Workers Free 的主要 D1 限制为：

- 每账号最多 10 个 D1 数据库。
- 每数据库最多 500 MB。
- 每账号总存储最多 5 GB。
- 每天 5,000,000 rows read。
- 每天 100,000 rows written。
- 每次 Worker 调用最多 50 条 D1 查询。
- 单行、字符串或 BLOB 最大 2 MB。

本方案使用 2 个数据库。正常 push 使用少量 indexed read 加批量写入，pull 使用主键范围查询，适合免费额度。

当前同步历史是永久追加日志，500 MB 是长期硬上限。接近以下任一条件时，应单独规划归档、快照压缩或升级付费方案：

- 单库使用量达到 400 MB。
- 日写入接近 80,000 rows。
- 日读取接近 4,000,000 rows。

本次不提前实现归档机制；先通过 D1 dashboard 取得真实增长速度。

## 14. 实施阶段

### 阶段 A：代码和本地验证

- 实现 D1 schema、存储适配器和接口替换。
- 实现可删除的迁移工具。
- 更新测试和部署文档。
- 完成所有本地检查。
- 不创建 Cloudflare 资源，不部署远程环境。

### 阶段 B：测试环境迁移

- 再次确认账号侧操作授权。
- 创建测试 D1，应用 migration。
- 部署临时迁移 Worker并迁移测试 Sheet。
- 部署 D1-only Worker。
- 完成真实多客户端验收。

### 阶段 C：生产环境迁移

- 创建生产 D1，应用 migration。
- 部署临时迁移 Worker。
- 锁定 push，迁移并校验生产 Sheet。
- 部署 D1-only Worker。
- 完成生产 smoke test 和指标检查。

### 阶段 D：清理

- 删除临时迁移入口。
- 删除 Google 代码和依赖。
- 删除 Google Secrets。
- 保留只读 Sheet 作为基线备份，待人工决定最终删除时间。

## 15. 完成定义

以下条件全部满足才算迁移完成：

- 生产和测试 Worker 均只使用 D1 持久化同步日志。
- 现有客户端无需重置 cursor 或本地数据库。
- Google 历史完整迁移并通过 cursor 连续性验证。
- Worker 不再请求 Google API。
- Google SDK、Service Account 和 Spreadsheet ID 已从最终运行时删除。
- push、pull、pending、幂等、冲突、chunk 和跨客户端同步测试通过。
- `pnpm test`、TypeScript、lint、build 和 Worker dry-run 通过。
- Google Sheet 已转为只读备份，并明确后续删除责任。
