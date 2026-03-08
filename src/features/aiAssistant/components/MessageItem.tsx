import remarkGfm from 'remark-gfm';
import { memo, useMemo } from 'react';
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
    // Cache ReactMarkdown rendering result
    const markdownContent = useMemo(
      () => (
        <div className="text-sm prose prose-sm dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      ),
      [message.content]
    );

    return (
      <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
          {markdownContent}
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
