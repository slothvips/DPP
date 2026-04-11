import { useCallback, useState } from 'react';
import type { ChatMessage } from '../types';
import type { PendingBuild } from './useAIChat.types';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

interface UseAIChatBuildFlowOptions {
  appendMessages: (messages: ChatMessage[]) => ChatMessage[];
  saveUserMessage: (message: ChatMessage) => Promise<void>;
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
  saveUserMessage,
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

    const successMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: `[jenkins_trigger_build] 构建已成功触发: ${pendingBuild.jobName}`,
      createdAt: Date.now(),
    };

    appendMessages([successMessage]);
    void saveUserMessage(successMessage);

    setPendingBuild(null);
    onStatusChange('idle');

    void onContinueConversation();
  }, [appendMessages, onContinueConversation, onStatusChange, pendingBuild, saveUserMessage]);

  const cancelBuild = useCallback(() => {
    if (buildCompleted) {
      setBuildCompleted(false);
      return;
    }

    if (!pendingBuild) {
      return;
    }

    const cancelMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: `[jenkins_trigger_build] 用户取消了构建: ${pendingBuild.jobName}`,
      createdAt: Date.now(),
    };

    appendMessages([cancelMessage]);
    void saveUserMessage(cancelMessage);

    setPendingBuild(null);
    onStatusChange('idle');
  }, [appendMessages, buildCompleted, onStatusChange, pendingBuild, saveUserMessage]);

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
