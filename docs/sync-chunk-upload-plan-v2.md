# 同步大内容分片上传实施计划

状态：待实施。

本文档是一个独立的实施任务说明。执行本计划时不需要依赖其他方案文档、对话上下文或外部设计说明。目标是在现有同步协议中增加大内容分片能力：继续使用现有 push/pull 接口、现有操作表/Sheet 和一个长期同步 cursor，通过操作数据结构区分完整操作与分片操作。

实施 Agent 必须先阅读本文件，再阅读代码。除非本文件明确要求，不要新增专用分片接口、第二个长期 cursor、第二个 Google Sheet 或服务端解密逻辑。

## 0. 给实施 Agent 的执行约束

### 必须保留

- 现有普通操作的上传、拉取、加密、解密和冲突处理行为。
- 现有接口：`POST /api/sync/push`、`GET /api/sync/pull`、`GET /api/sync/pending`。
- 现有 SQLite `operations` 表和 Google Sheets `Operations` Sheet。
- 服务端只存储密文，不读取业务明文。
- 旧客户端同步普通完整操作的能力。

### 禁止新增

- `/api/sync/chunks/push`、`/api/sync/chunks/pull` 等分片专用接口。
- 第二个长期同步 cursor。
- 第二个 Google Sheets 工作表。
- 服务端解密、重组或应用业务数据。
- 为兼容性引入一套平行的同步引擎。

### 实施原则

- 先理解现有调用链，再按本文件的最小范围修改。
- 大内容只在完成整体 AES-GCM 加密后切分 ciphertext，不切分明文。
- 分片操作必须可以重试、去重和在浏览器重启后恢复。
- 不完整分片不得解密、应用或删除。
- 所有异步操作必须正确等待，错误必须记录日志并保留待同步状态。
- 不修改与本任务无关的用户改动。

## 1. 现有系统事实

### 1.1 客户端同步模型

本项目是 WXT + React + TypeScript 浏览器扩展，使用 Dexie/IndexedDB 保存本地数据。

本地 `operations` 表保存待上传的逻辑操作，关键字段包括：

```ts
interface SyncOperation {
  id: string;
  clientId?: string;
  table: string;
  type: 'create' | 'update' | 'delete';
  key: unknown;
  payload?: unknown;
  timestamp: number;
  serverTimestamp?: number;
  synced: number;
  keyHash?: string;
}
```

客户端当前流程：

```text
业务表变更
-> 写入 operations(synced=0)
-> SyncEngine.push()
-> SyncProvider.push(ops, clientId)
-> encryptOperation()
-> POST /api/sync/push
-> 服务端追加操作日志
```

拉取流程：

```text
SyncEngine.pull()
-> 读取 syncMetadata.global.lastServerCursor
-> GET /api/sync/pull?cursor=...
-> 按 keyHash 找密钥
-> decryptOperation()
-> applySyncOperation()
-> 更新 lastServerCursor
```

当前加密边界位于 `src/lib/sync/crypto-helpers.ts`：业务操作中的 `table`、`type`、`key` 和 `payload` 被整体放入 AES-GCM 密文。服务端看到的通常是 `table: "encrypted"` 和加密 payload。

### 1.2 需要重点阅读的文件

客户端：

- `src/lib/sync/types.ts`
- `src/lib/sync/crypto-helpers.ts`
- `src/lib/sync/SyncEngine.push.ts`
- `src/lib/sync/SyncEngine.pull.ts`
- `src/lib/sync/SyncEngine.apply.ts`
- `src/lib/sync/SyncEngine.orchestration.ts`
- `src/lib/sync/SyncEngine.shared.ts`
- `src/db/syncProvider.ts`
- `src/db/schema.ts`
- `src/db/typesSync.ts`
- `src/db/typesDatabase.ts`

Cloudflare Worker：

- `packages/cf-worker-googlesheet/src/index.ts`
- `packages/cf-worker-googlesheet/src/lib/d1.ts`
- `packages/cf-worker-googlesheet/src/lib/pushCoordinator.ts`

### 1.3 服务端协议

服务端接受如下格式：

