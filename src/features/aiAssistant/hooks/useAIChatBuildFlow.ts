import { useCallback, useRef, useState } from 'react';
import type { ChatMessage } from '../types';
import type { PendingBuild } from './useAIChat.types';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

interface UseAIChatBuildFlowOptions {
  sessionId: string | null;
  appendMessages: (messages: ChatMessage[]) => ChatMessage[];
  saveToolMessages: (messages: ChatMessage[]) => Promise<void>;
  onContinueConversation: () => Promise<void>;
  onStatusChange: (status: 'idle' | 'loading' | 'confirming') => void;
}

interface UseAIChatBuildFlowReturn {
  pendingBuild: PendingBuild | null;
  setPendingBuild: (build: PendingBuild | null) => void;
  completeBuild: () => void;
  cancelBuild: () => void;
  resetBuildFlowState: () => void;
  resetBuildFlowStateForSession: (sessionId: string) => void;
}

export function useAIChatBuildFlow({
  appendMessages,
  saveToolMessages,
  onContinueConversation,
  onStatusChange,
  sessionId,
}: UseAIChatBuildFlowOptions): UseAIChatBuildFlowReturn {
  const pendingBuildsRef = useRef(new Map<string, PendingBuild>());
  const buildCompletedRef = useRef(new Set<string>());
  const [, setRevision] = useState(0);
  const pendingBuild = sessionId ? pendingBuildsRef.current.get(sessionId) || null : null;

  const setPendingBuild = useCallback(
    (build: PendingBuild | null) => {
      if (!sessionId) return;
      if (build) pendingBuildsRef.current.set(sessionId, build);
      else pendingBuildsRef.current.delete(sessionId);
      setRevision((value) => value + 1);
    },
    [sessionId]
  );

  const completeBuild = useCallback(() => {
    if (!pendingBuild) {
      return;
    }

    if (sessionId) buildCompletedRef.current.add(sessionId);

    const toolMessages: ChatMessage[] = [
      {
        id: generateId(),
        role: 'tool',
        name: pendingBuild.toolName,
        toolCallId: pendingBuild.toolCallId,
        content: `[jenkins_trigger_build] 构建已成功触发: ${pendingBuild.jobName}`,
        createdAt: Date.now(),
      },
      ...pendingBuild.remainingToolCalls.map((toolCall) => ({
        id: generateId(),
        role: 'tool' as const,
        name: toolCall.function.name,
        toolCallId: toolCall.id,
        content: `已跳过执行工具：${toolCall.function.name}`,
        createdAt: Date.now(),
      })),
    ];

    appendMessages(toolMessages);
    void saveToolMessages(toolMessages);

    setPendingBuild(null);
    onStatusChange('idle');

    void onContinueConversation();
  }, [
    appendMessages,
    onContinueConversation,
    onStatusChange,
    pendingBuild,
    saveToolMessages,
    sessionId,
    setPendingBuild,
  ]);

  const cancelBuild = useCallback(() => {
    if (sessionId && buildCompletedRef.current.has(sessionId)) {
      buildCompletedRef.current.delete(sessionId);
      return;
    }

    if (!pendingBuild) {
      return;
    }

    const toolMessages: ChatMessage[] = [
      {
        id: generateId(),
        role: 'tool',
        name: pendingBuild.toolName,
        toolCallId: pendingBuild.toolCallId,
        content: `[jenkins_trigger_build] 用户取消了构建: ${pendingBuild.jobName}`,
        createdAt: Date.now(),
      },
      ...pendingBuild.remainingToolCalls.map((toolCall) => ({
        id: generateId(),
        role: 'tool' as const,
        name: toolCall.function.name,
        toolCallId: toolCall.id,
        content: `已取消执行工具：${toolCall.function.name}`,
        createdAt: Date.now(),
      })),
    ];

    appendMessages(toolMessages);
    void saveToolMessages(toolMessages);

    setPendingBuild(null);
    onStatusChange('idle');
  }, [appendMessages, onStatusChange, pendingBuild, saveToolMessages, sessionId, setPendingBuild]);

  const resetBuildFlowState = useCallback(() => {
    if (!sessionId) return;
    pendingBuildsRef.current.delete(sessionId);
    buildCompletedRef.current.delete(sessionId);
    setRevision((value) => value + 1);
  }, [sessionId]);

  const resetBuildFlowStateForSession = useCallback((targetSessionId: string) => {
    pendingBuildsRef.current.delete(targetSessionId);
    buildCompletedRef.current.delete(targetSessionId);
    setRevision((value) => value + 1);
  }, []);

  return {
    pendingBuild,
    setPendingBuild,
    completeBuild,
    cancelBuild,
    resetBuildFlowState,
    resetBuildFlowStateForSession,
  };
}
