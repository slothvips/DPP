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
    return (
      <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`min-w-0 max-w-[85%] overflow-hidden rounded-lg px-3 py-2 ${
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
          <div
            className={
              message.role === 'user'
                ? 'prose prose-sm prose-invert max-w-none break-words [&_code]:break-all [&_pre]:max-w-full [&_pre]:overflow-x-auto'
                : 'text-sm prose prose-sm max-w-none break-words dark:prose-invert [&_code]:break-all [&_pre]:max-w-full [&_pre]:overflow-x-auto'
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