```json
{
  "ops": [
    {
      "id": "operation-id",
      "table": "encrypted",
      "type": "create",
      "key": "operation-id",
      "payload": {
        "iv": "base64-iv",
        "ciphertext": "base64-ciphertext"
      },
      "timestamp": 1234567890,
      "keyHash": "key-hash",
      "clientId": "client-id"
    }
  ],
  "clientId": "client-id"
}
```

服务端将操作追加到日志，返回 cursor。客户端用 cursor 读取增量日志。cursor 表示物理日志记录位置，而不是逻辑业务操作数量。

服务端必须保存并返回 `clientId`，否则客户端无法可靠过滤自己上传的完整操作和分片操作。

## 2. 目标与取舍

目标：

- 解决 Google Sheets 等服务商对单个大 payload 的限制。
- 不新增 push/pull 接口。
- 不新增第二个长期同步 cursor。
- 不新增第二个 Google Sheets 工作表。
- 保持客户端加密，服务端只保存密文或密文片段。
- 旧客户端继续同步普通完整操作。
- 旧客户端升级后能够通过一次历史回放找回错过的分片。

明确取舍：

- 旧客户端在升级前不需要理解大内容分片。
- 旧客户端可能跳过或暂存分片，但不能把分片应用到业务表。
- 新客户端升级时需要做一次历史分片扫描。
- 历史同步日志必须在服务端保留；当前 D1 `operations` 是追加日志，满足这一前提。

## 3. 方案概览

使用一条数据流承载两种操作：

```text
普通操作和分片操作 -> operations / Operations
```

本方案不新增：

- `/api/sync/chunks/push`
- `/api/sync/chunks/pull`
- `/api/sync/capabilities`
- `operation_chunks` 表
- `OperationChunks` Sheet
- 长期 `lastChunkCursor`

本方案仍然需要：

- 客户端本地 `syncChunks` 缓存表。
- 分片分组、完整性校验和重组。
- 服务端分片 ID 幂等。
- 升级后的历史分片恢复流程。
- 一个只在升级期间使用的临时恢复 cursor。

## 4. 实现范围与代码落点

实现主要落在以下模块：

- `src/lib/sync/SyncEngine.push.ts`
- `src/db/syncProvider.ts`
- `src/lib/sync/crypto-helpers.ts`
- `src/lib/sync/SyncEngine.pull.ts`
- `src/lib/sync/SyncEngine.apply.ts`
- `src/lib/sync/types.ts`
- `src/db/schema.ts`
- `packages/cf-worker-googlesheet/src/index.ts`
- `packages/cf-worker-googlesheet/src/lib/d1.ts`

当前操作先整体 JSON 序列化并 AES-GCM 加密，再作为一个完整 payload 上传。本方案只在加密之后切分 ciphertext，不切分明文，也不分别加密每个分片。

## 5. 保守大小限制

假设 Google 侧硬限制为 5000 字符/单元格，本方案使用保守值：

```ts
const MAX_SHEET_CELL_CHARS = 3000;
const MAX_CHUNK_CIPHERTEXT_CHARS = 2000;
const MAX_PUSH_REQUEST_BYTES = 64 * 1024;
```

规则：

- 最终加密 payload 序列化长度 `<= 3000`：使用普通完整操作。
- 最终加密 payload 序列化长度 `> 3000`：生成分片操作。
- 每个分片 ciphertext 默认不超过 2000 字符。
- 分片最终写入前必须验证 `JSON.stringify(chunkPayload).length <= 3000`。
- 如果分片元数据使结果超限，继续缩小当前分片。
- 单次 HTTP JSON body 不超过 64 KiB。

大小判断基于最终要写入服务商的字符串，不基于原始明文长度。AES-GCM 和 Base64 会增加体积。

## 6. 数据结构

### 6.1 完整操作

小内容继续使用现有结构：

```ts
{
  id: "operation-id",
  clientId: "client-id",
  table: "encrypted",
  type: "create",
  key: "operation-id",
  keyHash: "encryption-key-hash",
  timestamp: 1234567890,
  payload: {
    ciphertext: "base64-ciphertext",
    iv: "base64-iv"
  }
}
```

### 6.2 分片操作

大内容的每个分片仍放进现有 `ops` 数组，但使用保留表名和分片 payload：

