# Cloudflare Worker + D1 部署指南

DPP 同步服务只支持 Cloudflare Worker + D1。浏览器端先加密数据，Worker 只保存密文或密文分片，不持有解密密钥。

当前代码位置仍为 `packages/cf-worker-googlesheet`，这是历史目录名，不代表最终 Worker 依赖 Google Sheets。长期入口 `src/index.ts` 只绑定 D1 和 Durable Object。

## 架构

```text
浏览器扩展
  -> POST /api/sync/push
  -> GET  /api/sync/pull
  -> GET  /api/sync/pending
  -> Cloudflare Worker
  -> Durable Object 串行化 push
  -> D1 operations 追加日志
```

D1 负责 cursor、唯一约束、fingerprint 冲突检测、分页拉取和 pending 统计。Durable Object 不保存业务数据，只避免并发 push 在“查询后写入”之间竞争。

## 当前环境

| 环境 | Worker | D1 | 域名 |
| --- | --- | --- | --- |
| 生产 | `dpp-sync-worker` | `dpp-sync` | `https://dpp-sync.586726.xyz` |
| 测试 | `dpp-sync-test` | `dpp-sync-test` | `https://dpp-sync-test.586726.xyz` |

生产和测试必须使用不同的 D1、`SYNC_ACCESS_TOKEN`、`MIGRATION_ADMIN_TOKEN` 和浏览器配置。

## 前置条件

- Node.js 20+
- pnpm 10+
- Cloudflare 账号
- 由 Cloudflare 托管的域名（仅自定义域名需要）
- Wrangler OAuth 登录权限：Workers、D1、Durable Objects、Routes、Secrets

所有命令从仓库根目录执行：

```bash
pnpm install
pnpm --filter dpp-worker exec wrangler login
pnpm --filter dpp-worker exec wrangler whoami
```

不要把访问令牌、Service Account JSON 或其他 Secret 写入 Git。

## 新账号首次部署

当前 `wrangler.toml` 中的数据库 UUID 属于现有 Cloudflare 账号。部署到其他账号时必须创建自己的数据库并替换 UUID。

### 1. 创建生产和测试 D1

```bash
pnpm --filter dpp-worker exec wrangler d1 create dpp-sync
pnpm --filter dpp-worker exec wrangler d1 create dpp-sync-test
```

将返回的 `database_id` 分别写入：

- `packages/cf-worker-googlesheet/wrangler.toml`
- 仅迁移旧 Google Sheet 时再同步修改 `wrangler.migration.toml`

顶层 `d1_databases` 对应生产，`env.test.d1_databases` 对应测试。D1 binding 不会从顶层继承到命名环境，两个位置都必须配置。

### 2. 配置域名

修改 `wrangler.toml` 中的两个 `routes`：

```toml
[[routes]]
pattern = "sync.example.com"
zone_name = "example.com"
custom_domain = true

[[env.test.routes]]
pattern = "sync-test.example.com"
zone_name = "example.com"
custom_domain = true
```

不使用自定义域名时删除 `routes`，并使用 Wrangler 输出的 `workers.dev` 地址。

### 3. 应用 D1 migration

先测试，后生产：

```bash
pnpm --filter dpp-worker exec wrangler d1 migrations apply dpp-sync-test --remote --env test
pnpm --filter dpp-worker exec wrangler d1 migrations apply dpp-sync --remote
```

检查结果：

```bash
pnpm --filter dpp-worker exec wrangler d1 info dpp-sync-test
pnpm --filter dpp-worker exec wrangler d1 info dpp-sync
```

### 4. 配置访问令牌

生产和测试使用不同的高熵令牌：

```bash
pnpm --filter dpp-worker exec wrangler secret put SYNC_ACCESS_TOKEN --env test
pnpm --filter dpp-worker exec wrangler secret put SYNC_ACCESS_TOKEN
```

Wrangler 会交互式读取 Secret。不要把令牌放在命令参数、配置文件或 shell 历史中。

### 5. 生成 binding 类型并检查

```bash
pnpm --filter dpp-worker types
pnpm --filter dpp-worker exec tsc --noEmit
pnpm --filter dpp-worker exec wrangler deploy --dry-run --env test
pnpm --filter dpp-worker exec wrangler deploy --dry-run --env ""
```

### 6. 部署

始终先发布测试环境：

