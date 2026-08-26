# 同步大内容分片上传设计

状态：待审查，当前仅记录方案，未修改实现代码。

## 1. 目标

在同步上传时避免单条超大型内容被服务商拒绝，同时满足以下约束：

- 内容在客户端加密，服务端只保存密文。
- 同时支持 SQLite Node Server 和 Google Sheets Worker。
- 已在线旧客户端继续同步普通操作，不被新协议破坏。
- 网络超时、重试、浏览器重启不会造成数据丢失或重复应用。
- 不改变现有逻辑操作、冲突解决和最终解密流程。

## 2. 当前链路

当前流程位于以下模块：

- `src/lib/sync/SyncEngine.push.ts`
- `src/db/syncProvider.ts`
- `src/lib/sync/crypto-helpers.ts`
- `src/lib/sync/SyncEngine.pull.ts`
- `packages/node-server/src/index.ts`
- `packages/node-server/src/db.ts`
- `packages/cf-worker-googlesheet/src/index.ts`
- `packages/cf-worker-googlesheet/src/lib/sheets.ts`

现有流程会先将整条操作 JSON 序列化，再使用 AES-GCM 加密，之后把完整密文作为一个 payload 上传。当前批次大小只能限制操作条数，无法限制单条操作大小。

## 3. 总体方案

对大内容执行以下流程：

1. 保持现有行为，先对完整逻辑操作执行一次 AES-GCM 加密。
2. 不切分明文，也不分别加密每个明文片段。
3. 只切分最终 `ciphertext` 的 Base64 字符串。
4. 每个分片保存相同的 `iv`、操作 ID、分片序号和总数。
5. 拉取端持久化保存分片，收齐后拼接完整 ciphertext。
6. 拼接完成后复用现有 `decryptOperation()` 解密和应用。

这样仍然只有一次 AES-GCM 完整性校验。缺片、乱序、重复或内容被修改时，最终解密会失败，不会把不完整数据应用到业务表。

## 4. 保守大小限制

假设 Google 侧的硬限制为 5000 字符/单元格，第一版不贴近硬上限，使用以下值：

```ts
const MAX_SHEET_CELL_CHARS = 3000;
const MAX_CHUNK_CIPHERTEXT_CHARS = 2400;
const MAX_PUSH_REQUEST_BYTES = 64 * 1024;
```

具体规则：

- 加密后 payload 的最终序列化长度不超过 3000 字符：继续使用普通操作流。
- 超过 3000 字符：使用分片流。
- 每个分片的 ciphertext 默认不超过 2400 字符。
- 写入 Google Sheets 前必须再次验证 `JSON.stringify(chunkPayload).length <= 3000`。
- 如果元数据导致分片超限，继续缩小当前分片，而不是依赖固定值。
- 单次 HTTP 请求 JSON body 控制在 64 KiB 以内。

判断依据是最终要写入服务商的字符串，不是原始明文长度。AES-GCM 和 Base64 会增加体积，原始内容大小只能作为粗略估算。

## 5. 分片数据结构

分片使用独立的 v2 数据结构，不混入现有普通操作流：

```ts
{
  id: "operation-id:chunk:0",
  clientId: "client-id",
  operationId: "operation-id",
  chunkIndex: 0,
  chunkTotal: 4,
  timestamp: 1234567890,
  keyHash: "encryption-key-hash",
  iv: "base64-iv",
  ciphertext: "base64-ciphertext-fragment",
  ciphertextHash: "sha256-of-full-ciphertext"
}
```

要求：

- `id` 必须由原操作 ID 和分片序号确定性生成。
- 相同分片重试时必须使用相同 ID。
- `operationId` 用于本地重组。
- `chunkIndex` 从 0 开始。
- `chunkTotal` 必须在所有分片中一致。
- `ciphertextHash` 用于识别错误或混入其他操作的分片。
- 分片自身不包含明文业务字段。

### 分片组合规则

