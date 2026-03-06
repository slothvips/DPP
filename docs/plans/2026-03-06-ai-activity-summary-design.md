# AI 助手操作记录摘要功能设计

## 概述

让 AI 助手能够解读最近一段时间（最多 15 天）的操作记录，使用自然语言向用户描述这段时间发生了哪些修改。

## 需求

- **时间范围**: 用户自定义，最长 15 天
- **数据来源**: 现有 sync operations 表
- **粒度**: 中等粒度 - 包含主要内容但简化细节
- **触发方式**: 自然语言触发（用户说"查看最近7天的操作"等）
- **实现方式**: 新增 AI 工具

## 设计

### 1. 新增 AI 工具

**工具名称**: `get_recent_activities`

**参数**:
- `days`: number (1-15, required) - 查询最近多少天的操作

**返回数据格式**:
```typescript
{
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
  activities: Array<{
    type: 'create' | 'update' | 'delete';
    table: string;
    timestamp: number;
    description: string;
  }>;
}
```

### 2. 实现逻辑

1. 接收 days 参数，验证范围（1-15）
2. 计算时间范围：`endTime = Date.now()`, `startTime = endTime - days * 24 * 60 * 60 * 1000`
3. 查询 `db.operations` 表，按 timestamp 降序排序
4. 过滤出指定时间范围内的操作（startTime <= timestamp <= endTime）
5. 统计总数和分类
6. 生成简化描述（提取关键信息如名称、URL 等）
7. 返回结构化数据

### 3. 描述生成规则

| 操作类型 | 描述模板 |
|---------|---------|
| links create | 添加了链接 "{name}" |
| links update | 更新了链接 "{name}" |
| links delete | 删除了链接 |
| tags create | 创建了标签 "{name}" |
| tags update | 更新了标签 "{name}" |
| tags delete | 删除了标签 "{name}" |
| blackboard create | 添加了便签 |
| blackboard update | 更新了便签 |
| blackboard delete | 删除了便签 |

### 4. System Prompt 更新

在 `src/lib/ai/prompt.ts` 中添加：

- 工具定义
- 使用场景说明
- 返回数据解读指南

### 5. 无需新增 UI

依赖自然语言触发，用户可以直接说"查看最近 X 天的操作"。

## 变更文件

- `src/lib/ai/tools/index.ts` - 添加新工具
- `src/lib/ai/prompt.ts` - 更新 system prompt
