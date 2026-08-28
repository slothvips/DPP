// AI Assistant View - Main conversation interface
import { Allotment } from 'allotment';
import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { useToast } from '@/components/ui/toast';
import { BuildDialog } from '@/features/jenkins/components/BuildDialog';
import { TEST_CASE_IMPORT_PROMPT, buildTestCaseExecutionPrompt } from '@/lib/ai/promptTestCases';
import { YOLO_MODE_KEY } from '@/lib/ai/tools';
import { logger } from '@/utils/logger';
import { useAIAssistantConfig } from '../hooks/useAIAssistantConfig';
import { useAIAssistantScroll } from '../hooks/useAIAssistantScroll';
import { useAIChat } from '../hooks/useAIChat';
import { useAIPlan } from '../hooks/useAIPlan';
import { useBrowserTaskProgress } from '../hooks/useBrowserTaskProgress';
import { AIAssistantHeader } from './AIAssistantHeader';
import type { AIAssistantViewMode } from './AIAssistantHeader';
import { AIAssistantInputSection } from './AIAssistantInputSection';
import { AIAssistantMessagesPanel } from './AIAssistantMessagesPanel';
import { AIMaterialLibraryView } from './AIMaterialLibraryView';
import { ToolConfirmationDialog } from './ToolConfirmationDialog';

const AI_INPUT_PANEL_SIZE_KEY = 'ai-assistant-input-panel-height';
const DEFAULT_AI_INPUT_PANEL_SIZE = 260;
const MIN_AI_INPUT_PANEL_SIZE = 220;

function getSavedInputPanelSize(): number {
  const saved = Number(localStorage.getItem(AI_INPUT_PANEL_SIZE_KEY));
  return Number.isFinite(saved) && saved > 0
    ? Math.max(saved, MIN_AI_INPUT_PANEL_SIZE)
    : DEFAULT_AI_INPUT_PANEL_SIZE;
}

