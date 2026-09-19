// AI Assistant View - Main conversation interface
import { Allotment } from 'allotment';
import { useLiveQuery } from 'dexie-react-hooks';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import type { RecentAction } from '@/db';
import type { TabId } from '@/entrypoints/sidepanel/sidepanelTypes';
import type { AISession, ChatMessage } from '@/features/aiAssistant/types';
import { exportChatToMarkdown } from '@/features/aiAssistant/utils/exportChatToMarkdown';
import { BuildDialog } from '@/features/jenkins/components/BuildDialog';
import { isJenkinsFeatureEnabled } from '@/features/jenkins/featureFlags';
import { openLink } from '@/features/links/utils';
import { getTotpPinConfig } from '@/features/totp/totpPin';
import { isTotpPinSessionUnlocked } from '@/features/totp/totpPinSession';
import { copyTotpCode } from '@/features/totp/utils/copyTotpCode';
import {
  TEST_CASE_GENERATE_PROMPT,
  TEST_CASE_IMPORT_PROMPT,
  buildTestProjectExecutionPrompt,
} from '@/lib/ai/promptTestCases';
import { YOLO_MODE_KEY } from '@/lib/ai/tools';
import {
  deleteRecentAction,
  getJob,
  getLink,
  getTotpAccount,
  listRecentActions,
  recordRecentAction,
} from '@/lib/db';
import { getMessagesBySession, listSessionIdsWithMessages, listSessions } from '@/lib/db/ai';
import { setTotpReplayIntent } from '@/lib/recentActionIntent';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';
import { useAIAssistantConfig } from '../hooks/useAIAssistantConfig';
import { useAIAssistantScroll } from '../hooks/useAIAssistantScroll';
import { useAIChat } from '../hooks/useAIChat';
import { AI_CURRENT_SESSION_STORAGE_KEY } from '../hooks/useAIChatSessions.shared';
import { useAIPlan } from '../hooks/useAIPlan';
import { useBrowserTaskProgress } from '../hooks/useBrowserTaskProgress';
import { AIAssistantInputSection } from './AIAssistantInputSection';
import { AIAssistantMessagesPanel } from './AIAssistantMessagesPanel';
import { AIAssistantSidebar } from './AIAssistantSidebar';
import type { AIAssistantViewMode } from './AIAssistantSidebar';
import { AIMaterialLibraryView } from './AIMaterialLibraryView';
import { ShareConversationDialog } from './ShareConversationDialog';
import { ToolConfirmationDialog } from './ToolConfirmationDialog';

const AI_INPUT_PANEL_SIZE_KEY = 'ai-assistant-input-panel-height';
const DEFAULT_AI_INPUT_PANEL_SIZE = 260;
const MIN_AI_INPUT_PANEL_SIZE = 180;
const AI_SIDEBAR_SIZE_KEY = 'ai-assistant-sidebar-width';
const AI_SIDEBAR_COLLAPSED_KEY = 'ai-assistant-sidebar-collapsed';
const DEFAULT_AI_SIDEBAR_SIZE = 220;
const MIN_AI_SIDEBAR_SIZE = 144;
const MAX_AI_SIDEBAR_SIZE = 320;

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

function getSavedSidebarSize(): number {
  const saved = Number(localStorage.getItem(AI_SIDEBAR_SIZE_KEY));
  const preferred = Number.isFinite(saved) && saved > 0 ? saved : DEFAULT_AI_SIDEBAR_SIZE;
  const available = Math.max(MIN_AI_SIDEBAR_SIZE, window.innerWidth - 184);
  return Math.min(MAX_AI_SIDEBAR_SIZE, available, Math.max(MIN_AI_SIDEBAR_SIZE, preferred));
}

function getSavedSidebarCollapsed(): boolean {
  return localStorage.getItem(AI_SIDEBAR_COLLAPSED_KEY) === 'true';
}

function saveSidebarSize(sizes: number[]): void {
  if (sizes.length !== 2 || sizes[0] <= 0) return;
  const width = Math.min(MAX_AI_SIDEBAR_SIZE, Math.max(MIN_AI_SIDEBAR_SIZE, sizes[0]));
  localStorage.setItem(AI_SIDEBAR_SIZE_KEY, String(Math.round(width)));
}

function getLatestUsage(messages: ReturnType<typeof useAIChat>['messages']) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].usage) {
      return messages[index].usage;
    }
  }
  return undefined;
}

interface AIAssistantViewProps {
  onModuleSelect: (tabId: TabId) => void;
  sidebarFooter?: ReactNode;
}

