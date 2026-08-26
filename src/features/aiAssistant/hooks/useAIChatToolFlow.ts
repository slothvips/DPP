import { useCallback, useMemo, useRef, useState } from 'react';
import { hasActiveTestRunForSession, stopTestRunForSession } from '@/lib/ai/tools/testRuns';
import type { ChatMessage } from '../types';
import type { PendingBuild, PendingToolCall, PendingToolCalls } from './useAIChat.types';
import { useAIChatBuildFlow } from './useAIChatBuildFlow';
import {
  createToolCallCancelMessages,
  generateToolFlowId,
  getPendingToolCall,
} from './useAIChatToolFlow.shared';
import { useAIChatToolFlowExecution } from './useAIChatToolFlowExecution';

interface UseAIChatToolFlowOptions {
  yoloMode: boolean;
  appendMessages: (messages: ChatMessage[]) => ChatMessage[];
  saveToolMessages: (messages: ChatMessage[]) => Promise<void>;
  onContinueConversation: () => Promise<void>;
  onStatusChange: (status: 'idle' | 'loading' | 'confirming') => void;
  onAIConfigChanged: () => void;
  sessionId: string | null;
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
  cancelPendingToolFlow: (appendCancellationMessages?: boolean) => void;
  resetToolFlowState: () => void;
  resetToolFlowStateForSession: (sessionId: string) => void;
}

