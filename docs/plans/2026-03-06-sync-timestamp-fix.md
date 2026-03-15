# 修复 Pull 冲突解决使用错误的时间戳字段

## Context

当前 pull 操作在冲突解决时使用 `serverTimestamp ?? timestamp`，但根据 LWW (Last Write Wins) 策略，应该始终使用本地 `timestamp`（客户端时间戳），因为：

- 团队已提前沟通保证时间一致
- 本地最后编辑的内容应该胜出

## 修改内容

### 文件：`src/lib/sync/SyncEngine.ts`

**第509行** - 修改冲突解决逻辑：

```typescript
// 当前代码（错误）
const opTimestamp = op.serverTimestamp ?? op.timestamp;

// 修改后（正确）
const opTimestamp = op.timestamp;
```

## 验证方式

1. 运行 `pnpm compile` 检查 TypeScript 类型
2. 运行 `pnpm lint` 检查代码风格
