import { useCallback, useMemo, useState } from 'react';
import type { ChatMessage } from '../types';
import type { PendingBuild, PendingToolCall, PendingToolCalls } from './useAIChat.types';
import { useAIChatBuildFlow } from './useAIChatBuildFlow';
import { createToolCallCancelMessages, getPendingToolCall } from './useAIChatToolFlow.shared';
import { useAIChatToolFlowExecution } from './useAIChatToolFlowExecution';

interface UseAIChatToolFlowOptions {
  yoloMode: boolean;
  appendMessages: (messages: ChatMessage[]) => ChatMessage[];
  saveToolMessages: (messages: ChatMessage[]) => Promise<void>;
  onContinueConversation: () => Promise<void>;
  onStatusChange: (status: 'idle' | 'loading' | 'confirming') => void;
}

interface UseAIChatToolFlowReturn {
  pendingToolCall: PendingToolCall | null;
  pendingToolCalls: PendingToolCalls | null;
  pendingBuild: PendingBuild | null;
  processAssistantResponse: (assistantMessage: ChatMessage) => Promise<void>;
  confirmToolCall: () => Promise<void>;
  confirmAllToolCalls: () => Promise<void>;
  cancelToolCall: () => void;
  completeBuild: () => void;
  cancelBuild: () => void;
  cancelPendingToolFlow: () => void;
  resetToolFlowState: () => void;
}

export function useAIChatToolFlow({
  yoloMode,
  appendMessages,
  saveToolMessages,
  onContinueConversation,
  onStatusChange,
}: UseAIChatToolFlowOptions): UseAIChatToolFlowReturn {
  const [pendingToolCalls, setPendingToolCalls] = useState<PendingToolCalls | null>(null);
  const { pendingBuild, setPendingBuild, completeBuild, cancelBuild, resetBuildFlowState } =
    useAIChatBuildFlow({
      appendMessages,
      saveToolMessages,
      onContinueConversation,
      onStatusChange,
    });

  const pendingToolCall = useMemo(() => getPendingToolCall(pendingToolCalls), [pendingToolCalls]);

  const {
    processAssistantResponse: processAssistantResponseInternal,
    confirmNextToolCall,
    confirmAllToolCalls: confirmAllToolCallsInternal,
  } = useAIChatToolFlowExecution({
    yoloMode,
    appendMessages,
    saveToolMessages,
    onContinueConversation,
    onStatusChange,
    onPendingBuildChange: setPendingBuild,
  });

  const processAssistantResponse = useCallback(
    async (assistantMessage: ChatMessage) => {
      await processAssistantResponseInternal(assistantMessage, setPendingToolCalls);
    },
    [processAssistantResponseInternal]
  );

  const confirmToolCall = useCallback(async () => {
    if (!pendingToolCalls || pendingToolCalls.toolCalls.length === 0) {
      return;
    }

    await confirmNextToolCall(pendingToolCalls, setPendingToolCalls);
  }, [confirmNextToolCall, pendingToolCalls]);

  const confirmAllToolCalls = useCallback(async () => {
    if (!pendingToolCalls) {
      return;
    }

    await confirmAllToolCallsInternal(pendingToolCalls, setPendingToolCalls);
  }, [confirmAllToolCallsInternal, pendingToolCalls]);

  const cancelToolCall = useCallback(() => {
    if (!pendingToolCall || !pendingToolCalls) {
      return;
    }

    const cancelMessages = createToolCallCancelMessages({
      pendingToolCalls,
    });

    appendMessages(cancelMessages);
    void saveToolMessages(cancelMessages);
    setPendingToolCalls(null);
    onStatusChange('idle');
  }, [appendMessages, onStatusChange, pendingToolCall, pendingToolCalls, saveToolMessages]);

  const cancelPendingToolFlow = useCallback(() => {
    if (pendingToolCalls) {
      const cancelMessages = createToolCallCancelMessages({
        pendingToolCalls,
      });
      appendMessages(cancelMessages);
      void saveToolMessages(cancelMessages);
      setPendingToolCalls(null);
    }

    if (pendingBuild) {
      cancelBuild();
    }
  }, [appendMessages, cancelBuild, pendingBuild, pendingToolCalls, saveToolMessages]);

  const resetToolFlowState = useCallback(() => {
    setPendingToolCalls(null);
    resetBuildFlowState();
  }, [resetBuildFlowState]);

  return {
    pendingToolCall,
    pendingToolCalls,
    pendingBuild,
    processAssistantResponse,
    confirmToolCall,
    confirmAllToolCalls,
    cancelToolCall,
    completeBuild,
    cancelBuild,
    cancelPendingToolFlow,
    resetToolFlowState,
  };
}
