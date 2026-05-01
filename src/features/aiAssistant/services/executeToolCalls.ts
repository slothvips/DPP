import type { PendingBuild, PreparedToolCall } from '@/features/aiAssistant/hooks/useAIChat.types';
import { ensureAIToolsRegistered } from '@/lib/ai';
import { toolRegistry } from '@/lib/ai/tools';
import { logger } from '@/utils/logger';
import { redactSensitiveFields } from '@/utils/sensitive';
import type { ChatMessage } from '../types';

const AI_CONFIG_SETTING_PATTERN = /^ai_/;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function shouldResetAIConfig(resultObj: { action?: string; updatedKeys?: unknown }): boolean {
  if (resultObj.action === 'ai_config_updated') {
    return true;
  }

  if (resultObj.action !== 'dpp_config_updated' || !Array.isArray(resultObj.updatedKeys)) {
    return false;
  }

  return resultObj.updatedKeys.some(
    (key) => typeof key === 'string' && AI_CONFIG_SETTING_PATTERN.test(key)
  );
}

export async function executePreparedToolCalls(preparedToolCalls: PreparedToolCall[]): Promise<{
  toolMessages: ChatMessage[];
  pendingBuild: PendingBuild | null;
}>;
export async function executePreparedToolCalls(
  preparedToolCalls: PreparedToolCall[],
  options: { onAIConfigChanged?: () => void }
): Promise<{
  toolMessages: ChatMessage[];
  pendingBuild: PendingBuild | null;
}>;
export async function executePreparedToolCalls(
  preparedToolCalls: PreparedToolCall[],
  options?: { onAIConfigChanged?: () => void }
): Promise<{
  toolMessages: ChatMessage[];
  pendingBuild: PendingBuild | null;
}> {
  ensureAIToolsRegistered();

  const toolMessages: ChatMessage[] = [];
  const availableToolNames = toolRegistry.getAll().map((tool) => tool.name);

  for (const [index, preparedToolCall] of preparedToolCalls.entries()) {
    const { toolCall, arguments: args } = preparedToolCall;

    try {
      logger.info(`[AIChat] Executing tool: ${toolCall.function.name}`, {
        args: redactSensitiveFields(args),
        availableTools: availableToolNames,
      });
      const result = await toolRegistry.execute(toolCall.function.name, args);
      const resultObj = result as {
        action?: string;
        jobUrl?: string;
        jobName?: string;
        updatedKeys?: unknown;
      };

      if (shouldResetAIConfig(resultObj)) {
        options?.onAIConfigChanged?.();
      }

      if (resultObj.action === 'open_build_dialog' && resultObj.jobUrl && resultObj.jobName) {
        return {
          toolMessages,
          pendingBuild: {
            jobUrl: resultObj.jobUrl,
            jobName: resultObj.jobName,
            toolCallId: toolCall.id,
            toolName: toolCall.function.name,
            remainingToolCalls: preparedToolCalls.slice(index + 1).map((call) => call.toolCall),
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