```ts
{
  id: "operation-id:chunk:0",
  clientId: "client-id",
  table: "__sync_chunk__",
  type: "create",
  key: "operation-id",
  keyHash: "encryption-key-hash",
  timestamp: 1234567890,
  payload: {
    kind: "chunk-v1",
    operationId: "operation-id",
    chunkIndex: 0,
    chunkTotal: 4,
    iv: "base64-iv",
    ciphertext: "base64-ciphertext-fragment",
    ciphertextHash: "sha256-of-full-ciphertext",
    clientId: "client-id"
  }
}
```

`kind` 放在 payload 内，而不是只放在顶层，原因是当前服务端的 Zod schema 可能会剥离未知顶层字段。服务端和新客户端都应支持顶层 `clientId`，但 payload 中保留一份 `clientId` 作为旧服务端兼容和恢复扫描的后备信息。

## 7. 分片组合规则

组合关系由客户端切片时写入，不依赖上传顺序或服务端推断。

- `operationId` 是原始逻辑操作 ID，也是分片组 ID。
- `chunkIndex` 从 0 开始，表示分片位置。
- `chunkTotal` 表示完整分片数量。
- `id` 使用确定性格式：`operationId:chunk:chunkIndex`。
- 同一组所有分片必须拥有相同的 `operationId`、`chunkTotal`、`iv`、`keyHash`、`ciphertextHash` 和 `timestamp`。
- `ciphertextHash` 是完整 ciphertext 的 hash，不是单个片段的 hash。
- `(clientId, id)` 是服务端幂等键。

例如四个分片：

```text
operationId = op-123

op-123:chunk:0  index=0  total=4
op-123:chunk:1  index=1  total=4
op-123:chunk:2  index=2  total=4
op-123:chunk:3  index=3  total=4
```

## 8. 上传流程

客户端仍然调用现有 provider 的 `push(ops, clientId)`，不新增接口。

流程：

1. 读取本地 `synced: 0` 的逻辑操作。
2. 按现有规则选择加密密钥。
3. 对每个逻辑操作执行完整 AES-GCM 加密。
4. 测量最终完整 payload 的序列化大小。
5. 小内容保留原始完整操作。
6. 大内容生成多个 `__sync_chunk__` 操作。
7. 将完整操作和分片操作混合放入同一个 `ops` 请求数组。
8. 按 64 KiB 请求上限拆分请求，但不改变逻辑操作和分片 ID。
9. 所有生成的物理记录都成功后，provider 才返回对应的原始逻辑操作 ID。
10. `runPushFlow` 只将这些原始逻辑操作标记为 `synced: 1`。

如果任意分片上传失败，原始操作保持 `synced: 0`。重试会生成相同的分片 ID，由服务端幂等去重。

## 9. Push cursor 处理

一个逻辑操作可能产生多个物理记录，因此不能继续使用“当前 cursor + 逻辑操作数量”推导新 cursor。

第一版建议关闭现有 push cursor 优化：

- push 成功后不直接修改 `lastServerCursor`。
- 后续 pull 使用现有 cursor 拉取服务端新增记录。
- 自己上传的记录依靠正确保留的 `clientId` 过滤。

这是一个性能优化的删除，不影响同步正确性。后续如果有必要，可以让 provider 返回准确的物理新增记录数，再恢复安全的 cursor 优化。

## 10. 服务端处理

### 10.1 D1 Worker

继续使用现有 `/api/sync/push` 和 `/api/sync/pull`。

`operations` 表保存完整操作和分片操作，`UNIQUE (client_id, client_op_id)` 约束用于分片 ID 幂等。

需要补充：

- `__sync_chunk__` payload 的形状、身份和确定性 ID 校验。
- `client_id` 的完整读写。
- 相同分片 ID、相同内容时返回成功但不重复插入。
- 相同分片 ID、不同内容时返回冲突错误。
- push 响应明确返回本次接受的物理记录 ID，或在 provider 侧根据完整请求成功可靠判定。

不得把分片重组或解密放在服务端。

### 10.2 历史 Google Sheets 兼容

继续使用现有 `Operations` Sheet，不新增 Sheet。

分片元数据放在现有 payload 单元格的 JSON 中，确保每个 payload 单元格不超过 3000 字符。现有 `id` 列用于保存确定性 chunk ID。

需要补充：

