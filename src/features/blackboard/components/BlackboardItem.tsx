import { format } from 'date-fns';
import { Lock, Pin, Trash2, Unlock } from 'lucide-react';
import remarkGfm from 'remark-gfm';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import type { BlackboardItem } from '../types';

interface BlackboardItemProps {
  item: BlackboardItem;
  onUpdate: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onPin: (id: string, pinned: boolean) => Promise<void>;
  onLock: (id: string, locked: boolean) => Promise<void>;
  onResize?: () => void;
  color: string;
  readOnly?: boolean;
  isFocused?: boolean;
  onFocusHandled?: () => void;
}

export function BlackboardItemView({
  item,
  onUpdate,
  onDelete,
  onPin,
  onLock,
  onResize,
  color,
  readOnly,
  isFocused,
  onFocusHandled,
}: BlackboardItemProps) {
  const [content, setContent] = useState(item.content);
  const [isEditing, setIsEditing] = useState(false);
  const [minEditHeight, setMinEditHeight] = useState('140px');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle auto-focus from parent
  useEffect(() => {
    if (isFocused) {
      setIsEditing(true);
      // Small timeout to ensure DOM is ready and layout is stable
      const timer = setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        onFocusHandled?.();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isFocused, onFocusHandled]);

  // Generate random transforms once (disabled for better layout)
  const transforms = useMemo(() => {
    return { rotation: 0, xOffset: 0, yOffset: 0 };
  }, []);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      const prevHeight = textarea.style.height;
      textarea.style.height = 'auto';
      const newHeight = `${textarea.scrollHeight}px`;
      textarea.style.height = newHeight;

      if (prevHeight !== newHeight) {
        onResize?.();
      }
    }
  }, [onResize]);

  // Sync local state when prop updates (e.g. from sync)
  useEffect(() => {
    setContent(item.content);
  }, [item.content]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
      adjustHeight();
    }
  }, [isEditing, adjustHeight]);

  const handleBlur = async () => {
    setIsEditing(false);
    if (content !== item.content) {
      await onUpdate(item.id, content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Only save on Meta+Enter, allow regular Enter for new lines
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.currentTarget.blur(); // Trigger blur to save
    }
  };

  const commonStyle = {
    fontFamily: '"Comic Sans MS", "Chalkboard SE", "Marker Felt", sans-serif',
    lineHeight: '1.6',
  };

  return (
    <div
      ref={containerRef}
      className={`group relative p-5 rounded-sm shadow-md hover:shadow-xl hover:scale-[1.02] hover:z-10 transition-all duration-300 min-h-[180px] flex flex-col ${color}`}
      style={{
        transform: `rotate(${transforms.rotation}deg) translate(${transforms.xOffset}px, ${transforms.yOffset}px)`,
      }}
    >
      {/* Pin Indicator */}
      {item.pinned && (
        <div className="absolute -top-3 -right-3 z-20 transform rotate-12 drop-shadow-md">
          <div className="bg-destructive w-3 h-3 rounded-full border border-destructive/70 shadow-sm"></div>
          <Pin className="w-5 h-5 text-foreground fill-foreground absolute -top-1 -left-1 opacity-80" />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 w-full relative min-h-[140px]">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              adjustHeight();
            }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="写点什么..."
            className="w-full bg-transparent border-none outline-none ring-0 shadow-none focus:ring-0 focus:outline-none focus:border-none resize-none p-0 text-base text-foreground placeholder:text-muted-foreground placeholder:italic overflow-hidden"
            style={{
              ...commonStyle,
              minHeight: minEditHeight,
            }}
          />
        ) : (
          <div
            onClick={() => {
              if (!readOnly && !item.locked) {
                // Capture current height before switching to edit mode
                // This prevents the card from shrinking (source is usually smaller than preview)
                if (containerRef.current) {
                  // Get the height of the content area specifically
                  const contentHeight =
                    containerRef.current.querySelector('.markdown-preview')?.clientHeight;
                  if (contentHeight) {
                    setMinEditHeight(`${Math.max(140, contentHeight)}px`);
                  }
                }
                setIsEditing(true);
              }
            }}
            className={`markdown-preview w-full h-full min-h-[140px] text-base text-foreground ${!readOnly && !item.locked ? 'cursor-text' : 'cursor-default'}`}
            style={commonStyle}
          >
            {content ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ node: _node, ...props }) => (
                    <p className="mb-2 last:mb-0 break-words" {...props} />
                  ),
                  h1: ({ node: _node, ...props }) => (
                    <h1 className="text-2xl font-bold mb-2 mt-1" {...props} />
                  ),
                  h2: ({ node: _node, ...props }) => (
                    <h2 className="text-xl font-bold mb-2 mt-1" {...props} />
                  ),
                  h3: ({ node: _node, ...props }) => (
                    <h3 className="text-lg font-bold mb-1 mt-1" {...props} />
                  ),
                  ul: ({ node: _node, ...props }) => (
                    <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />
                  ),
                  ol: ({ node: _node, ...props }) => (
                    <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />
                  ),
                  li: ({ node: _node, ...props }) => <li className="pl-1" {...props} />,
                  blockquote: ({ node: _node, ...props }) => (
                    <blockquote
                      className="border-l-4 border-border pl-3 italic my-2 text-muted-foreground"
                      {...props}
                    />
                  ),
                  a: ({ node: _node, ...props }) => (
                    <a
                      className="bg-blue-500/10 dark:bg-blue-400/20 text-blue-600 dark:text-blue-300 px-1 py-0.5 rounded hover:bg-blue-500/20 dark:hover:bg-blue-400/30 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(props.href, '_blank');
                      }}
                      {...props}
                    />
                  ),
                  code: ({ node: _node, className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !match && !String(children).includes('\n');
                    return (
                      <code
                        className={`${isInline ? 'bg-muted rounded px-1 py-0.5 mx-0.5 text-sm font-mono dark:bg-muted/80' : 'block bg-muted rounded p-2 my-2 text-sm font-mono overflow-x-auto dark:bg-muted/80'}`}
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  // Style checkboxes from GFM task lists
                  input: ({ node: _node, ...props }) => {
                    if (props.type === 'checkbox') {
                      return (
                        <input
                          type="checkbox"
                          className="mr-2 cursor-pointer accent-primary"
                          checked={props.checked}
                          readOnly
                          {...props}
                        />
                      );
                    }
                    return <input {...props} />;
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            ) : (
              <span className="text-muted-foreground italic">写点什么...</span>
            )}
          </div>
        )}
      </div>

      {/* Action Bar - Only visible on hover */}
      {!readOnly && (
        <div className="flex justify-between items-end mt-4 pt-2 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="text-[10px] text-muted-foreground font-mono">
            {format(item.createdAt, 'MM-dd HH:mm')}
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-muted rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                onPin(item.id, !item.pinned);
              }}
              title={item.pinned ? '取消置顶' : '置顶'}
            >
              <Pin
                className={`w-3.5 h-3.5 ${item.pinned ? 'fill-foreground text-foreground' : 'text-muted-foreground'}`}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-muted rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                onLock(item.id, !item.locked);
              }}
              title={item.locked ? '解锁' : '锁定'}
            >
              {item.locked ? (
                <Unlock className="w-3.5 h-3.5 text-warning" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              title="删除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
