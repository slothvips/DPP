// AI Assistant View - Main conversation interface
import { Send, Settings, Trash2 } from 'lucide-react';
import remarkGfm from 'remark-gfm';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BuildDialog } from '@/features/jenkins/components/BuildDialog';
import { useAIChat } from '../hooks/useAIChat';
import { AIConfigDialog, isAIConfigConfigured } from './AIConfigDialog';
import { AISessionList } from './AISessionList';
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
  } = useAIChat();

  const [input, setInput] = useState('');
  const [isConfigMissing, setIsConfigMissing] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check if config is configured on mount
  useEffect(() => {
    isAIConfigConfigured().then((configured) => {
      setIsConfigMissing(!configured);
    });

    // Check for preset prompt from other tabs (e.g., smart import)
    const presetPrompt = localStorage.getItem('dpp_ai_preset_prompt');
    if (presetPrompt) {
      setInput(presetPrompt);
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

  // Auto-scroll to bottom only when user is near bottom
  useEffect(() => {
    if (isNearBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isNearBottom]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || status === 'loading' || status === 'streaming') {
      return;
    }

    // Check if AI config is configured before sending
    const configured = await isAIConfigConfigured();
    if (!configured) {
      setIsConfigMissing(true);
      return;
    }

    setInput('');
    await sendMessage(content);

    // Focus back on textarea after sending
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    clearMessages();
    setInput('');
  };

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
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar"
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
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : message.name
                    ? 'bg-muted text-xs font-mono'
                    : 'bg-muted'
              }`}
            >
              {message.name && (
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  {message.name} 结果:
                </div>
              )}
              <div className="text-sm prose prose-sm dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              </div>
            </div>
          </div>
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
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLoadingModel ? '模型加载中...' : '发送消息... (Shift+Enter 换行)'}
            disabled={
              status === 'loading' ||
              status === 'streaming' ||
              status === 'confirming' ||
              isLoadingModel
            }
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
            data-testid="ai-chat-input"
          />
          <Button
            onClick={handleSend}
            disabled={
              !input.trim() || status === 'loading' || status === 'streaming' || isLoadingModel
            }
            size="icon"
            data-testid="ai-chat-send"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
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
