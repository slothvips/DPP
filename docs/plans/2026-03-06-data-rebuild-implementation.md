# 数据重建功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 在设置页面添加「数据重建」功能，允许用户清空本地数据并从服务器拉取完整数据。

**Architecture:** 在设置页面的「数据管理」区域添加一个 Secondary 按钮，点击后弹出确认对话框，用户确认后执行 `clearAllData()` + `pull()` 重建数据。

**Tech Stack:** React, TypeScript, SyncEngine, Dexie.js

---

## Task 1: 读取并理解现有代码结构

**Files:**
- Read: `src/entrypoints/options/main.tsx`
- Read: `src/features/settings/components/SyncKeyManager.tsx` (参考 getSyncEngine 用法)
- Read: `src/lib/sync/SyncEngine.ts:653-683` (clearAllData 方法)

**Step 1: 读取相关文件**

```bash
# 已经读取完成，以下是关键信息：
# - getSyncEngine 从 @/db 导入
# - confirm 函数用法: confirm(message, title, type)
# - clearAllData() 返回 void，pull() 返回 Promise<void>
```

---

## Task 2: 添加数据重建按钮

**Files:**
- Modify: `src/entrypoints/options/main.tsx:490-518` (数据管理区域)

**Step 1: 导入 getSyncEngine**

在文件顶部 import 部分添加:
```typescript
import { getSyncEngine } from '@/db';
```

**Step 2: 在数据管理区域添加按钮**

在导出/导入按钮旁边添加重建按钮:
```tsx
<Button
  onClick={rebuildLocalData}
  variant="outline"
  className="gap-2"
  data-testid="button-rebuild"
>
  <AlertTriangle className="w-4 h-4" />
  重建本地数据
</Button>
```

需要添加 AlertTriangle 图标导入:
```typescript
import { AlertTriangle, Download, Upload } from 'lucide-react';
```

---

## Task 3: 实现重建逻辑

**Files:**
- Modify: `src/entrypoints/options/main.tsx` (添加 rebuildLocalData 函数)

**Step 1: 添加 rebuildLocalData 函数**

在 `clearData` 函数附近添加:
```typescript
const rebuildLocalData = async () => {
  const confirmed = await confirm(
    '此操作将清空所有本地数据并从服务器拉取最新数据。如果您有未同步到服务器的本地数据，这些数据将会丢失。\n\n⚠️ 警告：为避免服务器压力，请仅在您的数据与至少两名团队成员不一致时使用此功能。',
    '确认重建本地数据',
    'danger'
  );

  if (confirmed) {
    try {
      toast('正在重建数据...', 'info');

      const engine = await getSyncEngine();
      await engine.clearAllData();
      await engine.pull();

      toast('数据重建成功', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      logger.error('[DataRebuild] Failed:', error);
      toast('数据重建失败: ' + (error as Error).message, 'error');
    }
  }
};
```

---

## Task 4: 验证实现

**Step 1: 运行类型检查**

```bash
pnpm compile
```

**Step 2: 运行代码检查**

```bash
pnpm lint
```

**Step 3: 功能测试**

1. 打开设置页面
2. 找到「数据管理」区域的「重建本地数据」按钮
3. 点击按钮，确认对话框应该出现
4. 点击确认，数据应该被清空并重新拉取

---

## 关键文件路径

| 文件 | 行号 | 说明 |
|------|------|------|
| `src/entrypoints/options/main.tsx` | 31 | import 区域 |
| `src/entrypoints/options/main.tsx` | 497 | 数据管理按钮区域 |
| `src/entrypoints/options/main.tsx` | 340 | clearData 函数位置 |
| `src/lib/sync/SyncEngine.ts` | 653 | clearAllData 方法 |
| `src/lib/sync/SyncEngine.ts` | 352 | pull 方法 |
