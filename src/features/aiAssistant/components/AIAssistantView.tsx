// AI Assistant View - Main conversation interface
import { ArrowDown, Scissors, Settings, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { BuildDialog } from '@/features/jenkins/components/BuildDialog';
import { useAIChat } from '../hooks/useAIChat';
import { AIConfigDialog, isAIConfigConfigured } from './AIConfigDialog';
import { AISessionList } from './AISessionList';
import { ChatInput } from './ChatInput';
import { MessageItem } from './MessageItem';
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
    isLoadingModel,
    modelLoadProgress,
    modelLoadStatus,
    currentProvider,
    sendMessage,
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

  const [isConfigMissing, setIsConfigMissing] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [presetPrompt, setPresetPrompt] = useState<string>('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Check if config is configured on mount
  useEffect(() => {
    isAIConfigConfigured().then((configured) => {
      setIsConfigMissing(!configured);
    });

    // Check for preset prompt from other tabs (e.g., smart import)
    const preset = localStorage.getItem('dpp_ai_preset_prompt');
    if (preset) {
      setPresetPrompt(preset);
      localStorage.removeItem('dpp_ai_preset_prompt');
    }
  }, []);

  // Re-check config when config is saved
  const handleConfigSaved = () => {
    setIsConfigMissing(false);
    // Reset provider cache so new config takes effect immediately
    resetProvider();
  };

  // Handle scroll event to detect if user is near bottom
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    // Consider "near bottom" if within 100px of the bottom
    const nearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setIsNearBottom(nearBottom);
  };

  // Scroll to bottom when button is clicked
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      setIsNearBottom(true);
    }
  };

  // Auto-scroll to bottom only when user is near bottom
  useEffect(() => {
    if (isNearBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isNearBottom]);

  const handleSend = useCallback(
    async (content: string) => {
      // Check if AI config is configured before sending
      const configured = await isAIConfigConfigured();
      if (!configured) {
        setIsConfigMissing(true);
        return;
      }
      await sendMessage(content);
    },
    [sendMessage]
  );

  const handleClear = () => {
    clearMessages();
  };

  const handleSummarize = useCallback(async () => {
    if (isSummarizing) return;

    if (messages.length === 0) {
      toast('无法压缩', 'error');
      return;
    }

    if (status === 'loading' || status === 'streaming') {
      toast('请稍候', 'info');
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
  }, [isSummarizing, messages, status, summarizeSession, switchSession, toast]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">AI 助手</span>
          <AISessionList
            sessions={sessions}
            currentSessionId={sessionId}
            onSelectSession={switchSession}
            onCreateSession={createNewSession}
            onDeleteSession={deleteSession}
          />
        </div>
        <div className="flex items-center gap-1">
          <AIConfigDialog onSaved={handleConfigSaved}>
            <Button variant="ghost" size="sm" title="AI 设置" data-testid="ai-config-button">
              <Settings className="w-4 h-4" />
            </Button>
          </AIConfigDialog>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSummarize}
            disabled={
              messages.length === 0 ||
              status === 'loading' ||
              status === 'streaming' ||
              isSummarizing
            }
            title="压缩当前会话到新会话"
          >
            <Scissors className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={messages.length === 0}
            title="清空当前会话对话"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Local model warning */}
      {(currentProvider === 'ollama' || currentProvider === 'webllm') && !isLoadingModel && (
        <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-2">
            <span className="text-amber-600 dark:text-amber-400 text-sm">⚠️</span>
            <div className="text-xs text-amber-800 dark:text-amber-200">
              <p className="font-medium">当前使用本地模型，体验可能不佳</p>
              <p className="mt-0.5 opacity-80">
                玩玩就好，别认真~ 如需更好的体验，请切换到 OpenAI、Anthropic 等知名供应商
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-auto p-3 space-y-3 custom-scrollbar"
        >
          {/* Config not configured prompt */}
          {isConfigMissing && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-4">⚙️</div>
              <p className="text-sm font-medium">需要配置 AI 服务</p>
              <p className="text-xs mt-1 text-muted-foreground">请先配置 AI 服务商和模型</p>
              <AIConfigDialog onSaved={handleConfigSaved}>
                <Button className="mt-4" size="sm">
                  去配置
                </Button>
              </AIConfigDialog>
            </div>
          )}

          {/* WebLLM Model Loading Progress */}
          {isLoadingModel && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-4">📥</div>
              <p className="text-sm font-medium">正在加载模型...</p>
              <div className="w-48 h-2 bg-muted rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${modelLoadProgress}%` }}
                />
              </div>
              <p className="text-xs mt-2 text-muted-foreground">
                {modelLoadProgress}% - {modelLoadStatus}
              </p>
              <p className="text-xs mt-1 text-muted-foreground">首次加载需要下载模型，请耐心等待</p>
            </div>
          )}

          {/* Welcome message when empty and configured */}
          {!isConfigMissing && !isLoadingModel && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <div className="text-4xl mb-4">🤖</div>
              <p className="text-sm font-medium">你好！我是 AI 助手</p>
              <p className="text-xs mt-1">我可以帮助你管理链接、便签、Jenkins 任务等</p>
              <p className="text-xs mt-2">直接发送消息开始对话</p>
            </div>
          )}

          {/* Message list */}
          {messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}

          {/* Loading/Streaming indicator */}
          {(status === 'loading' || status === 'streaming') && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-3 py-2">
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">思考中</span>
                  <span className="animate-pulse">...</span>
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex justify-center">
              <div className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
                {error}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to bottom button - show when user scrolls up */}
        {!isNearBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:opacity-90 transition-opacity"
            title="直达底部"
          >
            <ArrowDown className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Input area */}
      <div className="border-t p-3">
        {/* Config missing warning */}
        {isConfigMissing && (
          <div className="mb-2 p-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
            <div className="flex items-center justify-between">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                未配置 AI 服务商，请先配置后才能对话
              </p>
              <AIConfigDialog onSaved={handleConfigSaved}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100"
                >
                  去配置
                </Button>
              </AIConfigDialog>
            </div>
          </div>
        )}
        <ChatInput
          onSend={handleSend}
          disabled={
            status === 'loading' ||
            status === 'streaming' ||
            status === 'confirming' ||
            isLoadingModel
          }
          placeholder={isLoadingModel ? '模型加载中...' : '发送消息... (Shift+Enter 换行)'}
          initialInput={presetPrompt}
        />
      </div>

      {/* Tool Confirmation Dialog */}
      <ToolConfirmationDialog
        pendingToolCall={pendingToolCall}
        pendingToolCalls={pendingToolCalls}
        onConfirm={confirmToolCall}
        onConfirmAll={confirmAllToolCalls}
        onCancel={cancelToolCall}
      />

      {/* Build Dialog - triggered by AI */}
      {pendingBuild && (
        <BuildDialog
          jobUrl={pendingBuild.jobUrl}
          jobName={pendingBuild.jobName}
          isOpen={true}
          onClose={() => {
            // onClose is called before onBuildSuccess in BuildDialog
            // Use setTimeout to let onBuildSuccess run first if it's a success case
            setTimeout(() => cancelBuild(), 0);
          }}
          onBuildSuccess={completeBuild}
        />
      )}
    </div>
  );
}
