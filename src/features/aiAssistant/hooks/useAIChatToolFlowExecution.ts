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
  onExecutionStart: () => void;
  isExecutionCancelled: () => boolean;
  browserTaskSessionId: string | null;
  sessionId: string | null;
  allowedToolNames: readonly string[];
}

export function useAIChatToolFlowExecution({
  yoloMode,
  appendMessages,
  saveToolMessages,
  onContinueConversation,
  onStatusChange,
  onPendingBuildChange,
  onAIConfigChanged,
  onExecutionStart,
  isExecutionCancelled,
  browserTaskSessionId,
  sessionId,
  allowedToolNames,
}: UseAIChatToolFlowExecutionOptions) {
  async function executePreparedCallsAndContinue(
    preparedToolCalls: ReturnType<typeof toPreparedToolCalls>,
    requiresActivePlan: boolean
  ) {
    const { toolMessages, pendingBuild } = await executePreparedToolCalls(preparedToolCalls, {
      onAIConfigChanged,
      browserTaskSessionId: browserTaskSessionId ?? undefined,
      sessionId: sessionId ?? undefined,
      allowedToolNames,
      requiresActivePlan,
    });

    if (isExecutionCancelled()) return false;

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
    onExecutionStart();
    const toolCalls = assistantMessage.toolCalls || [];
    if (toolCalls.length === 0) {
      onStatusChange('idle');
      return;
    }

    const { toolCallsToConfirm, toolCallsToExecute } = normalizeAndClassifyToolCalls(
      toolCalls,
      yoloMode,
      allowedToolNames
    );
    const requiresActivePlan = toolCalls.length > 1 && allowedToolNames.includes('manage_plan');

    if (toolCallsToExecute.length > 0) {
      onStatusChange('loading');
      const { toolMessages, pendingBuild } = await executePreparedToolCalls(toolCallsToExecute, {
        onAIConfigChanged,
        browserTaskSessionId: browserTaskSessionId ?? undefined,
        sessionId: sessionId ?? undefined,
        allowedToolNames,
        requiresActivePlan,
      });

      if (isExecutionCancelled()) return;

      appendMessages(toolMessages);
      await saveToolMessages(toolMessages);

      if (pendingBuild) {
        onPendingBuildChange(pendingBuild);
        onStatusChange('confirming');
        return;
      }
    }

    if (toolCallsToConfirm.length > 0) {
      onPendingToolCallsChange(createPendingToolCalls(toolCallsToConfirm, requiresActivePlan));
      onStatusChange('confirming');
      return;
    }

    await onContinueConversation();
  }

  async function confirmNextToolCall(
    pendingToolCalls: Parameters<typeof splitPendingToolCalls>[0],
    onPendingToolCallsChange: (value: ReturnType<typeof createPendingToolCalls> | null) => void
  ) {
    onExecutionStart();
    const { currentPreparedToolCall, remainingPendingToolCalls } =
      splitPendingToolCalls(pendingToolCalls);

    onPendingToolCallsChange(null);
    onStatusChange('loading');

    const { toolMessages, pendingBuild } = await executePreparedToolCalls(
      [currentPreparedToolCall],
      {
        onAIConfigChanged,
        browserTaskSessionId: browserTaskSessionId ?? undefined,
        sessionId: sessionId ?? undefined,
        allowedToolNames,
        requiresActivePlan: pendingToolCalls.requiresActivePlan,
      }
    );

    if (isExecutionCancelled()) return;

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
    onExecutionStart();
    onPendingToolCallsChange(null);
    onStatusChange('loading');
    await executePreparedCallsAndContinue(
      toPreparedToolCalls(pendingToolCalls),
      pendingToolCalls.requiresActivePlan
    );
  }

  return {
    processAssistantResponse,
    confirmNextToolCall,
    confirmAllToolCalls,
  };
}
