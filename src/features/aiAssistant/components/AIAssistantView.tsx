// AI Assistant View - Main conversation interface
import {
  ArrowDown,
  Database,
  FileText,
  Languages,
  Plus,
  Scissors,
  Settings,
  Trash2,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { BuildDialog } from '@/features/jenkins/components/BuildDialog';
import { cn } from '@/utils/cn';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { useAIChat } from '../hooks/useAIChat';
import { AIConfigDialog, isAIConfigConfigured } from './AIConfigDialog';
import { AISessionList } from './AISessionList';
import { ChatInput } from './ChatInput';
import { MessageItem } from './MessageItem';
import { TabSelector } from './TabSelector';
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
    yoloMode,
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
    setYoloMode,
  } = useAIChat();

  const { toast } = useToast();
  const { confirm } = useConfirmDialog();

  const [isConfigMissing, setIsConfigMissing] = useState(false);
  const [selectedTabId, setSelectedTabId] = useState<number | null>(null);
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

    const checkPreset = async () => {
      // Try storage.session first (new way)
      try {
        const result = await browser.storage.session.get('dpp_ai_preset_prompt');
        const preset = result?.dpp_ai_preset_prompt as string | undefined;
        if (preset) {
          setPresetPrompt(preset);
          await browser.storage.session.remove('dpp_ai_preset_prompt');
          return;
        }
      } catch {
        // storage.session not available, try localStorage
      }

      // Fallback to localStorage (old way with reload)
      const localPreset = localStorage.getItem('dpp_ai_preset_prompt');
      if (localPreset) {
        setPresetPrompt(localPreset);
        localStorage.removeItem('dpp_ai_preset_prompt');
      }
    };
    checkPreset();
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
          <span className="text-xs text-muted-foreground">D仔</span>
          <AISessionList
            sessions={sessions}
            currentSessionId={sessionId}
            onSelectSession={switchSession}
            onDeleteSession={deleteSession}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={createNewSession}
            title="新建会话"
            className="text-xs h-7"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            新建会话
          </Button>
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

          {/* Welcome message when empty and configured */}
          {!isConfigMissing && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground px-4">
              <div className="text-4xl mb-4">🤖</div>
              <p className="text-sm font-medium">你好！我是 D仔</p>
              <p className="text-xs mt-2">你可以用自然语言与我对话，我来帮你完成任务</p>
              <p className="text-xs mt-1">还可以管理链接、便签、Jenkins 任务等</p>
              <p className="text-xs mt-3 mb-4">使用快捷指令按钮或直接发送消息</p>
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
          <div className="mb-2 p-2 bg-warning/10 dark:bg-warning/20 border border-warning/30 rounded-md">
            <div className="flex items-center justify-between">
              <p className="text-xs text-warning">未配置 AI 服务商，请先配置后才能对话</p>
              <AIConfigDialog onSaved={handleConfigSaved}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-warning hover:text-warning/80"
                >
                  去配置
                </Button>
              </AIConfigDialog>
            </div>
          </div>
        )}
        <ChatInput
          onSend={handleSend}
          onStop={stop}
          disabled={status === 'confirming'}
          isRunning={isRunning}
          placeholder="发送消息... (Shift+Enter 换行)"
          initialInput={presetPrompt}
          rightSlot={
            <div className="flex gap-2 items-center">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">目标页面:</span>
                <TabSelector selectedTabId={selectedTabId} onTabSelect={setSelectedTabId} />
                <span
                  className="text-[10px] text-orange-500 italic cursor-help"
                  title="执行期间请保持页面在前台，不要切换或关闭标签页"
                >
                  (仅支持SPA，请保持页面始终处于前台)
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (!yoloMode) {
                    const ok = await confirm(
                      'YOLO 模式会跳过所有确认对话框，自动执行工具操作，可能导致意外修改。\n\n建议仅在网页操作时开启，避免对数据造成不可逆的更改。\n\n确定要开启吗？',
                      '开启 YOLO 模式',
                      'danger'
                    );
                    if (!ok) return;
                  }
                  setYoloMode(!yoloMode);
                }}
                title="YOLO 模式：自动确认所有工具调用"
                className={cn(
                  'text-xs gap-1 transition-all duration-300 border border-border',
                  yoloMode && 'yolo-button-active'
                )}
              >
                <Zap className={cn('w-3.5 h-3.5', yoloMode && 'fill-primary text-primary')} />
                <span className={yoloMode ? 'text-primary font-medium' : ''}>YOLO</span>
              </Button>
            </div>
          }
          bottomSlot={
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-muted-foreground">页面快捷指令:</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSend('请总结页面的主要内容')}
                disabled={status === 'confirming'}
                className="text-xs"
              >
                <FileText className="w-3 h-3 mr-1" />
                总结页面
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSend('请提取页面的主要内容，并以结构化的格式呈现')}
                disabled={status === 'confirming'}
                className="text-xs"
              >
                <Database className="w-3 h-3 mr-1" />
                提取信息
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSend('请翻译页面的主要内容')}
                disabled={status === 'confirming'}
                className="text-xs"
              >
                <Languages className="w-3 h-3 mr-1" />
                翻译内容
              </Button>
            </div>
          }
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