```bash
pnpm release:worker:test
pnpm release:worker
```

`wrangler deploy` 是原子替换。命令成功前，旧 Worker 继续服务。

## 本地开发

### 初始化本地 D1

```bash
pnpm --filter dpp-worker exec wrangler d1 migrations apply DB --local
```

本地数据保存在包目录的 `.wrangler/` 下，已被 Git 忽略。

### 启动 Worker

```bash
pnpm --filter dpp-worker exec wrangler dev --local --var SYNC_ACCESS_TOKEN:local-token
```

验证鉴权和健康检查：

```bash
curl -i http://localhost:8787/health
curl -H 'X-Access-Token: local-token' http://localhost:8787/health
```

预期第一个请求返回 `401`，第二个返回：

```json
{"status":"ok"}
```

### 本地接口验证

```bash
curl -X POST http://localhost:8787/api/sync/push \
  -H 'X-Access-Token: local-token' \
  -H 'X-Client-ID: local-client' \
  -H 'Content-Type: application/json' \
  -d '{"ops":[{"id":"local-op-1","clientId":"local-client","table":"encrypted","type":"create","key":"local-op-1","payload":{"iv":"iv","ciphertext":"ciphertext"},"timestamp":1,"keyHash":"key-hash"}]}'

curl -H 'X-Access-Token: local-token' \
  'http://localhost:8787/api/sync/pull?cursor=0&limit=100'

curl -H 'X-Access-Token: local-token' \
  'http://localhost:8787/api/sync/pending?cursor=0&clientId=local-client'
```

## 发布前检查

```bash
pnpm test
pnpm --filter dpp-worker exec tsc --noEmit
pnpm compile
pnpm lint
pnpm build
pnpm --filter dpp-worker exec wrangler deploy --dry-run --env test
pnpm --filter dpp-worker exec wrangler deploy --dry-run --env ""
```

只发布 Worker：

```bash
pnpm release:worker:test
pnpm release:worker
```

打包扩展并发布生产 Worker：

```bash
pnpm release
```

## 远程验收

先把目标环境令牌放入当前 shell，避免写进命令历史：

```bash
read -s SYNC_ACCESS_TOKEN
export SYNC_ACCESS_TOKEN
export SYNC_WORKER_URL='https://dpp-sync-test.586726.xyz'
```

检查：

```bash
curl -H "X-Access-Token: $SYNC_ACCESS_TOKEN" "$SYNC_WORKER_URL/health"
curl -H "X-Access-Token: $SYNC_ACCESS_TOKEN" \
  "$SYNC_WORKER_URL/api/sync/pull?cursor=0&limit=1"
curl -H "X-Access-Token: $SYNC_ACCESS_TOKEN" \
  "$SYNC_WORKER_URL/api/sync/pending?cursor=0&clientId=smoke-client"
```

还需使用两个独立浏览器 profile 验证：

- profile A 写入后，profile B 能拉取并解密。
- 大内容能分片上传、跨页拉取、重组并解密。
- 相同操作重试不会增加 D1 行数。
- 相同 `(clientId, operationId)` 的不同内容返回 `409`。
- 旧 cursor 无需重置即可继续拉取。

## 监控和维护

查看 Worker 日志：

```bash
pnpm --filter dpp-worker exec wrangler tail --env test
pnpm --filter dpp-worker exec wrangler tail
```

查看 D1 状态：

```bash
pnpm --filter dpp-worker exec wrangler d1 info dpp-sync-test
pnpm --filter dpp-worker exec wrangler d1 info dpp-sync
```

检查日志行数和 cursor：

```bash
pnpm --filter dpp-worker exec wrangler d1 execute dpp-sync-test --remote --env test \
  --command 'SELECT COUNT(*) AS count, MIN(server_seq) AS min_cursor, MAX(server_seq) AS max_cursor FROM operations'

pnpm --filter dpp-worker exec wrangler d1 execute dpp-sync --remote \
  --command 'SELECT COUNT(*) AS count, MIN(server_seq) AS min_cursor, MAX(server_seq) AS max_cursor FROM operations'
```

导出 D1 备份：

```bash
pnpm --filter dpp-worker exec wrangler d1 export dpp-sync-test --remote --output dpp-sync-test.sql
pnpm --filter dpp-worker exec wrangler d1 export dpp-sync --remote --output dpp-sync.sql
```