function saveInputPanelSize(sizes: number[]): void {
  if (sizes.length === 2 && sizes[1] > 0) {
    localStorage.setItem(
      AI_INPUT_PANEL_SIZE_KEY,
      String(Math.round(Math.max(sizes[1], MIN_AI_INPUT_PANEL_SIZE)))
    );
  }
}

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
    sessionStatuses,
    sessionId,
    currentProvider,
    currentProviderName,
    currentModel,
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
  const [invalidatedBrowserTaskIds, setInvalidatedBrowserTaskIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<AIAssistantViewMode>('chat');
  const [inputDraft, setInputDraft] = useState<{ value: string; key: string } | null>(null);

  const { isConfigMissing, presetPrompt, handleConfigSaved, ensureConfigReady } =
    useAIAssistantConfig({ resetProvider });

  const { isNearBottom, messagesEndRef, messagesContainerRef, handleScroll, scrollToBottom } =
    useAIAssistantScroll(messages);
  const browserTaskProgress = useBrowserTaskProgress(
    sessionId,
    browserTaskRevision,
    invalidatedBrowserTaskIds
  );
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
        setInputDraft(null);
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
      setInputDraft(null);
    },
    [ensureConfigReady, sendMessage]
  );

  const handleSelectSession = useCallback(
    async (id: string) => {
      setInputDraft(null);
      await switchSession(id);
    },
    [switchSession]
  );

  const handleCreateSession = useCallback(async () => {
    setInputDraft(null);
    await createNewSession();
  }, [createNewSession]);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      setInputDraft(null);
      await deleteSession(id);
    },
    [deleteSession]
  );

  const handleViewModeChange = useCallback((mode: AIAssistantViewMode) => {
    if (mode !== 'chat') setInputDraft(null);
    setViewMode(mode);
  }, []);

  const handleImportTestCase = useCallback(async () => {
    try {
      await createNewSession();
      setInputDraft({ value: TEST_CASE_IMPORT_PROMPT, key: crypto.randomUUID() });
      setViewMode('chat');
    } catch (error) {
      logger.error('[AIChat] Failed to start test case import:', error);
      toast('无法创建测试用例导入会话，请重试', 'error');
    }
  }, [createNewSession, toast]);

  const handleExecuteTestCase = useCallback(
    async (material: { id: string; title: string }) => {
      try {
        await createNewSession();
        setInputDraft({
          value: buildTestCaseExecutionPrompt(material.title, material.id),
          key: crypto.randomUUID(),
        });
        setViewMode('chat');
      } catch (error) {
        logger.error('[AIChat] Failed to start test case execution:', error);
        toast('无法创建测试执行会话，请重试', 'error');
      }
    },
    [createNewSession, toast]
  );

  const handleEditMessage = useCallback(
    async (messageId: string, content: string) => {
      const messageIndex = messages.findIndex((message) => message.id === messageId);
      const editedMessage = messages[messageIndex];
      if (editedMessage) {
        const removedToolCallIds = new Set(
          messages
            .slice(messageIndex)
            .flatMap((message) => [
              ...(message.toolCalls?.map((toolCall) => toolCall.id) || []),
              ...(message.toolCallId ? [message.toolCallId] : []),
            ])
        );
        const taskIds = browserTaskProgress
          .filter(
            (task) =>
              task.createdAt >= editedMessage.createdAt ||
              (task.toolCallId !== undefined && removedToolCallIds.has(task.toolCallId))
          )
          .map((task) => task.taskId);
        if (taskIds.length > 0) {
          setInvalidatedBrowserTaskIds((previous) => [...new Set([...previous, ...taskIds])]);
        }
      }
      setBrowserTaskRevision((revision) => revision + 1);
      await editMessage(messageId, content);
    },
    [browserTaskProgress, editMessage, messages]
  );

  const handleClearMessages = useCallback(async () => {
    if (browserTaskProgress.length > 0) {
      setInvalidatedBrowserTaskIds((previous) => [
        ...new Set([...previous, ...browserTaskProgress.map((task) => task.taskId)]),
      ]);
    }
    setBrowserTaskRevision((revision) => revision + 1);
    await clearMessages();
  }, [browserTaskProgress, clearMessages]);

  const handleSummarize = useCallback(async () => {
    if (isSummarizing) {
      return;
    }

    if (messages.length === 0) {
      toast('无法压缩当前会话', 'error');
      return;
    }

    if (status !== 'idle') {
      toast('请等待当前任务完成后再压缩', 'info');
      return;
    }

    setIsSummarizing(true);
    toast('正在压缩会话，请稍候...', 'info');

    try {
      const compressed = await summarizeSession();

      if (compressed && sessionId) {
        setInputDraft(null);
        await switchSession(sessionId);
        toast('压缩完成，当前会话已更新', 'success');
      } else {
        toast('压缩失败，请重试', 'error');
      }
    } finally {
      setIsSummarizing(false);
    }
  }, [isSummarizing, messages.length, sessionId, status, summarizeSession, switchSession, toast]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[22px] border border-border/60 bg-background/90">
      <AIAssistantHeader
        sessions={sessions}
        currentSessionId={sessionId}
        sessionStatuses={sessionStatuses}
        isRunning={isRunning}
        isConfigMissing={isConfigMissing}
        onConfigSaved={handleConfigSaved}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onCreateSession={handleCreateSession}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />

      {viewMode === 'materials' ? (
        <AIMaterialLibraryView
          onImportTestCase={handleImportTestCase}
          onExecuteTestCase={handleExecuteTestCase}
        />
      ) : (
        <Allotment vertical separator onDragEnd={saveInputPanelSize} className="min-h-0 flex-1">
          <Allotment.Pane minSize={180}>
            <div className="flex h-full min-h-0 min-w-0 flex-col">
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
            </div>
          </Allotment.Pane>
          <Allotment.Pane
            preferredSize={getSavedInputPanelSize()}
            minSize={MIN_AI_INPUT_PANEL_SIZE}
          >
            <div className="h-full min-h-[220px] overflow-y-auto">
              <AIAssistantInputSection
                isConfigMissing={isConfigMissing}
                currentProvider={currentProvider}
                currentProviderName={currentProviderName}
                currentModel={currentModel}
                isRunning={isRunning}
                isConfirming={status === 'confirming'}
                presetPrompt={inputDraft?.value || presetPrompt}
                presetPromptKey={inputDraft?.key}
                usage={getLatestUsage(messages)}
                canClear={messages.length > 0}
                canSummarize={messages.length > 0 && status === 'idle' && !isSummarizing}
                isSummarizing={isSummarizing}
                onConfigSaved={handleConfigSaved}
                onSend={handleSend}
                onFileError={(message) => toast(message, 'error')}
                onStop={stop}
                onSummarize={handleSummarize}
                onClear={handleClearMessages}
              />
            </div>
          </Allotment.Pane>
        </Allotment>
      )}

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
