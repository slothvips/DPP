// AI Assistant View - Main conversation interface
import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { useToast } from '@/components/ui/toast';
import { BuildDialog } from '@/features/jenkins/components/BuildDialog';
import { YOLO_MODE_KEY } from '@/lib/ai/tools';
import { useAIAssistantConfig } from '../hooks/useAIAssistantConfig';
import { useAIAssistantScroll } from '../hooks/useAIAssistantScroll';
import { useAIChat } from '../hooks/useAIChat';
import { useAIPlan } from '../hooks/useAIPlan';
import { useBrowserTaskProgress } from '../hooks/useBrowserTaskProgress';
import { AIAssistantHeader } from './AIAssistantHeader';
import { AIAssistantInputSection } from './AIAssistantInputSection';
import { AIAssistantMessagesPanel } from './AIAssistantMessagesPanel';
import { ToolConfirmationDialog } from './ToolConfirmationDialog';

function getLatestUsage(messages: ReturnType<typeof useAIChat>['messages']) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].usage) {
      return messages[index].usage;
    }
  }
  return undefined;
}

export function AIAssistantView() {
  const {
    messages,
    status,
    error,
    pendingToolCall,
    pendingToolCalls,
    pendingBuild,
    sessions,
    sessionId,
    isRunning,
    sendMessage,
    editMessage,
    stop,
    confirmToolCall,
    confirmAllToolCalls,
    cancelToolCall,
    clearMessages,
    createNewSession,
    switchSession,
    deleteSession,
    resetProvider,
    completeBuild,
    cancelBuild,
    summarizeSession,
    setYoloMode,
  } = useAIChat();

  const { toast } = useToast();
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [browserTaskRevision, setBrowserTaskRevision] = useState(0);

  const { isConfigMissing, presetPrompt, handleConfigSaved, ensureConfigReady } =
    useAIAssistantConfig({ resetProvider });

  const { isNearBottom, messagesEndRef, messagesContainerRef, handleScroll, scrollToBottom } =
    useAIAssistantScroll(messages);
  const browserTaskProgress = useBrowserTaskProgress(sessionId, browserTaskRevision);
  const plan = useAIPlan(sessionId);

  useEffect(() => {
    const handleBrowserTaskStopped = (message: unknown) => {
      if (typeof message !== 'object' || message === null || !('event' in message)) return;
      const event = message.event;
      if (typeof event !== 'object' || event === null) return;
      if (!('status' in event) || event.status !== 'stopped') return;
      if (!('sessionId' in event) || event.sessionId !== sessionId) return;
      if ('stopSource' in event && event.stopSource === 'chat') return;
      if (status !== 'loading' && status !== 'streaming' && status !== 'confirming') return;
      stop(false);
    };

    browser.runtime.onMessage.addListener(handleBrowserTaskStopped);
    return () => browser.runtime.onMessage.removeListener(handleBrowserTaskStopped);
  }, [sessionId, status, stop]);

  const enableYoloAndConfirm = useCallback(async () => {
    setYoloMode(true);
    await browser.storage.session.set({ [YOLO_MODE_KEY]: true });
    await confirmAllToolCalls();
  }, [confirmAllToolCalls, setYoloMode]);

  useEffect(() => {
    const handleOpenSession = () => {
      const targetSessionId = sessionStorage.getItem('ai_current_session_id');
      if (targetSessionId && targetSessionId !== sessionId) {
        void switchSession(targetSessionId);
      }
    };
    window.addEventListener('dpp:open-ai-session', handleOpenSession);
    return () => window.removeEventListener('dpp:open-ai-session', handleOpenSession);
  }, [sessionId, switchSession]);

  const handleSend = useCallback(
    async (content: string) => {
      const configured = await ensureConfigReady();
      if (!configured) {
        return;
      }
      await sendMessage(content);
    },
    [ensureConfigReady, sendMessage]
  );

  const handleEditMessage = useCallback(
    async (messageId: string, content: string) => {
      await editMessage(messageId, content);
      setBrowserTaskRevision((revision) => revision + 1);
    },
    [editMessage]
  );

  const handleClearMessages = useCallback(async () => {
    await clearMessages();
    setBrowserTaskRevision((revision) => revision + 1);
  }, [clearMessages]);

  const handleSummarize = useCallback(async () => {
    if (isSummarizing) {
      return;
    }

    if (messages.length === 0) {
      toast('无法压缩当前会话', 'error');
      return;
    }

    if (status === 'loading' || status === 'streaming') {
      toast('压缩中，请稍候', 'info');
      return;
    }

    setIsSummarizing(true);
    toast('正在压缩会话，请稍候...', 'info');

    try {
      const newSessionId = await summarizeSession();

      if (newSessionId) {
        await switchSession(newSessionId);
        toast('压缩完成，已创建新的压缩会话', 'success');
      } else {
        toast('压缩失败，请重试', 'error');
      }
    } finally {
      setIsSummarizing(false);
    }
  }, [isSummarizing, messages.length, status, summarizeSession, switchSession, toast]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[22px] border border-border/60 bg-background/90">
      <AIAssistantHeader
        sessions={sessions}
        currentSessionId={sessionId}
        isRunning={isRunning}
        isConfigMissing={isConfigMissing}
        onSelectSession={switchSession}
        onDeleteSession={deleteSession}
        onCreateSession={createNewSession}
      />

      <AIAssistantMessagesPanel
        messages={messages}
        status={status}
        error={error}
        isConfigMissing={isConfigMissing}
        isNearBottom={isNearBottom}
        messagesContainerRef={messagesContainerRef}
        messagesEndRef={messagesEndRef}
        onScroll={handleScroll}
        onScrollToBottom={scrollToBottom}
        onConfigSaved={handleConfigSaved}
        onEditMessage={handleEditMessage}
        browserTaskProgress={browserTaskProgress}
        plan={plan}
      />

      <AIAssistantInputSection
        isConfigMissing={isConfigMissing}
        isRunning={isRunning}
        isConfirming={status === 'confirming'}
        presetPrompt={presetPrompt}
        usage={getLatestUsage(messages)}
        canClear={messages.length > 0}
        canSummarize={
          messages.length > 0 && status !== 'loading' && status !== 'streaming' && !isSummarizing
        }
        isSummarizing={isSummarizing}
        onConfigSaved={handleConfigSaved}
        onSend={handleSend}
        onStop={stop}
        onSummarize={handleSummarize}
        onClear={handleClearMessages}
      />

      <ToolConfirmationDialog
        pendingToolCall={pendingToolCall}
        pendingToolCalls={pendingToolCalls}
        onConfirm={confirmToolCall}
        onConfirmAll={confirmAllToolCalls}
        onCancel={cancelToolCall}
        onEnableYolo={() => void enableYoloAndConfirm()}
      />

      {pendingBuild && (
        <BuildDialog
          jobUrl={pendingBuild.jobUrl}
          jobName={pendingBuild.jobName}
          isOpen={true}
          onClose={() => {
            setTimeout(() => cancelBuild(), 0);
          }}
          onBuildSuccess={completeBuild}
        />
      )}
    </div>
  );
}
