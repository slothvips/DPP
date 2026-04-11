import type { ChatMessage } from '../types';
import type { PendingToolCall, PendingToolCalls, PreparedToolCall } from './useAIChat.types';

export function generateToolFlowId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function getPendingToolCall(
  pendingToolCalls: PendingToolCalls | null
): PendingToolCall | null {
  if (!pendingToolCalls) {
    return null;
  }

  return {
    toolCall: pendingToolCalls.toolCalls[0],
    arguments: pendingToolCalls.argumentsList[0] || {},
  };
}

export function createPendingToolCalls(toolCalls: PreparedToolCall[]): PendingToolCalls {
  return {
    toolCalls: toolCalls.map(({ toolCall }) => toolCall),
    argumentsList: toolCalls.map(({ arguments: args }) => args),
  };
}

export function splitPendingToolCalls(pendingToolCalls: PendingToolCalls): {
  currentPreparedToolCall: PreparedToolCall;
  remainingPendingToolCalls: PendingToolCalls | null;
} {
  const [currentToolCall, ...remainingToolCalls] = pendingToolCalls.toolCalls;
  const [currentArgs, ...remainingArguments] = pendingToolCalls.argumentsList;

  return {
    currentPreparedToolCall: {
      toolCall: currentToolCall,
      arguments: currentArgs || {},
    },
    remainingPendingToolCalls:
      remainingToolCalls.length > 0
        ? {
            toolCalls: remainingToolCalls,
            argumentsList: remainingArguments,
          }
        : null,
  };
}

export function toPreparedToolCalls(pendingToolCalls: PendingToolCalls): PreparedToolCall[] {
  return pendingToolCalls.toolCalls.map((toolCall, index) => ({
    toolCall,
    arguments: pendingToolCalls.argumentsList[index] || {},
  }));
}

export function createToolCallCancelMessage(options: {
  pendingToolCall: PendingToolCall;
  pendingToolCalls: PendingToolCalls | null;
}): ChatMessage {
  const { pendingToolCall, pendingToolCalls } = options;

  return {
    id: generateToolFlowId(),
    role: 'user',
    content: `已取消执行工具：${pendingToolCall.toolCall.function.name}${pendingToolCalls && pendingToolCalls.toolCalls.length > 1 ? `（以及另外 ${pendingToolCalls.toolCalls.length - 1} 个）` : ''}`,
    createdAt: Date.now(),
  };
}