- 解析并保留 `clientId`。
- 解析 `__sync_chunk__` payload。
- 使用 KV 或等效索引实现 chunk ID 幂等。
- 相同 ID、相同内容时跳过重复追加。
- 相同 ID、不同内容时返回冲突。
- 保持旧表头和已有数据兼容，不能通过重设表头破坏已有行。

如果 Google Sheets Worker 不能提供可靠幂等，客户端仍需在拉取时按 chunk ID 去重，但服务端重复行会增加日志体积，应记录告警。

## 11. 客户端拉取流程

客户端继续调用现有 `provider.pull(cursor, clientId)`，返回结果中可以同时包含完整操作和分片操作。

处理顺序：

1. 读取当前 `lastServerCursor`。
2. 拉取一页混合操作。
3. 在解密和 key lookup 之前识别 `__sync_chunk__`。
4. 分片记录写入本地 `syncChunks`。
5. 完整操作按现有流程筛选、解密和应用。
6. 在同一个 transaction 中持久化分片和 `lastServerCursor`。
7. 扫描本地 `syncChunks` 中已经收齐的分片组。
8. 按 index 排序并重组 ciphertext。
9. 校验完整 ciphertext hash。
10. 复用 `decryptOperation()` 解密。
11. 将完整操作和已重组操作按原始 timestamp 排序后应用。
12. 成功应用后删除对应的 `syncChunks` 记录。

分片可能跨越多个分页。单页中收到的数量不能作为完成依据；必须基于本地持久化后的索引集合判断。

## 12. 完整分片判定

对于 `chunkTotal = 4`，只有索引集合恰好为 `{0, 1, 2, 3}` 才完整。

不能只判断记录数量，因为以下情况都不完整：

```text
{0, 1, 3}       缺少 2
{0, 1, 1, 3}    有重复，仍缺少 2
{1, 2, 3}       缺少 0
```

完整条件：

- `chunkTotal` 有效且同组一致。
- 去重后的 index 数量等于 `chunkTotal`。
- index 覆盖 `0..chunkTotal-1`。
- `operationId`、`iv`、`keyHash`、`ciphertextHash` 和 timestamp 一致。
- 拼接后的 ciphertext hash 正确。
- AES-GCM 最终解密成功。

重复分片如果 ID 和内容相同，直接忽略；如果 ID 相同但内容不同，记录冲突并不应用。

## 13. 本地 Dexie 设计

在 `src/db/schema.ts` 增加新版本，例如 v19：

```text
syncChunks:
  id
  operationId
  [operationId+chunkIndex]
  receivedAt
```

分片表用于处理分页、重启、缺片和重复拉取，不能只使用内存缓存。

`SyncMetadata` 增加一次性恢复字段：

```ts
interface SyncMetadata {
  id: string;
  lastServerCursor?: string | number;
  lastSyncTimestamp: number;
  chunkRecoveryCursor?: string | number;
  chunkRecoveryCompleted?: boolean;
}
```

`chunkRecoveryCursor` 只在升级恢复期间使用，不是长期第二个同步 cursor。恢复完成后保留完成标记，cursor 可以清理。

## 14. 旧客户端升级后的恢复计划

### 14.1 为什么需要恢复

旧客户端可能已经推进 `lastServerCursor`，跳过了它无法理解的 `__sync_chunk__` 记录。新客户端不能只从现有 cursor 继续拉，否则错过的分片不会再次出现。

### 14.2 恢复触发

客户端保存本地同步协议版本，例如：

```text
syncProtocolVersion = 1
```

升级到支持分片的客户端后，如果发现：

```text
syncProtocolVersion < 2
chunkRecoveryCompleted !== true
```

启动一次历史分片恢复。

### 14.3 恢复步骤

1. 先扫描本地 `deferred_ops`。
2. 将其中 `table === "__sync_chunk__"` 的记录迁移到 `syncChunks`。
3. 初始化 `chunkRecoveryCursor` 为 0。
4. 使用现有 `/api/sync/pull` 从历史开始分页扫描。
5. 恢复阶段只保存 `__sync_chunk__` 记录，不重新应用普通完整操作。
6. 每页将分片和 `chunkRecoveryCursor` 在同一 transaction 中写入。
7. 浏览器崩溃后从已保存的 `chunkRecoveryCursor` 继续。
8. 扫描到服务端末尾后，处理本地已经收齐的分片组。
9. 解密、校验并按正常冲突规则应用。
10. 设置 `chunkRecoveryCompleted: true`。
11. 恢复完成后回到正常的 `lastServerCursor` 增量同步。

