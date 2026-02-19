# 模型无关的工具调用规则重构计划

## 背景(Context)

当前项目中的工具调用实现存在以下问题：

1. **与模型特性绑定** - 依赖各模型(OpenAI/Anthropic/Ollama)的原生工具调用能力，不同模型格式不同
2. **提示词格式不标准** - 使用 `<tool_call>` XML 格式，模型可能不完全遵循
3. **缺乏统一的调用协议** - 没有通过提示词与模型建立清晰的工具调用共识

## 目标

创建一个**模型无关的工具调用规则**，通过提示词让模型与工具调用规则达成共识，使任何模型都能一致地调用工具。

## 核心设计

### 1. 统一的工具调用协议

采用结构化的 JSON 代码块作为工具调用约定：

```json
// 在回复中使用这个格式调用工具
{
  "action": "tool_call",
  "name": "tool_name",
  "arguments": {
    "arg1": "value1",
    "arg2": "value2"
  }
}
```

**为什么选择 JSON 代码块格式：**
- 格式清晰，模型容易理解和遵循
- JSON 解析在 JavaScript 中天然支持
- 结构化程度高，不易产生歧义
- 可以在流式输出中逐步累积并解析

### 2. 三层提示词架构

- **基础规则层** - 工具调用格式、参数格式、响应规则
- **工具描述层** - 动态生成的工具列表和参数说明
- **行为指导层** - 操作分类(查询/写入/危险)与确认机制

### 3. 关键文件修改

| 文件 | 修改内容 |
|------|----------|
| `src/lib/ai/prompt.ts` | 重构提示词，定义工具调用协议格式 |
| `src/lib/ai/tools.ts` | 移除对模型原生工具调用的依赖 |
| `src/lib/ai/provider.ts` | 简化工具传递，改为提示词内嵌 |
| `src/lib/ai/response-parser.ts` | **(新增)** 响应解析器 |
| `src/features/aiAssistant/hooks/useAIChat.ts` | 修改工具调用解析逻辑 |

## 实现步骤

### Step 1: 创建响应解析器 (response-parser.ts)

新建 `src/lib/ai/response-parser.ts`：

```typescript
interface ParsedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

interface ParseResult {
  type: 'tool_call' | 'text' | 'mixed';
  toolCall?: ParsedToolCall;
  text: string;
}

/**
 * 从模型输出中解析工具调用
 * 支持流式和完整响应
 */
export function parseResponse(content: string): ParseResult

/**
 * 检查内容是否包含工具调用
 */
export function containsToolCall(content: string): boolean

/**
 * 从累积的内容中提取完整的 JSON 对象
 */
export function extractJSONBlock(content: string): string | null
```

### Step 2: 重构提示词 (prompt.ts)

```
## Tool Call Protocol

When you need to use a tool, use this exact JSON format in a code block:

```json
{
  "action": "tool_call",
  "name": "tool_name",
  "arguments": {
    "arg1": "value1"
  }
}
```

Rules:
1. Always use a code block with ```json
2. Set "action" to "tool_call"
3. "name" must be exactly one of the available tools
4. "arguments" must be valid JSON matching the tool's parameters
5. Do not add any other text outside the code block when making a tool call
6. After receiving tool results, respond naturally to the user

## Available Tools
[动态生成的工具列表]

## Tool Usage Rules
1. Query operations: 直接执行
2. Write operations: 直接执行
3. Dangerous operations: 需要用户确认
```

### Step 3: 修改工具注册 (tools.ts)

- 移除 `AIToolDefinition` 格式的导出（不再传给模型 API）
- 保留内部工具定义用于执行
- 添加 `getToolDescriptions()` 方法生成人类可读的描述

### Step 4: 修改 Provider (provider.ts)

- 移除 `tools` 参数的传递
- 工具定义完全通过系统提示词传递给模型

### Step 5: 修改 Chat Hook (useAIChat.ts)

- 使用新的 `response-parser` 解析模型响应
- 从 `action: "tool_call"` 格式中提取工具调用
- 执行工具并返回结果

```typescript
// 解析响应
const parsed = parseResponse(responseContent);

if (parsed.type === 'tool_call' && parsed.toolCall) {
  // 执行工具
  const result = await toolRegistry.execute(
    parsed.toolCall.name,
    parsed.toolCall.arguments
  );
  // 返回结果给模型
}
```

## 验证方式

1. 运行 `pnpm dev` 启动开发服务器
2. 打开扩展的 AI Assistant 面板
3. 发送需要调用工具的消息（如"列出所有链接"、"添加一个标签 test"）
4. 验证：
   - 模型是否按 JSON 格式返回工具调用
   - 工具是否正确执行
   - 结果是否正确返回给模型并生成最终回复

## 关键设计决策

1. **完全移除模型原生工具调用** - 不再传递 `tools` 参数给任何模型 API
2. **使用 JSON 代码块格式** - 结构化且易于解析
3. **流式输出兼容** - 解析器支持流式累积 JSON

## 优势

1. **模型无关** - 不依赖任何模型的原生工具调用能力
2. **一致性** - 统一的提示词规则，所有模型遵循相同协议
3. **可预测性** - 通过解析器精确控制工具调用流程
4. **可扩展性** - 容易添加新的工具和规则
