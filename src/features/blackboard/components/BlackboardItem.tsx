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
