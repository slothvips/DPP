import { normalizeAndClassifyToolCalls } from '../lib/toolCallUtils';
import { executePreparedToolCalls } from '../services/executeToolCalls';
import type { ChatMessage } from '../types';
import type { PendingBuild } from './useAIChat.types';
import {
  createPendingToolCalls,
  splitPendingToolCalls,
  toPreparedToolCalls,
} from './useAIChatToolFlow.shared';

interface UseAIChatToolFlowExecutionOptions {
  yoloMode: boolean;
  appendMessages: (messages: ChatMessage[]) => ChatMessage[];
  saveToolMessages: (messages: ChatMessage[]) => Promise<void>;
  onContinueConversation: () => Promise<void>;
  onStatusChange: (status: 'idle' | 'loading' | 'confirming') => void;
  onPendingBuildChange: (build: PendingBuild | null) => void;
  onAIConfigChanged: () => void;
}

export function useAIChatToolFlowExecution({
  yoloMode,
  appendMessages,
  saveToolMessages,
  onContinueConversation,
  onStatusChange,
  onPendingBuildChange,
  onAIConfigChanged,
}: UseAIChatToolFlowExecutionOptions) {
  async function executePreparedCallsAndContinue(
    preparedToolCalls: ReturnType<typeof toPreparedToolCalls>
  ) {
    const { toolMessages, pendingBuild } = await executePreparedToolCalls(preparedToolCalls, {
      onAIConfigChanged,
    });

    appendMessages(toolMessages);
    await saveToolMessages(toolMessages);

    if (pendingBuild) {
      onPendingBuildChange(pendingBuild);
      onStatusChange('confirming');
      return true;
    }

    await onContinueConversation();
    return false;
  }

  async function processAssistantResponse(
    assistantMessage: ChatMessage,
    onPendingToolCallsChange: (value: ReturnType<typeof createPendingToolCalls> | null) => void
  ) {
    const toolCalls = assistantMessage.toolCalls || [];
    if (toolCalls.length === 0) {
      onStatusChange('idle');
      return;
    }

    const { toolCallsToConfirm, toolCallsToExecute } = normalizeAndClassifyToolCalls(
      toolCalls,
      yoloMode
    );

    if (toolCallsToExecute.length > 0) {
      onStatusChange('loading');
      const { toolMessages, pendingBuild } = await executePreparedToolCalls(toolCallsToExecute, {
        onAIConfigChanged,
      });

      appendMessages(toolMessages);
      await saveToolMessages(toolMessages);

      if (pendingBuild) {
        onPendingBuildChange(pendingBuild);
        onStatusChange('confirming');
        return;
      }
    }

    if (toolCallsToConfirm.length > 0) {
      onPendingToolCallsChange(createPendingToolCalls(toolCallsToConfirm));
      onStatusChange('confirming');
      return;
    }

    await onContinueConversation();
  }

  async function confirmNextToolCall(
    pendingToolCalls: Parameters<typeof splitPendingToolCalls>[0],
    onPendingToolCallsChange: (value: ReturnType<typeof createPendingToolCalls> | null) => void
  ) {
    const { currentPreparedToolCall, remainingPendingToolCalls } =
      splitPendingToolCalls(pendingToolCalls);

    onPendingToolCallsChange(null);
    onStatusChange('loading');

    const { toolMessages, pendingBuild } = await executePreparedToolCalls(
      [currentPreparedToolCall],
      {
        onAIConfigChanged,
      }
    );

    appendMessages(toolMessages);
    await saveToolMessages(toolMessages);

    if (pendingBuild) {
      onPendingBuildChange({
        ...pendingBuild,
        remainingToolCalls: remainingPendingToolCalls?.toolCalls || [],
      });
      onStatusChange('confirming');
      return;
    }

    if (remainingPendingToolCalls) {
      onPendingToolCallsChange(remainingPendingToolCalls);
      onStatusChange('confirming');
      return;
    }

    await onContinueConversation();
  }

  async function confirmAllToolCalls(
    pendingToolCalls: Parameters<typeof toPreparedToolCalls>[0],
    onPendingToolCallsChange: (value: ReturnType<typeof createPendingToolCalls> | null) => void
  ) {
    onPendingToolCallsChange(null);
    onStatusChange('loading');
    await executePreparedCallsAndContinue(toPreparedToolCalls(pendingToolCalls));
  }

  return {
    processAssistantResponse,
    confirmNextToolCall,
    confirmAllToolCalls,
  };
}
