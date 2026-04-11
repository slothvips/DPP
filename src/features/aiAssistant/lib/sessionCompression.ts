import type { ChatMessage } from '@/features/aiAssistant/types';

export function countToolMessages(messages: ChatMessage[]) {
  return messages.filter((message) => message.role === 'tool').length;
}

export function buildCompressedConversationText(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => {
      const roleLabel = message.role === 'user' ? '用户' : '助手';
      return `${roleLabel}: ${message.content}`;
    })
    .join('\n\n');
}

export function buildCompressionSummaryMessage(compressedMessages: string, toolCallCount: number) {
  return `【压缩说明】
本会话已对原始对话进行压缩处理：
- 跳过了 ${toolCallCount} 条工具调用结果（AI 的反馈中已包含关键信息）
- 保留了用户问题和 AI 的最终回应

【对话概要】
${compressedMessages.slice(0, 2000)}${compressedMessages.length > 2000 ? '\n\n(对话过长，已截断)' : ''}`;
}

export function buildCompressedConversationArchive(compressedMessages: string) {
  return `【完整对话（压缩后）】\n\n${compressedMessages}`;
}