组合关系由客户端在切片时明确写入，不依赖上传顺序：

- `operationId` 是原始逻辑操作的 ID，也是分片组 ID。
- `chunkIndex` 标识当前分片位置，从 0 到 `chunkTotal - 1`。
- `chunkTotal` 表示该逻辑操作的完整分片数量。
- 所有同组分片必须拥有相同的 `ciphertextHash`、`iv`、`keyHash` 和 `timestamp`。
- 服务端以 `(clientId, id)` 作为幂等键，以 `operationId` 作为查询和分组字段。
- 客户端按 `operationId` 分组，确认序号完整后按 `chunkIndex` 排序并拼接 ciphertext。

例如一个四片操作的 ID 关系为：

```text
operationId = op-123

op-123:chunk:0  index=0 total=4
op-123:chunk:1  index=1 total=4
op-123:chunk:2  index=2 total=4
op-123:chunk:3  index=3 total=4
```

服务端主要负责保存、去重和按 cursor 返回分片，不需要解密或重组业务内容。客户端发现 `0..chunkTotal-1` 全部存在且校验一致后，才生成完整加密操作并进入解密流程。相同 `id`、相同内容的重复分片直接视为成功；相同 `id` 但内容不同则返回冲突错误。

## 6. 旧客户端兼容

不能把分片记录直接写入现有 `/api/sync/pull` 流。否则旧客户端会推进旧 cursor，却无法理解分片，后续升级后也可能永久跳过数据。

保留现有接口：

- `POST /api/sync/push`
- `GET /api/sync/pull`
- `GET /api/sync/pending`

新增分片接口：

- `GET /api/sync/capabilities`
- `POST /api/sync/chunks/push`
- `GET /api/sync/chunks/pull`
- `GET /api/sync/chunks/pending`

其中 `/api/sync/capabilities` 只用于能力探测，不传输同步数据，也不推进任何 cursor。新客户端在首次连接或服务端地址变化后调用它，确认服务端是否支持 `chunk-v1`，并读取服务端声明的限制，例如：

```json
{
  "protocolVersion": 1,
  "chunkUpload": true,
  "chunkPull": true,
  "maxPayloadChars": 3000,
  "maxChunkCiphertextChars": 2400,
  "maxRequestBytes": 65536
}
```

客户端实际使用的限制取本地保守值和服务端声明值中的较小值。旧服务端没有该接口时，客户端按“只支持旧协议”处理，不上传大内容到旧接口，并保留原操作为未同步状态。能力结果可以短时间缓存，但服务端升级或配置变化后应重新探测。

能力探测采用懒加载和短期缓存：

- 如果本次同步没有超过大小阈值的操作，可以不调用能力接口。
- 第一次准备分片上传或分片拉取时调用一次。
- 同一 `SyncProvider` 实例对同一服务端缓存 10 分钟。
- 不按分片、分片批次或普通同步次数重复调用。
- 同步服务器 URL 或 access token 变化时立即使缓存失效。
- 收到 `404`、`405` 或协议不支持响应时使缓存失效，并按仅支持旧协议处理。
- 扩展后台重启后内存缓存丢失，下一次需要 v2 协议时重新探测。

兼容策略：

- 小内容继续走旧操作流。
- 大内容只走分片流。
- 旧客户端只访问旧流，因此继续支持普通同步。
- 新客户端同时拉取旧流和分片流。
- 服务端不支持分片时，不上传超大操作，保留 `synced: 0` 并返回明确错误。

服务端不在返回时根据 payload 大小重新判断协议。上传接口已经决定数据的存储位置：

- `/api/sync/push` 只写入旧 `operations` 表或 `Operations` Sheet。
- `/api/sync/chunks/push` 只写入 `operation_chunks` 表或 `OperationChunks` Sheet。
- `/api/sync/pull` 只查询旧操作流，并返回 `protocol: "legacy-v1"`。
- `/api/sync/chunks/pull` 只查询分片流，并返回 `protocol: "chunk-v1"`。

