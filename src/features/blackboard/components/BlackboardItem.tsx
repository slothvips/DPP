import { format } from 'date-fns';
import { Lock, Pin, Trash2, Unlock } from 'lucide-react';
import React from 'react';
import { Button } from '@/components/ui/button';
import type { BlackboardItem } from '../types';
import { BlackboardMarkdownPreview } from './BlackboardMarkdownPreview';
import { useBlackboardItemEditor } from './useBlackboardItemEditor';

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
  const {
    content,
    containerRef,
    isEditing,
    minEditHeight,
    textareaRef,
    transforms,
    handleActivateEditing,
    handleBlur,
    handleChange,
    handleKeyDown,
  } = useBlackboardItemEditor({
    item,
    isFocused,
    onFocusHandled,
    onResize,
    onUpdate,
  });

  const commonStyle = {
    fontFamily: '"Comic Sans MS", "Chalkboard SE", "Marker Felt", sans-serif',
    lineHeight: '1.6',
  };

  return (
    <div
      ref={containerRef}
      className={`group relative flex min-h-[172px] flex-col overflow-hidden rounded-[18px] border border-black/6 p-4.5 shadow-sm transition-all duration-300 hover:z-10 hover:scale-[1.01] hover:shadow-lg ${color}`}
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
            onChange={(event) => {
              handleChange(event.target.value);
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
          <BlackboardMarkdownPreview
            content={content}
            commonStyle={commonStyle}
            readOnly={readOnly}
            locked={item.locked}
            onActivateEditing={() => handleActivateEditing(readOnly)}
          />
        )}
      </div>

      {/* Action Bar - Only visible on hover */}
      {!readOnly && (
        <div className="mt-4 flex items-end justify-between border-t border-black/6 pt-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="rounded-full bg-black/5 px-2 py-1 text-[10px] font-mono text-foreground/65">
            {format(item.createdAt, 'MM-dd HH:mm')}
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl bg-black/3 text-foreground/70 hover:bg-black/6 hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onPin(item.id, !item.pinned);
              }}
              title={item.pinned ? '取消置顶' : '置顶'}
            >
              <Pin
                className={`h-3.5 w-3.5 ${item.pinned ? 'fill-foreground text-foreground' : 'text-current'}`}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl bg-black/3 text-foreground/70 hover:bg-black/6 hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onLock(item.id, !item.locked);
              }}
              title={item.locked ? '解锁' : '锁定'}
            >
              {item.locked ? (
                <Unlock className="h-3.5 w-3.5 text-warning" />
              ) : (
                <Lock className="h-3.5 w-3.5 text-current" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl bg-black/3 text-foreground/70 hover:bg-destructive/10 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              title="删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
