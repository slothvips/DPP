import { useCallback, useState } from 'react';
import type { ChatMessage } from '../types';
import type { PendingBuild } from './useAIChat.types';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

interface UseAIChatBuildFlowOptions {
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
}

export function useAIChatBuildFlow({
  appendMessages,
  saveToolMessages,
  onContinueConversation,
  onStatusChange,
}: UseAIChatBuildFlowOptions): UseAIChatBuildFlowReturn {
  const [pendingBuild, setPendingBuild] = useState<PendingBuild | null>(null);
  const [buildCompleted, setBuildCompleted] = useState(false);

  const completeBuild = useCallback(() => {
    if (!pendingBuild) {
      return;
    }

    setBuildCompleted(true);

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
  }, [appendMessages, onContinueConversation, onStatusChange, pendingBuild, saveToolMessages]);

  const cancelBuild = useCallback(() => {
    if (buildCompleted) {
      setBuildCompleted(false);
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
  }, [appendMessages, buildCompleted, onStatusChange, pendingBuild, saveToolMessages]);

  const resetBuildFlowState = useCallback(() => {
    setPendingBuild(null);
    setBuildCompleted(false);
  }, []);

  return {
    pendingBuild,
    setPendingBuild,
    completeBuild,
    cancelBuild,
    resetBuildFlowState,
  };
}