恢复阶段不能修改正常 `lastServerCursor`，避免影响普通增量同步。扫描过程中新产生的记录会在恢复完成后由正常 cursor 继续拉取。

### 14.4 旧客户端没有留下本地分片时

如果旧客户端因为没有密钥或其他原因直接跳过了分片，`deferred_ops` 中可能没有记录。历史扫描会从服务端重新获取这些分片，因此不依赖旧客户端本地是否保存过。

### 14.5 当前客户端自己的操作

分片中保留 `clientId` 和原始 `operationId`。恢复重组后：

- 如果是当前客户端自己已经存在且已同步的原操作，跳过重复应用。
- 如果是其他客户端的操作，按 timestamp 和现有冲突逻辑应用。
- 如果无法确认来源，优先依赖已有记录 timestamp 和业务表冲突保护，不直接覆盖更新的数据。

### 14.6 恢复前提和代价

历史恢复要求服务端保留同步日志。当前 D1 `operations` 是追加保存，满足该前提。

恢复代价是首次升级可能扫描完整历史日志。后续可以增加服务端按 `kind=chunk-v1` 过滤的查询优化，但不作为第一版必要接口；第一版优先使用现有 pull 接口保证协议简单。

如果未来服务端删除历史日志，必须另外增加快照或 manifest 机制，否则无法保证恢复已经被旧客户端跳过的分片。

## 15. 旧客户端兼容边界

本方案对旧客户端的保证是：

- 普通完整操作继续按旧格式同步。
- 分片记录不会应用到业务表。
- 旧客户端升级后，新客户端通过历史回放找回分片。

本方案不保证：

- 旧客户端本身能够读取和应用大内容。
- 旧客户端在没有任何密钥时会本地保存分片。
- 旧客户端不产生 `deferred_ops` 分片记录。

因此需要在发布说明或功能开关中明确：大内容同步要求客户端升级到支持分片的版本。

## 16. Cursor 和 pending count

本方案只有一个长期 cursor：

```text
lastServerCursor
```

该 cursor 表示服务端物理操作日志位置，包含完整操作和分片记录。

需要注意：

- 服务端 pending count 可能按物理记录数统计，一个逻辑操作会被计数多次。
- 第一版可以接受该显示偏差，客户端 push pending 仍按本地逻辑操作数统计。
- 后续如果需要准确显示逻辑操作数，再增加服务端按 operationId 去重统计。

## 17. 错误处理与幂等

客户端：

- 分片上传失败时不标记原操作已同步。
- 重试复用确定性分片 ID。
- 拉取到重复分片时本地去重。
- 同 ID 不同内容时记录错误，不覆盖已有分片。
- 不完整分片不解密、不应用、不立即删除。
- 完整分片应用成功后删除缓存。

D1 Worker：

- 使用 `(client_id, client_op_id)` 唯一约束。
- 对相同 ID 的相同内容返回幂等成功。
- 对相同 ID 的不同内容返回冲突。
- 读取时客户端再次按 ID 去重。

## 18. 实施顺序

1. 新增 `SyncChunkPayload` 类型和分片识别函数。
2. 新增纯函数：加密 payload 大小判断、分片、重组和完整性校验。
3. 增加 `syncChunks` Dexie 表和 v19 migration。
4. 修改 Worker schema 和 push/pull，使其接受同一 `ops` 数组中的分片记录。
5. 在 D1 `operations` 表保存和解析分片 payload。
6. 补充 `clientId` 保存和分片 ID 幂等。
7. 接入客户端上传：小内容原格式，大内容分片格式。
8. 接入单 cursor 混合拉取和本地分片缓存。
9. 关闭或改造 push cursor 优化，避免按逻辑操作数推导物理 cursor。
10. 实现旧客户端升级后的 deferred 迁移和历史分片回放。
11. 增加 feature flag，先验证普通操作，再开启大内容分片上传。
12. 运行质量检查：

```bash
pnpm compile
pnpm lint:fix
pnpm build
```

## 19. 测试计划

至少覆盖：