新客户端固定分别调用两个拉取接口，旧客户端只调用旧接口。单个请求不允许混合完整操作和分片；如果请求中的 `protocol` 与 endpoint 不一致，服务端直接返回 400。

## 7. 客户端上传流程

主要涉及：

- `src/lib/sync/types.ts`
- 新增 `src/lib/sync/chunks.ts`
- `src/db/syncProvider.ts`
- `src/lib/sync/SyncEngine.push.ts`

流程：

1. 读取待同步的逻辑操作。
2. 按现有规则选择同步密钥并加密。
3. 测量最终 payload 序列化大小。
4. 小内容调用旧 `push` 接口。
5. 大内容生成确定性分片 ID。
6. 按 64 KiB 请求上限打包分片并顺序上传。
7. 服务端返回的已接受分片必须覆盖本次所有分片。
8. 只有所有分片成功后，provider 才返回原始逻辑操作 ID。
9. `runPushFlow` 只把这些逻辑操作标记为 `synced: 1`。

上传失败时不标记原操作已同步。重试会复用相同分片 ID，由服务端幂等去重。

## 8. 客户端拉取与恢复

新增本地 Dexie 表 `syncChunks`，建议索引：

```text
id
operationId
[operationId+chunkIndex]
receivedAt
```

新增独立的 chunk cursor，例如 `SyncMetadata.lastChunkCursor`。

拉取流程：

1. 从本地 `syncChunks` 查找已经收齐的操作并尝试处理。
2. 拉取旧操作流和分片流。
3. 将分片和 `lastChunkCursor` 在同一个 Dexie transaction 中写入。
4. 根据 `operationId` 去重、校验总数和 hash。
5. 收齐后重组完整 ciphertext。
6. 使用正确的同步密钥解密。
7. 将旧流操作和已重组操作按原始 `timestamp` 合并排序。
8. 应用到业务表。
9. 成功后删除对应的 `syncChunks` 记录。

即使浏览器在第 3 步之后崩溃，重启时也能从本地缓存继续处理，不依赖远端 cursor 回退。

不完整分片不能立即删除。达到保留期限后应记录告警并清理，不能静默丢弃。

### 完整拉取判定

同一操作的分片可能跨越多个拉取分页，客户端不能根据单次响应中的分片数量判断是否完整。每次拉取后先持久化，再按 `operationId` 查询本地所有已保存分片。

只有同时满足以下条件才视为完整：

- 所有分片声明相同且有效的 `chunkTotal`。
- 去重后的 `chunkIndex` 数量等于 `chunkTotal`。
- `chunkIndex` 集合恰好覆盖 `0..chunkTotal-1`，不能只比较数量。
- 所有分片的 `operationId`、`iv`、`keyHash`、`ciphertextHash` 和 `timestamp` 一致。
- 按序拼接后的 ciphertext hash 等于 `ciphertextHash`。

例如 `chunkTotal = 4` 时，只有本地存在索引集合 `{0, 1, 2, 3}` 才完整。`{0, 1, 1, 3}` 即使有四条记录也不完整。

分片接口应返回 `hasMore` 和 `nextCursor`。客户端在 `hasMore: true` 时继续分页拉取；远端暂时没有更多分片但本地组合仍不完整时，保留本地缓存并等待后续同步。源客户端只有在服务端确认所有确定性分片 ID 后才将原操作标记为已同步，因此上传中断后仍会补传缺失分片。

## 9. 服务端设计

### 9.1 SQLite Node Server

新增 `operation_chunks` 表，至少包含：

- 自增的 chunk cursor/sequence。
- `chunk_id`，唯一约束。
- `operation_id`。
- `client_id`。
- `chunk_index`。
- `chunk_total`。
- `timestamp`。
- `key_hash`。
- `iv`。
- `ciphertext`。
- `ciphertext_hash`。

