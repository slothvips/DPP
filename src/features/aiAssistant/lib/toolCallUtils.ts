import type { PreparedToolCall, ToolCall } from '@/features/aiAssistant/hooks/useAIChat.types';
import { toolRegistry } from '@/lib/ai/tools';

export function parseToolCallArguments(toolCall: ToolCall): Record<string, unknown> {
  const rawArgs = toolCall.function.arguments.trim();
  if (!rawArgs) {
    return {};
  }

  const parsed = JSON.parse(rawArgs) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Tool ${toolCall.function.name} arguments must be a JSON object`);
  }

  return parsed as Record<string, unknown>;
}

export function prepareToolCalls(toolCalls: ToolCall[]): PreparedToolCall[] {
  return toolCalls.map((toolCall) => ({
    toolCall,
    arguments: parseToolCallArguments(toolCall),
  }));
}

export function normalizeAndClassifyToolCalls(
  toolCalls: ToolCall[],
  yoloMode: boolean
): {
  toolCallsToConfirm: PreparedToolCall[];
  toolCallsToExecute: PreparedToolCall[];
} {
  const toolCallsToConfirm: PreparedToolCall[] = [];
  const toolCallsToExecute: PreparedToolCall[] = [];

  for (const preparedToolCall of prepareToolCalls(toolCalls)) {
    const toolName = preparedToolCall.toolCall.function.name.trim();
    const resolvedTool = toolRegistry.get(toolName);
    if (!resolvedTool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    const normalizedToolCall = {
      ...preparedToolCall,
      toolCall: {
        ...preparedToolCall.toolCall,
        function: {
          ...preparedToolCall.toolCall.function,
          name: resolvedTool.name,
        },
      },
    };

    if (!yoloMode && toolRegistry.requiresConfirmation(resolvedTool.name)) {
      toolCallsToConfirm.push(normalizedToolCall);
    } else {
      toolCallsToExecute.push(normalizedToolCall);
    }
  }

  return {
    toolCallsToConfirm,
    toolCallsToExecute,
  };
}
