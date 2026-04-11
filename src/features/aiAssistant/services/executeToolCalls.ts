import type { PendingBuild, PreparedToolCall } from '@/features/aiAssistant/hooks/useAIChat.types';
import { ensureAIToolsRegistered } from '@/lib/ai';
import { toolRegistry } from '@/lib/ai/tools';
import { logger } from '@/utils/logger';
import type { ChatMessage } from '../types';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function executePreparedToolCalls(preparedToolCalls: PreparedToolCall[]): Promise<{
  toolMessages: ChatMessage[];
  pendingBuild: PendingBuild | null;
}> {
  ensureAIToolsRegistered();

  const toolMessages: ChatMessage[] = [];

  for (const preparedToolCall of preparedToolCalls) {
    const { toolCall, arguments: args } = preparedToolCall;

    try {
      logger.info(`[AIChat] Executing tool: ${toolCall.function.name}`, {
        args,
        availableTools: toolRegistry.getAll().map((tool) => tool.name),
      });
      const result = await toolRegistry.execute(toolCall.function.name, args);
      const resultObj = result as { action?: string; jobUrl?: string; jobName?: string };

      if (resultObj.action === 'open_build_dialog' && resultObj.jobUrl && resultObj.jobName) {
        return {
          toolMessages,
          pendingBuild: {
            jobUrl: resultObj.jobUrl,
            jobName: resultObj.jobName,
          },
        };
      }

      toolMessages.push({
        id: generateId(),
        role: 'tool',
        name: toolCall.function.name,
        toolCallId: toolCall.id,
        content: JSON.stringify(result, null, 2),
        createdAt: Date.now(),
      });
    } catch (error) {
      logger.error('[AIChat] Tool execution error:', error);
      toolMessages.push({
        id: generateId(),
        role: 'tool',
        name: toolCall.function.name,
        toolCallId: toolCall.id,
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        createdAt: Date.now(),
      });
    }
  }

  return {
    toolMessages,
    pendingBuild: null,
  };
}
