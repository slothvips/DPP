// AI Assistant View - Main conversation interface
import { Send, Settings, Trash2, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAIChat } from '../hooks/useAIChat';
import { AIConfigDialog, isAIConfigConfigured } from './AIConfigDialog';
import { ToolConfirmationDialog } from './ToolConfirmationDialog';

export function AIAssistantView() {
  const {
    messages,
    status,
    error,
    isConnected,
    pendingToolCall,
    sendMessage,
    confirmToolCall,
    cancelToolCall,
    clearMessages,
    checkConnection,
  } = useAIChat();

  const [input, setInput] = useState('');
  const [isConfigMissing, setIsConfigMissing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check if config is configured on mount
  useEffect(() => {
    isAIConfigConfigured().then((configured) => {
      setIsConfigMissing(!configured);
    });
  }, []);

  // Re-check config when connection status changes (in case config was saved)
  const handleConfigSaved = () => {
    setIsConfigMissing(false);
    checkConnection();
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check connection on mount
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || status === 'loading' || status === 'streaming') {
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
      {/* Header with connection status */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="w-4 h-4 text-green-500" data-testid="connection-connected" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" data-testid="connection-disconnected" />
          )}
          <span className="text-xs text-muted-foreground">{isConnected ? '已连接' : '未连接'}</span>
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
            title="清空对话"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {/* Config not configured prompt */}
        {isConfigMissing && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-4">⚙️</div>
            <p className="text-sm font-medium">需要配置 AI 服务</p>
            <p className="text-xs mt-1 text-muted-foreground">请先配置 Ollama 服务地址和模型</p>
            <AIConfigDialog onSaved={handleConfigSaved}>
              <Button className="mt-4" size="sm">
                去配置
              </Button>
            </AIConfigDialog>
          </div>
        )}

        {/* Welcome message when empty and configured */}
        {!isConfigMissing && messages.length === 0 && (
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
                  : message.role === 'tool'
                    ? 'bg-muted text-xs font-mono'
                    : 'bg-muted'
              }`}
            >
              {message.role === 'tool' && message.name && (
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  {message.name} 结果:
                </div>
              )}
              <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
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
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="发送消息... (Shift+Enter 换行)"
            disabled={status === 'loading' || status === 'streaming' || status === 'confirming'}
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
            data-testid="ai-chat-input"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || status === 'loading' || status === 'streaming'}
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
        onConfirm={confirmToolCall}
        onCancel={cancelToolCall}
      />
    </div>
  );
}