- 小 payload 保持旧格式。
- 大 payload 生成正确数量的分片。
- 每个最终 payload 不超过 3000 字符。
- 同一请求可以包含完整操作和分片操作。
- 分片乱序可以重组。
- 分片跨分页可以重组。
- 重复 index 不会被误判为完整。
- 缺失分片不会提前解密或应用。
- 错误 hash 或错误 ciphertext 不会应用。
- 上传超时重试不会重复产生逻辑数据。
- D1 `operations` 同一表 round-trip。
- 旧客户端遇到分片不会修改业务表。
- `deferred_ops` 中的旧分片可以迁移到 `syncChunks`。
- 升级恢复能从 cursor 0 找回旧客户端跳过的分片。
- 恢复过程中浏览器崩溃后可以从临时 recovery cursor 继续。
- 恢复不会重复应用普通完整操作。
- 恢复后的分片按 timestamp 应用。
- Dexie migration 不丢失已有数据。
- 单 cursor 下 push/pull 不会因物理分片数量导致 cursor 错误。

## 20. 第一版明确不做

- 新增分片专用 HTTP 接口。
- 第二个长期同步 cursor。
- 第二个 Google Sheets 工作表。
- 流式 AES 加密。
- 压缩。
- 并发分片上传。
- 服务端解密或重组业务内容。
- 服务端历史日志清理。
- 服务端按分片类型过滤的专用查询优化。

本方案的核心是用现有同步日志承载两种记录类型，客户端负责分片缓存和重组；用一次性历史回放弥补旧客户端已经推进 cursor 的情况。

## 21. 交付物

实施完成后应具备以下代码和验证结果：

- 客户端能把超限的加密操作转换为 `__sync_chunk__` 分片操作。
- 客户端能在同一个 push 请求中上传完整操作和分片操作，并按请求字节上限拆批。
- D1 Worker 能保存、返回、校验和幂等处理两种操作。
- 客户端新增 `syncChunks` 表，并完成 Dexie migration。
- 客户端能处理跨分页、乱序、重复和缺失分片。
- 客户端重启后能从本地缓存继续重组。
- 旧客户端升级后能从历史 cursor 0 回放并恢复已错过的分片。
- 正常同步只维护 `lastServerCursor` 一个长期 cursor。
- `pnpm compile`、`pnpm lint` 和 `pnpm build` 通过。

## 22. 验收标准

以下场景全部通过后，才认为本任务完成：

1. 发送小于或等于 3000 字符的加密 payload，服务端仍按旧完整操作保存和返回。
2. 发送超过 3000 字符的加密 payload，所有分片最终写入的 payload 单元格都不超过 3000 字符。
3. 一个请求同时包含完整操作和分片操作时，D1 Worker 能正确保存并返回。
4. 分片按任意顺序、跨多个 pull 分页返回时，客户端能收齐并正确解密原始业务操作。
5. 缺失任意一个 index 时，客户端不会解密、应用或删除该分片组。
6. 同一个分片重复上传或重复拉取时，不会重复写入或重复应用。
7. 相同分片 ID 但内容不同会被拒绝，并留下可诊断日志。
8. 上传任意分片失败时，原始逻辑操作仍为 `synced: 0`，下一次 push 能补传。
9. 客户端在保存分片后崩溃，重启后能从 `syncChunks` 继续完成重组。
10. 旧客户端已经推进 cursor 并跳过分片时，新客户端升级恢复能从历史日志找回分片。
11. 升级恢复过程崩溃后，可以从 `chunkRecoveryCursor` 继续，且不会重复应用普通完整操作。
12. 当前客户端自己的历史分片恢复不会重复覆盖已有较新业务数据。
13. 普通完整操作和重组后的分片操作按原始 timestamp 参与同一套冲突处理。
14. 服务端 pending count 即使按物理记录计数，也不会影响实际同步正确性。
15. 现有旧接口地址没有变化，旧客户端同步普通操作不受影响。

## 23. 推荐实施命令

从项目根目录执行，包管理器必须使用 pnpm：

```bash
pnpm compile
pnpm lint
pnpm build
```

如果新增或修改测试，先运行最小范围测试，再执行上述完整检查。不要执行 npm/yarn，也不要修改全局环境或安装全局依赖。
