import type { ChatMessage } from '@/features/aiAssistant/types';
import { redactSensitiveJsonObject } from '@/utils/sensitive';

function getReasoningContent(message: ChatMessage): string {
  if (message.providerMetadata?.openAIReasoningContent) {
    return message.providerMetadata.openAIReasoningContent;
  }

  return (message.providerMetadata?.anthropicContentBlocks || [])
    .filter(
      (block): block is { type: 'thinking'; thinking: string } =>
        typeof block === 'object' &&
        block !== null &&
        'type' in block &&
        block.type === 'thinking' &&
        'thinking' in block &&
        typeof block.thinking === 'string'
    )
    .map((block) => block.thinking)
    .join('\n');
}

export function exportChatToMarkdown(
  messages: ChatMessage[],
  sessionTitle: string,
  currentRoleTitle?: string
): string {
  const lines: string[] = [];

  const now = new Date();
  lines.push(`# ${sessionTitle}`);
  lines.push('');
  lines.push(`> 导出时间：${now.toLocaleString('zh-CN')}`);
  if (currentRoleTitle) {
    lines.push(`> 角色：${currentRoleTitle}`);
  }

  const toolCallCount = messages.reduce(
    (count, message) => count + (message.toolCalls?.length ?? 0),
    0
  );
  const toolResultCount = messages.filter((message) => message.role === 'tool').length;
  const reasoningCount = messages.filter((message) => getReasoningContent(message)).length;
  const totalUsage = messages.reduce(
    (sum, message) => {
      const u = message.usage;
      if (!u) return sum;
      return {
        input: (sum.input || 0) + (u.inputTokens || 0),
        output: (sum.output || 0) + (u.outputTokens || 0),
        total: (sum.total || 0) + (u.totalTokens || 0),
        cached: (sum.cached || 0) + (u.cachedInputTokens || 0),
      };
    },
    { input: 0, output: 0, total: 0, cached: 0 }
  );

  lines.push(
    `> 统计：${messages.length} 条消息 · ${toolCallCount} 次工具调用 · ${toolResultCount} 次工具结果 · ${reasoningCount} 次思考 · ${totalUsage.total.toLocaleString()} 个 token`
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  let currentDate = '';
  for (const msg of messages) {
    const date = new Date(msg.createdAt).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (date !== currentDate) {
      lines.push(`## 📅 ${date}`);
      lines.push('');
      currentDate = date;
    }

    const reasoning = getReasoningContent(msg);
    switch (msg.role) {
      case 'user':
        lines.push('### 👤 用户');
        lines.push('');
        if (msg.content) lines.push(msg.content);
        lines.push('');
        break;

      case 'assistant':
        lines.push('### 🤖 助手');
        lines.push('');

        if (reasoning) {
          lines.push('> 💡 思考过程');
          lines.push('');
          lines.push(`> ${reasoning.split('\n').join('\n> ')}`);
          lines.push('');
        }

        if (msg.content) {
          lines.push(msg.content);
          lines.push('');
        }

        if (msg.toolCalls && msg.toolCalls.length > 0) {
          lines.push('**工具调用**');
          lines.push('');
          for (const tc of msg.toolCalls) {
            lines.push(`#### \`${tc.function.name}\``);
            lines.push('');
            const redactedArguments = redactSensitiveJsonObject(tc.function.arguments);
            try {
              const args = JSON.parse(redactedArguments) as unknown;
              lines.push('```json');
              lines.push(JSON.stringify(args, null, 2));
              lines.push('```');
            } catch {
              lines.push('```json');
              lines.push(redactedArguments);
              lines.push('```');
            }
            lines.push('');
          }
        }

        if (msg.usage) {
          const u = msg.usage;
          lines.push(
            `**Token 使用**: 输入 ${u.inputTokens?.toLocaleString() ?? '-'} | 输出 ${u.outputTokens?.toLocaleString() ?? '-'} | 总计 ${u.totalTokens?.toLocaleString() ?? '-'}`
          );
          if (u.cachedInputTokens) {
            lines.push(
              `**缓存**: 写入 ${u.cacheWriteInputTokens?.toLocaleString() ?? '-'} | 读取 ${u.cachedInputTokens?.toLocaleString() ?? '-'}`
            );
          }
          if (u.contextWindow) {
            lines.push(`**上下文窗口**: ${u.contextWindow.toLocaleString()}`);
          }
          lines.push('');
        }
        break;

      case 'tool':
        lines.push(`### 🔧 工具结果: ${msg.name || '未知'}`);
        lines.push('');
        lines.push(`> 调用 ID: ${msg.toolCallId || '-'}`);
        lines.push('');
        if (msg.content) lines.push(msg.content);
        lines.push('');
        break;

      case 'system':
        lines.push('### ⚙️ 系统');
        lines.push('');
        if (msg.content) lines.push(msg.content);
        lines.push('');
        break;
    }
  }

  if (totalUsage.total > 0) {
    lines.push('---');
    lines.push('');
    lines.push(
      `**总 Token 使用**: 输入 ${totalUsage.input.toLocaleString()} | 输出 ${totalUsage.output.toLocaleString()} | 总计 ${totalUsage.total.toLocaleString()}`
    );
    if (totalUsage.cached > 0) {
      lines.push(`**缓存使用**: ${totalUsage.cached.toLocaleString()}`);
    }
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push(`> 由 DPP AI 助手导出于 ${now.toLocaleString('zh-CN')}`);

  return lines.join('\n');
}
