import {
  Bot,
  Brain,
  Check,
  ChevronRight,
  Copy,
  Pencil,
  Save,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';
import remarkGfm from 'remark-gfm';
import { memo, useEffect, useRef, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { logger } from '@/utils/logger';
import type { ChatMessage } from '../types';

interface MessageItemProps {
  message: ChatMessage;
  canEdit: boolean;
  onEditMessage: (messageId: string, content: string) => Promise<void>;
}

const MARKDOWN_COMPONENTS: Components = {
  a: function MarkdownLink({ node: _node, ...props }) {
    return (
      <a
        {...props}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
      />
    );
  },
};

function getReasoningContent(message: ChatMessage): string {
  const directReasoning = message.providerMetadata?.openAIReasoningContent;
  if (directReasoning) {
    return directReasoning;
  }

  return (message.providerMetadata?.anthropicContentBlocks || [])
    .filter(
      (block): block is { type: 'thinking'; thinking: string } =>
        typeof block === 'object' &&
        block !== null &&
        'type' in block &&
        block.type === 'thinking' &&
        'thinking' in block &&
        typeof block.thinking === 'string'
    )
    .map((block) => block.thinking)
    .join('\n');
}

/**
 * Message item component with memoization to prevent unnecessary re-renders.
 * Uses React.memo with custom comparison for optimal performance.
 */
export const MessageItem = memo(
  function MessageItem({ message, canEdit, onEditMessage }: MessageItemProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(message.content);
    const [isSaving, setIsSaving] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const copyTimeoutRef = useRef<number | null>(null);
    const isUser = message.role === 'user';
    const isToolResult = message.role === 'tool';
    const contentClassName =
      'prose prose-sm max-w-none break-words dark:prose-invert [&_code]:break-all [&_pre]:max-w-full [&_pre]:overflow-x-auto';
    const roleLabel = isUser ? '你' : isToolResult ? message.name || '工具' : 'D仔';
    const RoleIcon = isUser ? UserRound : isToolResult ? Wrench : Bot;
    const reasoning = message.role === 'assistant' ? getReasoningContent(message) : '';

    useEffect(() => {
      return () => {
        if (copyTimeoutRef.current !== null) window.clearTimeout(copyTimeoutRef.current);
      };
    }, []);

    async function handleCopy() {
      try {
        await navigator.clipboard.writeText(message.content);
        setIsCopied(true);
        if (copyTimeoutRef.current !== null) window.clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = window.setTimeout(() => setIsCopied(false), 1500);
      } catch (error) {
        logger.warn('[AIChat] Failed to copy message:', error);
      }
    }

    async function handleEditSave() {
      if (!draft.trim() || isSaving) return;
      setIsSaving(true);
      try {
        await onEditMessage(message.id, draft);
        setIsEditing(false);
      } finally {
        setIsSaving(false);
      }
    }

    return (
      <article
        className={`flex gap-2.5 px-1 py-1 transition-colors sm:px-2 ${isUser ? 'justify-end' : ''}`}
      >
        <div
          className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border sm:h-8 sm:w-8 ${
            isUser
              ? 'border-primary/35 bg-primary/12 text-primary'
              : isToolResult
                ? 'border-border bg-muted text-muted-foreground'
                : 'border-info/35 bg-info/10 text-info'
          }`}
        >
          <RoleIcon className="h-4 w-4" />
        </div>

        <div
          className={`min-w-0 max-w-[88%] rounded-2xl px-3.5 py-3 ${
            isUser
              ? 'order-first border border-primary/20 bg-primary/10'
              : isToolResult
                ? 'border border-border/55 bg-muted/35'
                : 'border border-border/55 bg-background'
          }`}
        >
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-foreground">
            <span>{roleLabel}</span>
            {isToolResult && (
              <span className="border-l border-border pl-2 font-normal text-muted-foreground">
                执行结果
              </span>
            )}
            <span className="ml-auto flex items-center gap-0.5">
              {isUser && canEdit && !isEditing && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-md text-muted-foreground"
                  onClick={() => {
                    setDraft(message.content);
                    setIsEditing(true);
                  }}
                  title="编辑消息"
                  aria-label="编辑消息"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-md text-muted-foreground"
                onClick={() => void handleCopy()}
                title={isCopied ? '已复制' : '复制消息'}
                aria-label={isCopied ? '已复制' : '复制消息'}
              >
                {isCopied ? (
                  <Check className="h-3 w-3 text-success" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </span>
          </div>

          {reasoning && (
            <details className="group mb-3 rounded-lg border border-info/20 bg-info/5 text-xs text-muted-foreground">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-1 py-2.5 font-medium text-info outline-none transition-colors hover:bg-info/8 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <Brain className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">思考过程</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90" />
              </summary>
              <p className="border-t border-info/20 px-1 py-3 whitespace-pre-wrap leading-6 text-foreground/80">
                {reasoning}
              </p>
            </details>
          )}

          {isEditing ? (
            <div className="grid gap-2">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="min-h-[88px] resize-y rounded-xl bg-background text-sm"
                autoFocus
                disabled={isSaving}
                aria-label="编辑用户消息"
              />
              <div className="flex justify-end gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-lg px-2 text-xs"
                  onClick={() => {
                    setDraft(message.content);
                    setIsEditing(false);
                  }}
                  disabled={isSaving}
                >
                  <X className="mr-1 h-3 w-3" />
                  取消
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 rounded-lg px-2 text-xs"
                  onClick={() => void handleEditSave()}
                  disabled={isSaving || !draft.trim()}
                >
                  <Save className="mr-1 h-3 w-3" />
                  {isSaving ? '继续中...' : '确认并继续'}
                </Button>
              </div>
            </div>
          ) : isToolResult ? (
            <details className="group rounded-lg border border-border/55 bg-background/45">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
                <span className="min-w-0 flex-1 truncate">查看详细结果</span>
                <span className="text-muted-foreground group-open:hidden">展开</span>
                <span className="hidden text-muted-foreground group-open:inline">收起</span>
              </summary>
              <div className="border-t border-border/55 px-3 py-3">
                <div className={contentClassName}>
                  <ReactMarkdown components={MARKDOWN_COMPONENTS} remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
              </div>
            </details>
          ) : (
            <div className={contentClassName}>
              <ReactMarkdown components={MARKDOWN_COMPONENTS} remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </article>
    );
  },
  // Custom comparison: only re-render when message content actually changes
  (prevProps, nextProps) => {
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.content === nextProps.message.content &&
      prevProps.message.role === nextProps.message.role &&
      prevProps.message.name === nextProps.message.name &&
      prevProps.canEdit === nextProps.canEdit &&
      prevProps.onEditMessage === nextProps.onEditMessage &&
      getReasoningContent(prevProps.message) === getReasoningContent(nextProps.message)
    );
  }
);
