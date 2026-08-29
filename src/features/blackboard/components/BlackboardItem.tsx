import { format } from 'date-fns';
import { Copy, ExternalLink, Lock, Pin, Trash2, Unlock } from 'lucide-react';
import React from 'react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { logger } from '@/utils/logger';
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
  showOpenInBrowser?: boolean;
  limitContentHeight?: boolean;
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
  showOpenInBrowser = true,
  limitContentHeight = true,
  isFocused,
  onFocusHandled,
}: BlackboardItemProps) {
  const { toast } = useToast();
  const {
    content,
    contentRef,
    containerRef,
    hasExternalConflict,
    isEditing,
    minEditHeight,
    textareaRef,
    transforms,
    handleActivateEditing,
    handleAcceptExternal,
    handleBlur,
    handleChange,
    handleKeepDraft,
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

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      toast('已复制到剪贴板', 'success');
    } catch (error) {
      logger.error('Failed to copy blackboard item', error);
      toast('复制失败', 'error');
    }
  }

  async function handleOpenInBrowser() {
    try {
      await browser.tabs.create({
        url: browser.runtime.getURL(`/blackboard-note.html?id=${encodeURIComponent(item.id)}`),
      });
    } catch (error) {
      logger.error('Failed to open blackboard note in browser', error);
      toast('无法在浏览器中打开便签', 'error');
    }
  }

  async function handleEditorBlur() {
    try {
      await handleBlur();
    } catch (error) {
      logger.error('Failed to save blackboard draft:', error);
      toast('保存便签失败', 'error');
    }
  }

  async function handleKeepDraftClick() {
    try {
      await handleKeepDraft();
    } catch (error) {
      logger.error('Failed to keep blackboard draft:', error);
      toast('保存便签失败', 'error');
    }
  }

  return (
    <div
      ref={containerRef}
      className={`group relative flex min-h-[172px] flex-col overflow-hidden rounded-[18px] border border-border/45 p-4.5 shadow-sm transition-all duration-300 hover:z-10 hover:scale-[1.01] hover:shadow-lg ${color}`}
      style={{
        transform: `rotate(${transforms.rotation}deg) translate(${transforms.xOffset}px, ${transforms.yOffset}px)`,
      }}
    >
      {/* Pin Indicator */}
      {item.pinned && (
        <div className="absolute -top-3 -left-3 z-20 transform rotate-12 drop-shadow-md">
          <div className="bg-destructive w-3 h-3 rounded-full border border-destructive/70 shadow-sm"></div>
          <Pin className="w-5 h-5 text-foreground fill-foreground absolute -top-1 -left-1 opacity-80" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/45 pb-3">
        <div className="rounded-full bg-foreground/10 px-2 py-1 text-[10px] font-mono text-foreground/65">
          {format(item.createdAt, 'MM-dd HH:mm')}
        </div>
        <div className="flex gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-xl bg-foreground/5 text-foreground/70 hover:bg-foreground/10 hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              void handleCopy();
            }}
            title="复制"
            aria-label="复制便签内容"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          {showOpenInBrowser && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl bg-foreground/10 text-foreground/70 hover:bg-foreground/15 hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                void handleOpenInBrowser();
              }}
              title="在浏览器中打开这张便签"
              aria-label="在浏览器中打开这张便签"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
          {!readOnly && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl bg-foreground/5 text-foreground/70 hover:bg-foreground/10 hover:text-foreground"
                onClick={(event) => {
                  event.stopPropagation();
                  void onPin(item.id, !item.pinned);
                }}
                title={item.pinned ? '取消置顶' : '置顶'}
                aria-label={item.pinned ? '取消置顶' : '置顶'}
              >
                <Pin
                  className={`h-3.5 w-3.5 ${item.pinned ? 'fill-foreground text-foreground' : 'text-current'}`}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl bg-foreground/5 text-foreground/70 hover:bg-foreground/10 hover:text-foreground"
                onClick={(event) => {
                  event.stopPropagation();
                  void onLock(item.id, !item.locked);
                }}
                title={item.locked ? '解锁' : '锁定'}
                aria-label={item.locked ? '解锁' : '锁定'}
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
                className="h-8 w-8 rounded-xl bg-foreground/5 text-foreground/70 hover:bg-destructive/10 hover:text-destructive"
                onClick={(event) => {
                  event.stopPropagation();
                  void onDelete(item.id);
                }}
                title="删除"
                aria-label="删除便签"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div
        ref={contentRef}
        className={`relative min-h-[140px] min-w-0 w-full flex-1 pt-4 ${limitContentHeight ? 'max-h-[420px] overflow-y-auto overscroll-contain custom-scrollbar' : ''}`}
      >
        {isEditing ? (
          <div className="space-y-2">
            {hasExternalConflict && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-warning/50 bg-warning/10 p-2 text-xs">
                <span>内容已在其他位置更新</span>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="outline" onClick={handleAcceptExternal}>
                    使用新版本
                  </Button>
                  <Button type="button" size="sm" onClick={() => void handleKeepDraftClick()}>
                    保留我的内容
                  </Button>
                </div>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={content}
              wrap="soft"
              onChange={(event) => {
                handleChange(event.target.value);
              }}
              onBlur={() => void handleEditorBlur()}
              onKeyDown={handleKeyDown}
              placeholder="写点什么..."
              className="w-full resize-none overflow-hidden border-none bg-transparent p-0 text-base text-foreground shadow-none outline-none break-words [overflow-wrap:anywhere] placeholder:text-muted-foreground placeholder:italic focus:border-none focus:outline-none focus:ring-0"
              style={{
                ...commonStyle,
                minHeight: minEditHeight,
              }}
            />
          </div>
        ) : (
          <BlackboardMarkdownPreview
            content={content}
            commonStyle={commonStyle}
            readOnly={readOnly}
            locked={item.locked}
            onActivateEditing={(caretOffset) => handleActivateEditing(readOnly, caretOffset)}
          />
        )}
      </div>
    </div>
  );
}