备份文件可能包含密文、身份标识和同步元数据，不要提交到 Git。

## Worker 回滚

查看版本：

```bash
pnpm --filter dpp-worker exec wrangler versions list --env test
pnpm --filter dpp-worker exec wrangler versions list
```

回滚 Worker 代码：

```bash
pnpm --filter dpp-worker exec wrangler rollback --env test
pnpm --filter dpp-worker exec wrangler rollback
```

Worker 回滚不会回滚 D1 schema 或数据。涉及 schema 的发布必须先备份，并提供向前兼容 migration；不要修改或删除已应用的 migration 文件。

## 从旧 Google Sheet 迁移

仅已有 Google Sheet 同步历史的部署需要本节。新部署直接使用 D1，不配置 Google、KV 或 `wrangler.migration.toml`。

临时入口：

- `src/migration.ts`
- `src/lib/migrationCoordinator.ts`
- `wrangler.migration.toml`

迁移步骤：

1. 导出并保留只读 Sheet 快照。
2. 创建目标 D1 并应用 migration。
3. 在目标环境配置 `GOOGLE_SERVICE_ACCOUNT`、`GOOGLE_SPREADSHEET_ID` 和 `SYNC_ACCESS_TOKEN`。
   另外配置仅供迁移管理员使用的 `MIGRATION_ADMIN_TOKEN`，不要与同步访问令牌共用。
4. 部署临时 Worker，正常同步此时仍走 Google Sheet。
5. 调用 `/api/migration/lock` 启用 push 锁。
6. 按最多 50 条调用 `/api/migration/import`，持续使用响应中的 `sourceCursor`。
7. 从 cursor 0 再完整扫描一次，确认全部为 duplicate、没有 conflict。
8. 核对源/目标行数、payload 字节和最大 cursor。
9. 部署长期 D1-only Worker。
10. 验证新写入 cursor 从历史最大值之后继续。

临时 Worker 部署：

```bash
pnpm --filter dpp-worker exec wrangler deploy --config wrangler.migration.toml --env test
pnpm --filter dpp-worker exec wrangler deploy --config wrangler.migration.toml --env ""
```

配置迁移管理员令牌（使用交互式输入）：

```bash
pnpm --filter dpp-worker exec wrangler secret put MIGRATION_ADMIN_TOKEN --config wrangler.migration.toml --env test
pnpm --filter dpp-worker exec wrangler secret put MIGRATION_ADMIN_TOKEN --config wrangler.migration.toml --env ""
```

启用维护锁：

```bash
curl -X POST \
  -H "X-Access-Token: $MIGRATION_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"locked":true}' \
  "$SYNC_WORKER_URL/api/migration/lock"
```

导入一页：

```bash
curl -X POST \
  -H "X-Access-Token: $MIGRATION_ADMIN_TOKEN" \
  "$SYNC_WORKER_URL/api/migration/import?cursor=0&limit=50"
```

切换最终 Worker：

```bash
pnpm release:worker:test
pnpm release:worker
```

D1-only Worker 接受新写入后不能直接回切 Google，因为 Sheet 不包含切换后的增量。

稳定观察后可删除临时迁移入口、Google SDK、迁移配置和 Google Secrets。Google Sheet 建议先保留为只读基线，删除时间由数据所有者决定。

## 故障排查

| 现象 | 检查 |
| --- | --- |
| `401 Unauthorized` | 目标环境是否设置正确的 `SYNC_ACCESS_TOKEN`，扩展是否使用同一令牌 |
| `DB is undefined` | `d1_databases` 是否同时配置在顶层和 `env.test` |
| `no such table: operations` | 是否对对应环境应用了 D1 migration |
| push 返回 `409` | 相同客户端操作 ID 已存在不同 fingerprint，检查客户端身份和重试数据 |
| push 返回 `503` | 临时迁移 Worker 的维护锁仍开启 |
| 旧 cursor 拉不到数据 | 检查历史导入是否保留原 `server_seq`，以及目标最大 cursor |
| 自定义域名不可达 | 域名是否由当前 Cloudflare zone 托管，`routes` 是否匹配 |
| 部署到了错误环境 | 显式使用 `--env test` 或 `--env ""` |

不要通过清空 D1、重置客户端 cursor 或删除本地 IndexedDB 来规避同步问题，这些操作可能造成重复应用或数据丢失。
