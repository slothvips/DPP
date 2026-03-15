# AI 助手操作记录摘要功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 AI 助手能够解读最近一段时间（最多 15 天）的操作记录，使用自然语言向用户描述这段时间发生了哪些修改。

**Architecture:** 新增一个 AI 工具 `get_recent_activities`，通过查询 sync operations 表获取用户操作记录，返回结构化数据给 AI 助手生成自然语言摘要。

**Tech Stack:** TypeScript, Dexie.js (IndexedDB), React

---

## Task 1: 创建测试文件

**Files:**

- Create: `src/lib/ai/tools/__tests__/getRecentActivities.test.ts`

**Step 1: 编写测试文件**

```typescript
import { getRecentActivities } from '../getRecentActivities';

describe('getRecentActivities', () => {
  beforeEach(async () => {
    // 清理测试数据
    await db.operations.clear();
  });

  test('应返回指定天数的操作记录', async () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // 添加测试数据
    await db.operations.bulkAdd([
      {
        id: '1',
        table: 'links',
        type: 'create',
        key: { id: 'link1' },
        payload: { name: 'Google', url: 'https://google.com' },
        timestamp: now,
        synced: 1,
      },
      {
        id: '2',
        table: 'tags',
        type: 'create',
        key: { id: 'tag1' },
        payload: { name: '工作', color: '#3b82f6' },
        timestamp: now - day,
        synced: 1,
      },
    ]);

    const result = await getRecentActivities({ days: 1 });

    expect(result.summary.total).toBe(1);
    expect(result.summary.byTable.links).toBe(1);
  });

  test('应限制最大天数为 15', async () => {
    await expect(getRecentActivities({ days: 16 })).rejects.toThrow('最大支持 15 天');
  });

  test('应限制最小天数为 1', async () => {
    await expect(getRecentActivities({ days: 0 })).rejects.toThrow('最少查询 1 天');
  });

  test('应正确分组统计操作类型', async () => {
    const now = Date.now();

    await db.operations.bulkAdd([
      {
        id: '1',
        table: 'links',
        type: 'create',
        key: { id: 'link1' },
        payload: {},
        timestamp: now,
        synced: 1,
      },
      {
        id: '2',
        table: 'links',
        type: 'delete',
        key: { id: 'link2' },
        payload: {},
        timestamp: now,
        synced: 1,
      },
    ]);

    const result = await getRecentActivities({ days: 1 });

    expect(result.summary.byType.create).toBe(1);
    expect(result.summary.byType.delete).toBe(1);
  });

  test('应生成正确的描述', async () => {
    const now = Date.now();

    await db.operations.bulkAdd([
      {
        id: '1',
        table: 'links',
        type: 'create',
        key: { id: 'link1' },
        payload: { name: 'Google', url: 'https://google.com' },
        timestamp: now,
        synced: 1,
      },
    ]);

    const result = await getRecentActivities({ days: 1 });

    expect(result.activities[0].description).toBe('添加了链接 "Google"');
  });
});
```

**Step 2: 运行测试验证失败**

Run: `pnpm test src/lib/ai/tools/__tests__/getRecentActivities.test.ts`
Expected: FAIL - 函数未定义

---

## Task 2: 实现 getRecentActivities 函数

**Files:**

- Create: `src/lib/ai/tools/getRecentActivities.ts`

**Step 1: 实现函数**

