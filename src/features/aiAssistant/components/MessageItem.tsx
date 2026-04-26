import remarkGfm from 'remark-gfm';
import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '../types';

interface MessageItemProps {
  message: ChatMessage;
}

/**
 * Message item component with memoization to prevent unnecessary re-renders.
 * Uses React.memo with custom comparison for optimal performance.
 */
export const MessageItem = memo(
  function MessageItem({ message }: MessageItemProps) {
    const isUser = message.role === 'user';
    const isToolResult = Boolean(message.name);

    return (
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`min-w-0 max-w-[88%] overflow-hidden rounded-2xl border px-4 py-3 shadow-sm transition-colors ${
            isUser
              ? 'border-primary/18 bg-primary text-primary-foreground shadow-primary/10'
              : isToolResult
                ? 'border-border/70 bg-muted/60 text-foreground'
                : 'border-border/70 bg-background/96 text-foreground'
          }`}
        >
          {message.name && (
            <div className="mb-2 inline-flex rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-medium text-muted-foreground ring-1 ring-border/60">
              {message.name} 结果
            </div>
          )}
          <div
            className={
              isUser
                ? 'prose prose-sm prose-invert max-w-none break-words [&_code]:break-all [&_pre]:max-w-full [&_pre]:overflow-x-auto'
                : 'prose prose-sm max-w-none break-words dark:prose-invert [&_code]:break-all [&_pre]:max-w-full [&_pre]:overflow-x-auto'
            }
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        </div>
      </div>
    );
  },
  // Custom comparison: only re-render when message content actually changes
  (prevProps, nextProps) => {
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.content === nextProps.message.content &&
      prevProps.message.role === nextProps.message.role
    );
  }
);
