// AI Assistant View - Main conversation interface
import { useCallback, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { BuildDialog } from '@/features/jenkins/components/BuildDialog';
import { useAIAssistantConfig } from '../hooks/useAIAssistantConfig';
import { useAIAssistantScroll } from '../hooks/useAIAssistantScroll';
import { useAIChat } from '../hooks/useAIChat';
import { AIAssistantHeader } from './AIAssistantHeader';
import { AIAssistantInputSection } from './AIAssistantInputSection';
import { AIAssistantMessagesPanel } from './AIAssistantMessagesPanel';
import { ToolConfirmationDialog } from './ToolConfirmationDialog';

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
  } = useAIChat();

  const { toast } = useToast();
  const [selectedTabId, setSelectedTabId] = useState<number | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const { isConfigMissing, presetPrompt, handleConfigSaved, ensureConfigReady } =
    useAIAssistantConfig({ resetProvider });

  const { isNearBottom, messagesEndRef, messagesContainerRef, handleScroll, scrollToBottom } =
    useAIAssistantScroll(messages);

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
    <div className="flex flex-col h-full bg-background">
      <AIAssistantHeader
        sessions={sessions}
        currentSessionId={sessionId}
        isRunning={isRunning}
        canClear={messages.length > 0}
        canSummarize={
          messages.length > 0 && status !== 'loading' && status !== 'streaming' && !isSummarizing
        }
        isSummarizing={isSummarizing}
        onSelectSession={switchSession}
        onDeleteSession={deleteSession}
        onCreateSession={createNewSession}
        onConfigSaved={handleConfigSaved}
        onSummarize={handleSummarize}
        onClear={clearMessages}
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
      />

      <AIAssistantInputSection
        isConfigMissing={isConfigMissing}
        isRunning={isRunning}
        isConfirming={status === 'confirming'}
        presetPrompt={presetPrompt}
        selectedTabId={selectedTabId}
        onTabSelect={setSelectedTabId}
        onConfigSaved={handleConfigSaved}
        onSend={handleSend}
        onStop={stop}
      />

      <ToolConfirmationDialog
        pendingToolCall={pendingToolCall}
        pendingToolCalls={pendingToolCalls}
        onConfirm={confirmToolCall}
        onConfirmAll={confirmAllToolCalls}
        onCancel={cancelToolCall}
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
