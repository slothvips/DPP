# 远程操作归档功能实现计划

## Context

当前同步引擎在拉取远程操作后，只将操作应用到本地数据表（links, tags, blackboard 等），但不保存远程操作的记录。这导致用户无法通过 `get_recent_activities` 工具查看其他设备的操作记录。

本计划旨在：

1. 新增一张表用于归档远程操作
2. 修改 SyncEngine，在拉取远程操作时保存到归档表
3. 修改 `get_recent_activities` 工具，支持查询归档的远程操作

---

## 设计

### 1. 新增数据库表

**文件**: `src/db/types.ts`, `src/db/index.ts`

新增 `remoteActivityLog` 表：

```typescript
// 类型定义 (types.ts)
export interface RemoteActivityLog {
  id: string;
  clientId: string;
  table: string;
  type: 'create' | 'update' | 'delete';
  timestamp: number;
  payload?: unknown;
  receivedAt: number;
}

// 表定义 (index.ts)
remoteActivityLog: 'id, clientId, table, type, timestamp, receivedAt';
```

### 2. 修改 SyncEngine

**文件**: `src/lib/sync/SyncEngine.ts`

在拉取远程操作后（validOps 应用到本地数据表之后），将远程操作保存到归档表：

```typescript
// 在 validOps 应用到本地数据表之后，添加：
if (validOps.length > 0) {
  await this.db.table('remoteActivityLog').bulkAdd(
    validOps.map((op) => ({
      id: op.id,
      clientId: op.clientId,
      table: op.table,
      type: op.type,
      timestamp: op.timestamp,
      payload: op.payload,
      receivedAt: Date.now(),
    }))
  );
}
```

位置大约在第 440-442 行（syncMetadata 更新之后）。

### 3. 修改 getRecentActivities 工具

**文件**: `src/lib/ai/tools/getRecentActivities.ts`

修改查询逻辑，同时查询 `operations` 表和 `remoteActivityLog` 表：

```typescript
// 查询本地操作
const localOps = await db.operations.where('timestamp').between(startTime, now).toArray();

// 查询远程操作
const remoteOps = await db.remoteActivityLog.where('timestamp').between(startTime, now).toArray();

// 合并结果并添加来源标识
const activities = [
  ...localOps.map((op) => ({ ...op, source: 'local' })),
  ...remoteOps.map((op) => ({ ...op, source: 'remote' })),
];
```

### 4. 更新 AI Prompt

**文件**: `src/lib/ai/prompt.ts`

在 Example 5 中添加说明：

- 远程操作也包含在结果中
- 可以看到其他设备的操作记录（包括 clientId）

---

## 变更文件

1. `src/db/types.ts` - 添加 RemoteActivityLog 类型
2. `src/db/index.ts` - 添加 remoteActivityLog 表定义
3. `src/lib/sync/SyncEngine.ts` - 在拉取远程操作后保存到归档表
4. `src/lib/ai/tools/getRecentActivities.ts` - 同时查询本地和远程操作
5. `src/lib/ai/prompt.ts` - 添加说明

---

## 验证

1. 运行 `pnpm compile` 检查类型
2. 运行 `pnpm lint` 检查代码风格
3. 运行 `pnpm build` 构建扩展
4. 测试步骤：
   - 在设备 A 添加一个链接
   - 等待同步到设备 B
   - 在设备 B 使用 AI 助手查询"查看最近的操作"
   - 验证能看到设备 A 的操作记录