```typescript
import { db } from '@/db';

interface ActivityDescription {
  type: 'create' | 'update' | 'delete';
  table: string;
  timestamp: number;
  description: string;
}

interface ActivitiesResult {
  period: {
    days: number;
    startTime: number;
    endTime: number;
  };
  summary: {
    total: number;
    byType: {
      create: number;
      update: number;
      delete: number;
    };
    byTable: {
      links: number;
      tags: number;
      blackboard: number;
      jobTags: number;
      linkTags: number;
    };
  };
  activities: ActivityDescription[];
}

const TABLE_LABELS: Record<string, string> = {
  links: '链接',
  tags: '标签',
  blackboard: '便签',
  jobTags: 'Job 标签',
  linkTags: '链接标签',
};

function generateDescription(type: string, table: string, payload: unknown): string {
  const p = (payload as Record<string, unknown>) || {};
  const name = (p.name as string) || '';

  switch (type) {
    case 'create':
      if (table === 'links' && name) return `添加了链接 "${name}"`;
      if (table === 'tags' && name) return `创建了标签 "${name}"`;
      if (table === 'blackboard') return '添加了便签';
      return `创建了 ${TABLE_LABELS[table] || table}`;
    case 'update':
      if (table === 'links' && name) return `更新了链接 "${name}"`;
      if (table === 'tags' && name) return `更新了标签 "${name}"`;
      if (table === 'blackboard') return '更新了便签';
      return `更新了 ${TABLE_LABELS[table] || table}`;
    case 'delete':
      if (table === 'links') return '删除了链接';
      if (table === 'tags') return '删除了标签';
      if (table === 'blackboard') return '删除了便签';
      return `删除了 ${TABLE_LABELS[table] || table}`;
    default:
      return `${type} 了 ${TABLE_LABELS[table] || table}`;
  }
}

export async function getRecentActivities({ days }: { days: number }): Promise<ActivitiesResult> {
  // 验证参数
  if (days < 1 || days > 15) {
    throw new Error('天数必须在 1-15 之间');
  }

  const now = Date.now();
  const startTime = now - days * 24 * 60 * 60 * 1000;

  // 查询操作记录
  const operations = await db.operations.where('timestamp').between(startTime, now).toArray();

  // 按类型和表统计
  const summary = {
    total: operations.length,
    byType: { create: 0, update: 0, delete: 0 },
    byTable: {
      links: 0,
      tags: 0,
      blackboard: 0,
      jobTags: 0,
      linkTags: 0,
    },
  };

  const activities: ActivityDescription[] = [];

  for (const op of operations) {
    // 统计
    if (op.type === 'create' || op.type === 'update' || op.type === 'delete') {
      summary.byType[op.type]++;
    }
    const table = op.table as keyof typeof summary.byTable;
    if (table in summary.byTable) {
      summary.byTable[table]++;
    }

    // 生成描述
    activities.push({
      type: op.type as 'create' | 'update' | 'delete',
      table: op.table,
      timestamp: op.timestamp,
      description: generateDescription(op.type, op.table, op.payload),
    });
  }

  return {
    period: {
      days,
      startTime,
      endTime: now,
    },
    summary,
    activities,
  };
}
```

**Step 2: 运行测试验证通过**

Run: `pnpm test src/lib/ai/tools/__tests__/getRecentActivities.test.ts`
Expected: PASS

**Step 3: 提交代码**

```bash
git add src/lib/ai/tools/getRecentActivities.ts src/lib/ai/tools/__tests__/getRecentActivities.test.ts
git commit -m "feat(ai): 添加 getRecentActivities 工具用于查询操作记录"
```

---

## Task 3: 注册工具到 AI 工具系统

**Files:**

- Modify: `src/lib/ai/tools/index.ts`

**Step 1: 查看现有工具注册方式**

Run: `cat src/lib/ai/tools/index.ts`
找到工具注册的模式

**Step 2: 注册新工具**

在工具列表中添加：

```typescript
import { getRecentActivities } from './getRecentActivities';

// 在工具定义中添加
{
  name: 'get_recent_activities',
  description: '获取最近一段时间的用户操作记录，用于回答"最近做了什么"等问题',
  parameters: {
    type: 'object',
    properties: {
      days: {
        type: 'number',
        description: '查询最近多少天的操作记录，范围 1-15',
      },
    },
    required: ['days'],
  },
  execute: async ({ days }) => {
    const result = await getRecentActivities({ days });
    return result;
  },
},
```

**Step 3: 编译检查**

Run: `pnpm compile`
Expected: 无错误

**Step 4: 提交代码**

```bash
git add src/lib/ai/tools/index.ts
git commit -m "feat(ai): 注册 get_recent_activities 工具"
```

---

## Task 4: 更新 System Prompt

**Files:**

- Modify: `src/lib/ai/prompt.ts`

**Step 1: 在工具说明部分添加**

在 toolDescriptions 之后添加：

```typescript
### Activity Summary Tool

When users ask about recent activities like "查看最近的操作", "最近做了什么", "这段时间有什么变化":
1. Call get_recent_activities with appropriate days parameter (1-15)
2. Analyze the returned summary and activities
3. Provide a natural language summary to the user

The tool returns:
- summary.total: total number of operations
- summary.byType: breakdown by operation type (create/update/delete)
- summary.byTable: breakdown by data table
- activities: list of individual operations with descriptions
```

**Step 2: 编译检查**

Run: `pnpm compile`

**Step 3: 提交代码**

```bash
git add src/lib/ai/prompt.ts
git commit -m "feat(ai): 更新 prompt 支持操作记录摘要功能"
```

---

## Task 5: 验证

**Step 1: 构建扩展**

Run: `pnpm build`

**Step 2: 刷新扩展并测试**

1. 打开 Chrome 扩展管理页面，刷新 DPP 扩展
2. 打开 AI 助手
3. 输入"查看最近 3 天的操作"
4. 验证 AI 正确调用工具并返回摘要

**Step 3: 最终提交**

```bash
git add docs/plans/2026-03-06-ai-activity-summary-design.md
git commit -m "feat(ai): 添加操作记录摘要功能

- 新增 getRecentActivities 工具查询 sync operations 表
- 支持查询 1-15 天的操作记录
- 返回结构化数据供 AI 生成自然语言摘要"
```
