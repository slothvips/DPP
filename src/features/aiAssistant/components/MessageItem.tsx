import { ChevronRight } from 'lucide-react';
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
    const isToolResult = message.role === 'tool';
    const contentClassName = isUser
      ? 'prose prose-sm prose-invert max-w-none break-words [&_code]:break-all [&_pre]:max-w-full [&_pre]:overflow-x-auto'
      : 'prose prose-sm max-w-none break-words dark:prose-invert [&_code]:break-all [&_pre]:max-w-full [&_pre]:overflow-x-auto';

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
          {isToolResult ? (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {message.name || '工具'} 结果
                </span>
                <span className="group-open:hidden">展开</span>
                <span className="hidden group-open:inline">收起</span>
              </summary>
              <div className="mt-3 border-t border-border/60 pt-3">
                <div className={contentClassName}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                </div>
              </div>
            </details>
          ) : (
            <div className={contentClassName}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    );
  },
  // Custom comparison: only re-render when message content actually changes
  (prevProps, nextProps) => {
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.content === nextProps.message.content &&
      prevProps.message.role === nextProps.message.role &&
      prevProps.message.name === nextProps.message.name
    );
  }
);
