import { format } from 'date-fns';
import { Pin, Trash2 } from 'lucide-react';
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
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        onFocusHandled?.();
      }, 100);
    }
  }, [isFocused, onFocusHandled]);

  // Generate random transforms once
  const transforms = useMemo(() => {
    const rotation = Math.random() * 3 - 1.5; // -1.5deg to 1.5deg
    const xOffset = Math.random() * 10 - 5; // -5px to 5px
    const yOffset = Math.random() * 10 - 5; // -5px to 5px
    return { rotation, xOffset, yOffset };
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
    if (content.trim() !== item.content) {
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
          <div className="bg-red-500 w-3 h-3 rounded-full border border-red-700 shadow-sm"></div>
          <Pin className="w-5 h-5 text-zinc-700 fill-zinc-700 absolute -top-1 -left-1 opacity-80" />
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
            className="w-full bg-transparent border-none outline-none ring-0 shadow-none focus:ring-0 focus:outline-none focus:border-none resize-none p-0 text-base text-slate-800 placeholder:text-slate-400 placeholder:italic overflow-hidden"
            style={{
              ...commonStyle,
              minHeight: minEditHeight,
            }}
          />
        ) : (
          <div
            onClick={() => {
              if (!readOnly) {
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
            className={`markdown-preview w-full h-full min-h-[140px] text-base text-slate-800 ${!readOnly ? 'cursor-text' : 'cursor-default'}`}
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
                      className="border-l-4 border-slate-400/30 pl-3 italic my-2 text-slate-600"
                      {...props}
                    />
                  ),
                  a: ({ node: _node, ...props }) => (
                    <a
                      className="text-blue-600 hover:underline cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(props.href, '_blank');
                      }}
                      {...props}
                    />
                  ),
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  code: ({ node: _node, className, children, ...props }: any) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !match && !String(children).includes('\n');
                    return (
                      <code
                        className={`${isInline ? 'bg-black/5 rounded px-1 py-0.5 mx-0.5 text-sm font-mono' : 'block bg-black/5 rounded p-2 my-2 text-sm font-mono overflow-x-auto'}`}
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
                          className="mr-2 cursor-pointer accent-slate-700"
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
              <span className="text-slate-400 italic">写点什么...</span>
            )}
          </div>
        )}
      </div>

      {/* Action Bar - Only visible on hover */}
      {!readOnly && (
        <div className="flex justify-between items-end mt-4 pt-2 border-t border-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="text-[10px] text-slate-500 font-mono">
            {format(item.createdAt, 'MM-dd HH:mm')}
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-black/5 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                onPin(item.id, !item.pinned);
              }}
              title={item.pinned ? '取消置顶' : '置顶'}
            >
              <Pin
                className={`w-3.5 h-3.5 ${item.pinned ? 'fill-slate-700 text-slate-700' : 'text-slate-500'}`}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-500/70 hover:text-red-600 hover:bg-red-500/10 rounded-full"
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