export function useAIChatToolFlow({
  yoloMode,
  appendMessages,
  saveToolMessages,
  onContinueConversation,
  onStatusChange,
  onAIConfigChanged,
  sessionId,
}: UseAIChatToolFlowOptions): UseAIChatToolFlowReturn {
  const [, setPendingToolCalls] = useState<PendingToolCalls | null>(null);
  const pendingToolCallsBySessionRef = useRef(new Map<string, PendingToolCalls>());
  const executionCancelledBySessionRef = useRef(new Set<string>());
  const {
    pendingBuild,
    setPendingBuild,
    completeBuild,
    cancelBuild,
    resetBuildFlowState,
    resetBuildFlowStateForSession,
  } = useAIChatBuildFlow({
    sessionId,
    appendMessages,
    saveToolMessages,
    onContinueConversation,
    onStatusChange,
  });

  const currentPendingToolCalls = sessionId
    ? pendingToolCallsBySessionRef.current.get(sessionId) || null
    : null;
  const pendingToolCall = useMemo(
    () => getPendingToolCall(currentPendingToolCalls),
    [currentPendingToolCalls]
  );

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
    onAIConfigChanged,
    onExecutionStart: () => {
      if (sessionId) executionCancelledBySessionRef.current.delete(sessionId);
    },
    isExecutionCancelled: () =>
      sessionId ? executionCancelledBySessionRef.current.has(sessionId) : true,
    browserTaskSessionId: sessionId,
    sessionId,
  });

  const processAssistantResponse = useCallback(
    async (assistantMessage: ChatMessage) => {
      await processAssistantResponseInternal(assistantMessage, (value) => {
        if (!sessionId) return;
        if (value) pendingToolCallsBySessionRef.current.set(sessionId, value);
        else pendingToolCallsBySessionRef.current.delete(sessionId);
        setPendingToolCalls(value);
      });
    },
    [processAssistantResponseInternal, sessionId]
  );

  const confirmToolCall = useCallback(async () => {
    if (!currentPendingToolCalls || currentPendingToolCalls.toolCalls.length === 0) {
      return;
    }

    await confirmNextToolCall(currentPendingToolCalls, (value) => {
      if (!sessionId) return;
      if (value) pendingToolCallsBySessionRef.current.set(sessionId, value);
      else pendingToolCallsBySessionRef.current.delete(sessionId);
      setPendingToolCalls(value);
    });
  }, [confirmNextToolCall, currentPendingToolCalls, sessionId]);

  const confirmAllToolCalls = useCallback(async () => {
    if (!currentPendingToolCalls) {
      return;
    }

    await confirmAllToolCallsInternal(currentPendingToolCalls, (value) => {
      if (!sessionId) return;
      if (value) pendingToolCallsBySessionRef.current.set(sessionId, value);
      else pendingToolCallsBySessionRef.current.delete(sessionId);
      setPendingToolCalls(value);
    });
  }, [confirmAllToolCallsInternal, currentPendingToolCalls, sessionId]);

  const cancelToolCall = useCallback(() => {
    if (!pendingToolCall || !currentPendingToolCalls) {
      return;
    }

    const [cancelledToolCall, ...remainingToolCalls] = currentPendingToolCalls.toolCalls;
    const [, ...remainingArguments] = currentPendingToolCalls.argumentsList;
    if (
      sessionId &&
      hasActiveTestRunForSession(sessionId) &&
      cancelledToolCall.function.name === 'delegate_browser_agent'
    ) {
      const cancelMessages = createToolCallCancelMessages({
        pendingToolCalls: currentPendingToolCalls,
      });
      appendMessages(cancelMessages);
      void saveToolMessages(cancelMessages);
      pendingToolCallsBySessionRef.current.delete(sessionId);
      setPendingToolCalls(null);
      onStatusChange('idle');
      void stopTestRunForSession(sessionId, '测试网页步骤被取消，执行已停止');
      return;
    }
    const cancelMessages: ChatMessage[] = [
      {
        id: generateToolFlowId(),
        role: 'tool',
        name: cancelledToolCall.function.name,
        toolCallId: cancelledToolCall.id,
        content: `已取消执行工具：${cancelledToolCall.function.name}`,
        createdAt: Date.now(),
      },
    ];

    appendMessages(cancelMessages);
    void saveToolMessages(cancelMessages);
    const remaining =
      remainingToolCalls.length > 0
        ? { toolCalls: remainingToolCalls, argumentsList: remainingArguments }
        : null;
    if (sessionId) {
      if (remaining) pendingToolCallsBySessionRef.current.set(sessionId, remaining);
      else pendingToolCallsBySessionRef.current.delete(sessionId);
    }
    setPendingToolCalls(remaining);
    onStatusChange(remaining ? 'confirming' : 'idle');
  }, [
    appendMessages,
    currentPendingToolCalls,
    onStatusChange,
    pendingToolCall,
    saveToolMessages,
    sessionId,
  ]);

  const cancelPendingToolFlow = useCallback(
    (appendCancellationMessages = true) => {
      if (sessionId) executionCancelledBySessionRef.current.add(sessionId);
      if (sessionId) {
        void stopTestRunForSession(sessionId, '测试执行流程被取消');
      }
      if (currentPendingToolCalls) {
        if (appendCancellationMessages) {
          const cancelMessages = createToolCallCancelMessages({
            pendingToolCalls: currentPendingToolCalls,
          });
          appendMessages(cancelMessages);
          void saveToolMessages(cancelMessages);
        }
        pendingToolCallsBySessionRef.current.delete(sessionId || '');
        setPendingToolCalls(null);
      }

      if (pendingBuild) {
        if (appendCancellationMessages) {
          cancelBuild();
        } else {
          resetBuildFlowState();
        }
      }
    },
    [
      appendMessages,
      cancelBuild,
      currentPendingToolCalls,
      pendingBuild,
      resetBuildFlowState,
      saveToolMessages,
      sessionId,
    ]
  );

  const resetToolFlowState = useCallback(() => {
    if (sessionId) pendingToolCallsBySessionRef.current.delete(sessionId);
    setPendingToolCalls(null);
    resetBuildFlowState();
  }, [resetBuildFlowState, sessionId]);

  const resetToolFlowStateForSession = useCallback(
    (targetSessionId: string) => {
      pendingToolCallsBySessionRef.current.delete(targetSessionId);
      executionCancelledBySessionRef.current.add(targetSessionId);
      resetBuildFlowStateForSession(targetSessionId);
      if (targetSessionId === sessionId) setPendingToolCalls(null);
    },
    [resetBuildFlowStateForSession, sessionId]
  );

  return {
    pendingToolCall,
    pendingToolCalls: currentPendingToolCalls,
    pendingBuild,
    processAssistantResponse,
    confirmToolCall,
    confirmAllToolCalls,
    cancelToolCall,
    completeBuild,
    cancelBuild,
    cancelPendingToolFlow,
    resetToolFlowState,
    resetToolFlowStateForSession,
  };
}
