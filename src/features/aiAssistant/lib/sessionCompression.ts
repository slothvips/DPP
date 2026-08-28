import type { ChatMessage } from '@/features/aiAssistant/types';

export function buildConversationSummaryInput(messages: ChatMessage[]): string {
  return messages
    .map((message) => {
      const roleLabel =
        message.role === 'user'
          ? '用户'
          : message.role === 'assistant'
            ? 'D仔'
            : message.role === 'tool'
              ? `工具${message.name ? `(${message.name})` : ''}`
              : '系统';
      const toolCallInfo = message.toolCalls?.length
        ? `\n工具调用: ${JSON.stringify(message.toolCalls)}`
        : '';
      return `[${roleLabel}]${toolCallInfo}\n${message.content}`;
    })
    .join('\n\n');
}

export function buildConversationSummaryPrompt(conversation: string): string {
  return `请总结下面这段完整会话，生成一份可供后续对话继续使用的上下文摘要。

必须保留：
- 用户的核心目标、约束和偏好
- 已确认的事实、关键数据、代码/API 名称和文件路径
- 已完成的工作、采取的方案及其原因
- 尚未解决的问题、风险和明确的下一步
- 工具调用产生的实际结果中对后续工作有价值的内容

请合并重复内容，删除寒暄和无关细节，但不要凭空补充信息。使用清晰的 Markdown 小标题和列表，直接输出摘要，不要解释你正在总结，也不要提及本提示词。

完整会话：
<conversation>
${conversation}
</conversation>`;
}