已有 `operations` 表也需要增加并保留 `client_id`。不能只依赖 `CREATE TABLE IF NOT EXISTS`，需要为已有 SQLite 数据增加迁移逻辑。

### 9.2 Google Sheets Worker

保留原 `Operations` Sheet，新增独立的 `OperationChunks` Sheet。分片元数据使用独立列，密文单独放在 payload/ciphertext 列。

需要处理：

- `clientId` 列。
- `chunkId` 列。
- `operationId` 列。
- `chunkIndex` 和 `chunkTotal` 列。
- 独立 chunk cursor。
- KV 中的已确认 chunk ID 或等效幂等索引。
- 重试后的重复行过滤。

Google Sheets 的读取和追加必须只操作分片 Sheet，不得让旧 `/pull` 读取到分片行。

## 10. Cursor 和排序

普通操作流和分片流各自维护 cursor：

- `lastServerCursor`
- `lastChunkCursor`

上传响应中的 cursor 不能直接按“逻辑操作数”推导，因为一个逻辑操作可能对应多个物理分片，也可能有其他客户端并发写入。

拉取时必须将两条流中已经完整的逻辑操作按原始 `timestamp` 合并排序后再应用。删除操作也需要参与时间戳冲突判断，避免跨流乱序造成旧删除覆盖新数据。

## 11. clientId 和幂等

当前服务端 schema 会丢弃 `clientId`，这一问题需要在分片功能之前修复：

- Node Server 的 schema、数据库表和返回值保留 `clientId`。
- Google Sheets 增加 `clientId` 列并在读取时还原。
- 分片 ID 作为幂等键。
- 服务端收到相同 ID、相同内容时返回成功但不重复写入。
- 收到相同 ID、不同内容时返回冲突错误。
- 客户端本地重组时再次按 `id` 去重。

## 12. Dexie Migration

在 `src/db/schema.ts` 增加新版本，例如 v19：

- 新增 `syncChunks` 表。
- 保留已有表和索引。
- 不修改或删除已有 `operations` 数据。
- `SyncMetadata` 使用新增可选字段，兼容旧记录。

需要测试从当前数据库版本升级到新版本，确保已有同步队列、cursor 和业务数据不受影响。

## 13. 测试计划

新增或扩展同步测试，至少覆盖：

- 小 payload 仍走旧协议。
- 超过 3000 字符的 payload 走分片协议。
- 每个最终 payload 不超过 3000 字符。
- 分片数量和序号正确。
- 分片乱序可以重组。
- 重复分片不会重复应用。
- 缺失分片不会提前应用。
- 错误 hash 或错误 ciphertext 不会应用。
- 上传超时后重试不会产生重复服务端记录。
- 浏览器重启后可从 `syncChunks` 继续处理。
- 普通流和分片流的操作按 timestamp 合并。
- Node Server round-trip。
- Google Sheets Worker round-trip。
- 旧客户端访问旧接口时仍可同步普通操作。
- Dexie migration 不丢失已有数据。

## 14. 实施顺序

1. 新增类型和纯函数分片/重组逻辑。
2. 为 Node Server 增加分片表、迁移、接口和幂等。
3. 为 Google Sheets Worker 增加分片 Sheet、cursor 和幂等。
4. 修复两个服务端对 `clientId` 的保存和返回。
5. 增加客户端 `syncChunks` 表及 Dexie migration。
6. 接入客户端分片上传。
7. 接入双流拉取、持久化、重组和恢复。
8. 增加跨流排序和删除冲突保护。
9. 运行质量检查：

```bash
pnpm compile
pnpm lint:fix
pnpm build
```

## 15. 第一版明确不做

- 流式 AES 加密。
- 压缩。
- 并发分片上传。
- 自动探测并动态提升服务商上限。
- 将分片数据混入旧操作流。

第一版优先保证数据完整性、旧客户端兼容和可恢复性。后续只有在实际同步耗时或流量证明有必要时，再考虑压缩或并发上传。