export function AIAssistantView({ onModuleSelect, sidebarFooter }: AIAssistantViewProps) {
  const {
    messages,
    status,
    error,
    pendingToolCall,
    pendingToolCalls,
    pendingBuild,
    sessions,
    currentRole,
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
    selectRole,
    deleteSession,
    duplicateSession,
    updateSessionTitle,
    setSessionPinned,
    resetProvider,
    completeBuild,
    cancelBuild,
    summarizeSession,
    setYoloMode,
    shareSession,
    importConversation,
  } = useAIChat();

  const { toast } = useToast();
  const { confirm } = useConfirmDialog();
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [browserTaskRevision, setBrowserTaskRevision] = useState(0);
  const [invalidatedBrowserTaskIds, setInvalidatedBrowserTaskIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<AIAssistantViewMode>('chat');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getSavedSidebarCollapsed);
  const [sidebarWidth, setSidebarWidth] = useState(getSavedSidebarSize);
  const [inputDraft, setInputDraft] = useState<{ value: string; key: string } | null>(null);
  const [replayBuildJob, setReplayBuildJob] = useState<{
    jobUrl: string;
    jobName: string;
    envId?: string;
  } | null>(null);
  const [shareTarget, setShareTarget] = useState<{
    session: AISession;
    messages: ChatMessage[];
  } | null>(null);

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
  const recentActions = useLiveQuery(() => listRecentActions(), []) ?? [];
  const sidebarSessions = useLiveQuery(() => listSessions(), []) ?? sessions;
  const sessionIdsWithMessages = useLiveQuery(() => listSessionIdsWithMessages(), []) ?? [];

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

  useEffect(() => {
    const handleImportedSession = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (typeof changes[AI_CURRENT_SESSION_STORAGE_KEY]?.newValue === 'string') {
        setViewMode('chat');
      }
    };

    browser.storage.session.onChanged.addListener(handleImportedSession);
    return () => browser.storage.session.onChanged.removeListener(handleImportedSession);
  }, []);

  const enableYoloAndConfirm = useCallback(async () => {
    setYoloMode(true);
    await browser.storage.session.set({ [YOLO_MODE_KEY]: true });
    await confirmAllToolCalls();
  }, [confirmAllToolCalls, setYoloMode]);

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
      setViewMode('chat');
    },
    [switchSession]
  );

  const handleCreateSession = useCallback(async () => {
    setViewMode('chat');
    if (messages.length === 0) return;

    setInputDraft(null);
    await createNewSession();
  }, [createNewSession, messages.length]);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      const session = sidebarSessions.find((item) => item.id === id);
      const confirmed = await confirm(
        `确定要删除会话「${session?.title ?? '未命名会话'}」吗？\n删除后无法恢复。`,
        '确认删除会话',
        'danger'
      );
      if (!confirmed) return;

      try {
        setInputDraft(null);
        await deleteSession(id);
      } catch (error) {
        logger.error('[AIChat] Failed to delete session:', error);
        toast('删除会话失败，请重试', 'error');
      }
    },
    [confirm, deleteSession, sidebarSessions, toast]
  );

  const handleDuplicateSession = useCallback(
    async (id: string) => {
      try {
        setInputDraft(null);
        await duplicateSession(id);
        setViewMode('chat');
        toast('会话已复制', 'success');
      } catch (error) {
        logger.error('[AIChat] Failed to duplicate session:', error);
        toast(error instanceof Error ? error.message : '复制会话失败，请重试', 'error');
      }
    },
    [duplicateSession, toast]
  );

  const handleUpdateSessionTitle = useCallback(
    async (id: string, title: string) => {
      try {
        await updateSessionTitle(id, title);
      } catch (error) {
        logger.error('[AIChat] Failed to update session title:', error);
        toast(error instanceof Error ? error.message : '修改会话标题失败，请重试', 'error');
      }
    },
    [toast, updateSessionTitle]
  );

  const handleSetSessionPinned = useCallback(
    async (id: string, pinned: boolean) => {
      try {
        await setSessionPinned(id, pinned);
        toast(pinned ? '会话已置顶' : '已取消会话置顶', 'success');
      } catch (error) {
        logger.error('[AIChat] Failed to update session pin:', error);
        toast(error instanceof Error ? error.message : '更新会话置顶状态失败，请重试', 'error');
      }
    },
    [setSessionPinned, toast]
  );

  const handleViewModeChange = useCallback((mode: AIAssistantViewMode) => {
    if (mode !== 'chat') setInputDraft(null);
    setViewMode(mode);
  }, []);

  const handleSidebarVisibleChange = (index: number, visible: boolean) => {
    if (index !== 0) return;
    setSidebarCollapsed(!visible);
    if (visible) {
      localStorage.removeItem(AI_SIDEBAR_COLLAPSED_KEY);
    } else {
      localStorage.setItem(AI_SIDEBAR_COLLAPSED_KEY, 'true');
    }
  };

  const handleSidebarSizeChange = (sizes: number[]) => {
    if (sizes.length === 2 && sizes[0] > 0) setSidebarWidth(sizes[0]);
  };

  const handleExpandSidebar = () => {
    localStorage.removeItem(AI_SIDEBAR_COLLAPSED_KEY);
    setSidebarCollapsed(false);
  };

  const handleCollapseSidebar = () => {
    localStorage.setItem(AI_SIDEBAR_COLLAPSED_KEY, 'true');
    setSidebarCollapsed(true);
  };

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

  const handleGenerateTestCase = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(TEST_CASE_GENERATE_PROMPT);
      toast('生成测试用例提示词已复制，请粘贴给你的 Agent', 'success');
    } catch (error) {
      logger.error('[AIChat] Failed to copy test case generation prompt:', error);
      toast(error instanceof Error ? error.message : '复制生成提示词失败，请重试', 'error');
    }
  }, [toast]);

  const handleUseConversation = useCallback(
    async (materialId: string) => {
      await importConversation(materialId);
      setViewMode('chat');
    },
    [importConversation]
  );

  const handleExecuteTestProject = useCallback(
    async (project: { id: string; title: string }) => {
      try {
        await createNewSession();
        setInputDraft({
          value: buildTestProjectExecutionPrompt(project.title, project.id),
          key: crypto.randomUUID(),
        });
        setViewMode('chat');
      } catch (error) {
        logger.error('[AIChat] Failed to start test project execution:', error);
        toast('无法创建项目执行会话，请重试', 'error');
      }
    },
    [createNewSession, toast]
  );

  const handleOpenShareConversation = useCallback(
    async (session: AISession) => {
      try {
        const targetMessages =
          session.id === sessionId ? messages : await getMessagesBySession(session.id);
        if (targetMessages.length === 0) {
          toast('该会话没有可分享的消息', 'error');
          return;
        }
        setShareTarget({ session, messages: targetMessages });
      } catch (error) {
        logger.error('[AIChat] Failed to load conversation for sharing:', error);
        toast('无法读取会话内容，请重试', 'error');
      }
    },
    [messages, sessionId, toast]
  );

  const handleShareConversation = useCallback(
    async (input: { title: string; summary?: string }) => {
      if (!shareTarget) return;
      try {
        await shareSession(shareTarget.session.id, input);
        toast('会话已永久分享到团队物料库', 'success');
      } catch (error) {
        logger.error('[AIChat] Failed to share conversation:', error);
        toast(error instanceof Error ? error.message : '分享会话失败', 'error');
        throw error;
      }
    },
    [shareSession, shareTarget, toast]
  );

  const handleExportToClipboard = useCallback(async () => {
    if (!sessionId || messages.length === 0) return;
    try {
      const currentSession = sidebarSessions.find((s) => s.id === sessionId);
      const markdown = exportChatToMarkdown(
        messages,
        currentSession?.title || '会话',
        currentSession?.role?.title
      );
      await navigator.clipboard.writeText(markdown);
      toast('已复制到剪贴板', 'success');
    } catch (error) {
      logger.error('[AIChat] Failed to copy markdown:', error);
      toast(error instanceof Error ? error.message : '复制失败，请重试', 'error');
    }
  }, [sessionId, messages, sidebarSessions, toast]);

  const handleExportToFile = useCallback(async () => {
    if (!sessionId || messages.length === 0) return;
    try {
      const currentSession = sidebarSessions.find((s) => s.id === sessionId);
      const markdown = exportChatToMarkdown(
        messages,
        currentSession?.title || '会话',
        currentSession?.role?.title
      );
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      anchor.href = url;
      anchor.download = `${currentSession?.title || '会话'}-${dateStr}.md`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      toast('会话已导出', 'success');
    } catch (error) {
      logger.error('[AIChat] Failed to export markdown:', error);
      toast(error instanceof Error ? error.message : '导出失败，请重试', 'error');
    }
  }, [sessionId, messages, sidebarSessions, toast]);

  const handleReplayRecentAction = useCallback(
    async (action: RecentAction) => {
      try {
        if (action.type === 'link_visit') {
          const link = await getLink({ id: action.targetId });
          if (!link) {
            await deleteRecentAction(action.type, action.targetId);
            toast('链接已不存在', 'error');
            return;
          }
          await openLink(link.url);
          await recordRecentAction({
            type: 'link_visit',
            targetId: link.id,
            label: link.name,
          });
          return;
        }

        if (action.type === 'jenkins_build') {
          if (!(await isJenkinsFeatureEnabled('buildLifecycle'))) {
            toast('Jenkins 构建生命周期能力已关闭', 'error');
            return;
          }
          const job = await getJob({ jobUrl: action.jobUrl || action.targetId });
          if (!job || (action.envId && job.env !== action.envId)) {
            await deleteRecentAction(action.type, action.targetId);
            toast('Jenkins Job 已不存在或已不属于原环境', 'error');
            return;
          }
          setReplayBuildJob({
            jobUrl: job.url,
            jobName: job.name,
            envId: job.env,
          });
          return;
        }

        const account = await getTotpAccount(action.targetId);
        if (!account) {
          await deleteRecentAction(action.type, action.targetId);
          toast('验证器账户已不存在', 'error');
          return;
        }

        const pinConfig = await getTotpPinConfig();
        if (pinConfig.enabled && !isTotpPinSessionUnlocked()) {
          setTotpReplayIntent(action);
          onModuleSelect('totp');
          return;
        }

        await copyTotpCode(account, Date.now());
        toast('验证码已复制', 'success');
      } catch (error) {
        logger.error('[AIChat] Failed to replay recent action:', error);
        toast('操作回放失败，请重试', 'error');
      }
    },
    [onModuleSelect, toast]
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
    <div className="relative h-full min-h-0 min-w-0 overflow-hidden bg-background">
      <Allotment
        separator
        onChange={handleSidebarSizeChange}
        onDragEnd={saveSidebarSize}
        onVisibleChange={handleSidebarVisibleChange}
      >
        <Allotment.Pane
          preferredSize={getSavedSidebarSize()}
          minSize={MIN_AI_SIDEBAR_SIZE}
          maxSize={MAX_AI_SIDEBAR_SIZE}
          snap
          visible={!sidebarCollapsed}
        >
          <AIAssistantSidebar
            sessions={sidebarSessions}
            currentSessionId={viewMode === 'chat' ? sessionId : null}
            sessionStatuses={sessionStatuses}
            sessionIdsWithMessages={sessionIdsWithMessages}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
            onDuplicateSession={handleDuplicateSession}
            onUpdateSessionTitle={handleUpdateSessionTitle}
            onSetSessionPinned={handleSetSessionPinned}
            onCreateSession={handleCreateSession}
            onShareSession={handleOpenShareConversation}
            footer={sidebarFooter}
          />
        </Allotment.Pane>
        <Allotment.Pane minSize={180}>
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            {viewMode === 'materials' ? (
              <AIMaterialLibraryView
                onGenerateTestCase={handleGenerateTestCase}
                onImportTestCase={handleImportTestCase}
                onExecuteTestProject={handleExecuteTestProject}
                onUseConversation={handleUseConversation}
              />
            ) : (
              <Allotment
                vertical
                separator
                onDragEnd={saveInputPanelSize}
                className="min-h-0 flex-1"
              >
                <Allotment.Pane minSize={96}>
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
                      recentActions={recentActions}
                      onReplayRecentAction={handleReplayRecentAction}
                      currentRole={currentRole}
                      onRoleSelect={selectRole}
                      onExportToClipboard={handleExportToClipboard}
                      onExportToFile={handleExportToFile}
                    />
                  </div>
                </Allotment.Pane>
                <Allotment.Pane
                  preferredSize={getSavedInputPanelSize()}
                  minSize={MIN_AI_INPUT_PANEL_SIZE}
                >
                  <div className="h-full min-h-[180px] overflow-y-auto">
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
          </div>
        </Allotment.Pane>
      </Allotment>

      <Button
        variant="outline"
        size="icon"
        onClick={sidebarCollapsed ? handleExpandSidebar : handleCollapseSidebar}
        style={{ left: sidebarCollapsed ? 0 : sidebarWidth }}
        className="absolute top-1/2 z-30 h-10 w-5 -translate-y-1/2 rounded-l-none rounded-r border-l-0 bg-background/85 px-0 text-muted-foreground shadow-sm hover:!-translate-y-1/2 hover:text-foreground active:!-translate-y-1/2"
        title={sidebarCollapsed ? '展开会话侧栏' : '折叠会话侧栏'}
        aria-label={sidebarCollapsed ? '展开会话侧栏' : '折叠会话侧栏'}
      >
        {sidebarCollapsed ? (
          <PanelLeftOpen className="h-3 w-3" />
        ) : (
          <PanelLeftClose className="h-3 w-3" />
        )}
      </Button>

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

      {replayBuildJob && (
        <BuildDialog
          isOpen={true}
          jobUrl={replayBuildJob.jobUrl}
          jobName={replayBuildJob.jobName}
          envId={replayBuildJob.envId}
          onClose={() => setReplayBuildJob(null)}
        />
      )}

      <ShareConversationDialog
        open={shareTarget !== null}
        sessionTitle={shareTarget?.session.title ?? '精彩会话'}
        messages={shareTarget?.messages ?? []}
        onOpenChange={(open) => {
          if (!open) setShareTarget(null);
        }}
        onShare={handleShareConversation}
      />
    </div>
  );
}
