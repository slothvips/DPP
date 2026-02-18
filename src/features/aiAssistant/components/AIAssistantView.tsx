// AI Assistant View - Main conversation interface
import { Send, Trash2, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAIChat } from '../hooks/useAIChat';

export function AIAssistantView() {
  const { messages, status, error, isConnected, sendMessage, clearMessages, checkConnection } =
    useAIChat();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {/* Welcome message when empty */}
        {messages.length === 0 && (
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
            disabled={status === 'loading' || status === 'streaming'}
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
    </div>
  );
}
