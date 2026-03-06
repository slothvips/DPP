# AI 助手 Markdown 渲染支持

## Context

当前 AI 助手的消息以纯文本形式渲染（使用 `whitespace-pre-wrap`），不支持 Markdown 语法。用户希望 AI 助手能像黑板一样渲染 Markdown 内容。

## 实现方案

直接替换为 ReactMarkdown 组件，与黑板保持一致。

## Plan

### 1. 修改消息渲染组件

**文件**: `src/features/aiAssistant/components/AIAssistantView.tsx`

- 添加导入:
  ```typescript
  import ReactMarkdown from 'react-markdown';
  import remarkGfm from 'remark-gfm';
  ```

- 修改第 234 行，将:
  ```tsx
  <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
  ```
  替换为:
  ```tsx
  <ReactMarkdown className="text-sm prose prose-sm dark:prose-invert" remarkPlugins={[remarkGfm]}>
    {message.content}
  </ReactMarkdown>
  ```

### 2. 更新系统提示词

**文件**: `src/lib/ai/prompt.ts`

- 位置1（第 42-53 行）：在项目背景中添加 AI 助手支持 Markdown 的说明
- 位置2（第 224-232 行）：在 Capabilities 中添加 Markdown 支持说明

### 3. 验证

- 运行 `pnpm compile` 检查 TypeScript 类型
- 运行 `pnpm lint` 检查代码风格

## Files

- `src/features/aiAssistant/components/AIAssistantView.tsx` - 修改消息渲染
- `src/lib/ai/prompt.ts` - 更新系统提示词

## 依赖

- `react-markdown` - 已安装（黑板使用）
- `remark-gfm` - 已安装（黑板使用）
