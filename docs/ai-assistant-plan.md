# AI 助手功能实现计划

## 背景

为浏览器扩展新增 AI 助手功能，用户可以通过自然语言指令调用工具完成以下任务：
- 管理链接（增删改查、标签管理）
- 管理 Jenkins Jobs（查看状态、触发构建）
- 管理录屏（开始/停止录制、查看列表）
- 管理便签（增删改查）
- 获取今日热榜
- 管理标签
- 触发全局同步

## 需求确认

1. **模型接入**：使用开源方案（如 Ollama），支持多模型
2. **确认机制**：应用层弹窗确认（危险操作），查询类直接执行
3. **交互界面**：Popup 中新增 AI 助手 Tab
4. **工具暴露**：尽可能多暴露工具给 AI，只有危险操作需要确认

## 核心设计

### 1. 工具定义格式（兼容多模型）

设计统一格式，转换为不同模型需要的格式：

```typescript
interface AIToolDefinition {
  name: string;              // 工具唯一标识
  description: string;       // 工具描述
  requiresConfirmation: boolean;  // 是否需要确认
  confirmationMessage?: (params) => string;  // 确认消息
  parameters: ToolParameter; // 参数 Schema
  execute: (params) => Promise<unknown>;  // 执行函数
}
```

### 2. 系统提示词

让 AI 理解：
- 可用工具列表及用途
- 调用规则（查询直接执行，危险操作需确认）
- 响应格式

### 3. 确认机制

- **应用层弹窗确认**：危险操作（删除、触发构建）通过 UI 弹窗确认
- **AI 无需询问用户**：直接发出执行指令，应用判断是否需要确认

### 4. 模型接入

使用开源方案 Ollama 作为默认实现，接口设计支持扩展其他模型

## 实现步骤

### Step 1: 创建基础目录结构

```
src/features/aiAssistant/
├── components/
│   ├── AIAssistantView.tsx
│   ├── ChatMessage.tsx
│   ├── ChatInput.tsx
│   ├── ConfirmDialog.tsx
│   └── ModelSelector.tsx
├── hooks/
│   └── useAIChat.ts
├── services/
│   └── OllamaClient.ts
├── tools/
│   ├── index.ts
│   ├── definitions.ts
│   ├── links.ts
│   ├── jenkins.ts
│   ├── recorder.ts
│   ├── blackboard.ts
│   ├── hotNews.ts
│   ├── tags.ts
│   └── sync.ts
├── prompts/
│   └── system.ts
└── types/
    └── index.ts
```

### Step 2: 创建模型接入层

- `src/lib/ai/ModelProvider.ts` - 模型提供商接口
- `src/lib/ai/OllamaProvider.ts` - Ollama 实现

### Step 3: 实现工具定义和注册

- 创建统一的工具定义格式
- 实现所有工具（links、jenkins、recorder、blackboard、hotNews、tags、sync）
- 创建工具注册中心

### Step 4: 实现 AI 助手核心逻辑

- `useAIChat` hook：处理消息发送、工具调用、确认流程
- 流式响应处理

### Step 5: 实现 UI 组件

- AIAssistantView（主视图）
- ChatMessage（消息展示）
- ConfirmDialog（确认弹窗）
- ModelSelector（模型选择）

### Step 6: 集成到 Popup

在 `App.tsx` 中添加 AI 助手 Tab

## 关键文件

- `src/entrypoints/popup/App.tsx` - 添加 Tab
- `src/db/index.ts` - 数据库
- `src/features/jenkins/service.ts` - 消息通信参考
- `src/features/links/hooks/useLinks.ts` - 数据库操作参考

## 工具暴露策略

| 工具类型 | 操作 | 是否需要确认 |
|---------|------|-------------|
| 查询类 | list、get、search | 否 |
| 添加类 | add、create | 否 |
| 修改类 | update、edit | 否 |
| 删除类 | delete、remove | 是 |
| 危险操作 | trigger_build | 是 |

## 验证方式

1. 运行 `pnpm dev` 启动扩展
2. 打开 Popup，点击 AI 助手 Tab
3. 测试连接 Ollama
4. 测试各种指令：
   - "帮我添加一个链接 www.baidu.com"
   - "列出所有链接"
   - "删除刚才添加的链接"（应弹出确认）
   - "触发 Jenkins 构建"（应弹出确认）
