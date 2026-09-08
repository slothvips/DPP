import { useLiveQuery } from 'dexie-react-hooks';
import { Copy, Pencil, Pin, Share2, Trash2 } from 'lucide-react';
import { type ReactNode, useDeferredValue, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AIChatStatus } from '@/features/aiAssistant/hooks/useAIChat.types';
import type { AISession } from '@/features/aiAssistant/types';
import { searchSessionMessages } from '@/lib/db/ai';
import { groupSessionsByUpdatedAt } from './aiSessionTimeline';

interface AISessionListProps {
  sessions: AISession[];
  currentSessionId: string | null;
  sessionStatuses: Record<string, AIChatStatus>;
  sessionIdsWithMessages: readonly string[];
  onSelectSession: (id: string) => Promise<void>;
  onDeleteSession: (id: string) => Promise<void>;
  onDuplicateSession: (id: string) => Promise<void>;
  onUpdateSessionTitle: (id: string, title: string) => Promise<void>;
  onSetSessionPinned: (id: string, pinned: boolean) => Promise<void>;
  onShareSession: (session: AISession) => Promise<void>;
  searchQuery: string;
  searchOnly?: boolean;
  disabled?: boolean;
}

const TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const DETAIL_TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

interface HoveredSession {
  id: string;
  top: number;
  left: number;
}

function getHoverPosition(element: HTMLElement, id: string): HoveredSession {
  const rect = element.getBoundingClientRect();
  return {
    id,
    top: Math.min(Math.max(8, rect.top), Math.max(8, window.innerHeight - 240)),
    left: rect.right + 8,
  };
}

export function AISessionList({
  sessions,
  currentSessionId,
  sessionStatuses,
  sessionIdsWithMessages,
  onSelectSession,
  onDeleteSession,
  onDuplicateSession,
  onUpdateSessionTitle,
  onSetSessionPinned,
  onShareSession,
  searchQuery,
  searchOnly = false,
  disabled = false,
}: AISessionListProps) {
  const sessionsWithMessages = new Set(sessionIdsWithMessages);
  const [hoveredSession, setHoveredSession] = useState<HoveredSession | null>(null);
  const [editingSession, setEditingSession] = useState<{ id: string; title: string } | null>(null);
  const titleEditActionRef = useRef<string | null>(null);
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const deferredSearchQuery = useDeferredValue(normalizedSearchQuery);
  const messageSearchMatches: Record<string, string[]> = useLiveQuery(
    () => searchSessionMessages(deferredSearchQuery),
    [deferredSearchQuery],
    {}
  );
  const currentMessageSearchMatches =
    deferredSearchQuery === normalizedSearchQuery ? messageSearchMatches : {};
  const filteredSessions =
    searchOnly && !normalizedSearchQuery
      ? []
      : normalizedSearchQuery
        ? sessions.filter((session) => {
            const roleTitle = session.role?.title ?? 'AI 助手';
            return (
              `${session.title} ${roleTitle}`.toLocaleLowerCase().includes(normalizedSearchQuery) ||
              Boolean(currentMessageSearchMatches[session.id]?.length)
            );
          })
        : sessions;
  const groups = groupSessionsByUpdatedAt(filteredSessions);

  return (
    <nav
      aria-label="AI 会话历史"
      className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-3"
    >
      {groups.length === 0 ? (
        searchOnly && !normalizedSearchQuery ? null : (
          <div className="px-2 py-4 text-xs text-muted-foreground">
            {normalizedSearchQuery ? '未找到会话' : '暂无会话'}
          </div>
        )
      ) : (
        groups.map((group) => (
          <section key={group.label} className="mt-2 first:mt-1">
            <h3 className="px-2 py-1 text-[10px] font-medium text-muted-foreground/80">
              {group.label}
            </h3>
            <div className="grid gap-0.5">
              {group.sessions.map((session) => {
                const status = sessionStatuses[session.id] ?? 'idle';
                const isCurrent = session.id === currentSessionId;
                const canShare = sessionsWithMessages.has(session.id);
                const canRename = canShare && status === 'idle';
                const isPinned = session.pinnedAt !== undefined;
                const isHovered = hoveredSession?.id === session.id;
                const isEditing = editingSession?.id === session.id;

                async function saveTitle() {
                  if (!isEditing || titleEditActionRef.current === session.id) return;
                  titleEditActionRef.current = session.id;
                  setEditingSession(null);
                  await onUpdateSessionTitle(session.id, editingSession.title);
                }

                return (
                  <div
                    key={session.id}
                    onMouseEnter={(event) =>
                      setHoveredSession(getHoverPosition(event.currentTarget, session.id))
                    }
                    onMouseLeave={() => setHoveredSession(null)}
                    onFocus={(event) =>
                      setHoveredSession(getHoverPosition(event.currentTarget, session.id))
                    }
                    className={`relative flex min-w-0 flex-col rounded-lg border-b border-l-2 border-border/60 pb-1 transition-colors last:border-b-0 ${
                      isCurrent
                        ? 'border-primary bg-accent/75'
                        : 'border-transparent hover:bg-accent/45'
                    } ${
                      isHovered ? 'z-20 border-primary bg-accent ring-1 ring-primary/30' : ''
                    } ${disabled ? 'pointer-events-none opacity-50' : ''} border-b-border/60`}
                  >
                    {isEditing ? (
                      <Input
                        autoFocus
                        value={editingSession.title}
                        onChange={(event) =>
                          setEditingSession({ id: session.id, title: event.target.value })
                        }
                        onBlur={() => void saveTitle()}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            titleEditActionRef.current = session.id;
                            setEditingSession(null);
                          } else if (event.key === 'Enter') {
                            event.preventDefault();
                            void saveTitle();
                          }
                        }}
                        aria-label={`修改会话标题：${session.title}`}
                        className="mx-1 h-8 w-[calc(100%-0.5rem)] rounded-md px-2 text-xs"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => void onSelectSession(session.id)}
                        disabled={disabled}
                        aria-current={isCurrent ? 'page' : undefined}
                        aria-describedby={`session-details-${session.id}`}
                        title={session.title}
                        className="w-full min-w-0 px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        <span className="block truncate text-xs font-medium text-foreground">
                          <HighlightedText text={session.title} query={normalizedSearchQuery} />
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span>{TIME_FORMATTER.format(session.updatedAt)}</span>
                          {status !== 'idle' && (
                            <span
                              className={`flex min-w-0 items-center gap-1 ${getStatusColor(status)}`}
                              title={`会话状态：${getStatusText(status)}`}
                            >
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                              <span className="truncate">{getStatusText(status)}</span>
                            </span>
                          )}
                        </span>
                        {normalizedSearchQuery && (
                          <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                            <HighlightedText
                              text={session.role?.title ?? 'AI 助手'}
                              query={normalizedSearchQuery}
                            />
                          </span>
                        )}
                        {normalizedSearchQuery && currentMessageSearchMatches[session.id] && (
                          <span className="mt-1 block max-h-24 min-w-0 overflow-y-auto text-[10px] text-muted-foreground">
                            {currentMessageSearchMatches[session.id].map((snippet, index) => (
                              <span key={`${session.id}-match-${index}`} className="block truncate">
                                <HighlightedText text={snippet} query={normalizedSearchQuery} />
                              </span>
                            ))}
                          </span>
                        )}
                      </button>
                    )}
                    <div className="flex w-full shrink-0 items-center justify-end px-1 pb-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void onSetSessionPinned(session.id, !isPinned)}
                        disabled={disabled}
                        title={isPinned ? '取消置顶' : '置顶会话'}
                        aria-label={`${isPinned ? '取消置顶' : '置顶会话'}：${session.title}`}
                        className={`h-7 w-7 rounded-md hover:!translate-y-0 active:!translate-y-0 ${
                          isPinned
                            ? 'text-primary hover:text-primary'
                            : 'text-muted-foreground hover:text-primary'
                        }`}
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          titleEditActionRef.current = null;
                          setEditingSession({ id: session.id, title: session.title });
                        }}
                        disabled={disabled || !canRename}
                        title={canRename ? '修改会话标题' : '发送消息后可修改会话标题'}
                        aria-label={`修改会话标题：${session.title}`}
                        className="h-7 w-7 rounded-md text-muted-foreground hover:!translate-y-0 active:!translate-y-0 hover:text-primary"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {canShare && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-md text-muted-foreground hover:!translate-y-0 active:!translate-y-0 hover:text-primary"
                          onClick={() => void onDuplicateSession(session.id)}
                          disabled={disabled || status !== 'idle'}
                          title={status === 'idle' ? '复制会话' : '会话完成后可复制'}
                          aria-label={`复制会话：${session.title}`}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canShare && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-md text-muted-foreground hover:!translate-y-0 active:!translate-y-0 hover:text-primary"
                          onClick={() => void onShareSession(session)}
                          disabled={disabled || status !== 'idle'}
                          title={status === 'idle' ? '永久分享会话' : '会话完成后可分享'}
                          aria-label={`分享会话：${session.title}`}
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-md text-destructive/75 hover:!translate-y-0 active:!translate-y-0 hover:!bg-destructive/10 hover:!text-destructive dark:hover:!bg-destructive/20"
                        onClick={() => void onDeleteSession(session.id)}
                        disabled={disabled}
                        title="删除会话"
                        aria-label={`删除会话：${session.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {isHovered && (
                      <div
                        id={`session-details-${session.id}`}
                        role="tooltip"
                        style={{
                          top: hoveredSession.top,
                          left: hoveredSession.left,
                          width: '18rem',
                          maxWidth: `calc(100vw - ${hoveredSession.left + 8}px)`,
                        }}
                        className="pointer-events-none fixed z-50 max-h-[calc(100vh-1rem)] min-w-0 overflow-y-auto rounded-md border border-border bg-popover p-3 text-xs text-popover-foreground shadow-md before:absolute before:left-[-5px] before:top-4 before:h-2.5 before:w-2.5 before:rotate-45 before:border-l before:border-b before:border-border before:bg-popover"
                      >
                        <p className="break-words text-sm font-semibold leading-5">
                          {session.title}
                        </p>
                        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[11px]">
                          <dt className="text-muted-foreground">角色</dt>
                          <dd className="min-w-0 break-words text-right">
                            {session.role?.title ?? 'AI 助手'}
                          </dd>
                          <dt className="text-muted-foreground">状态</dt>
                          <dd className="min-w-0 break-words text-right">
                            {getStatusText(status)}
                          </dd>
                          <dt className="text-muted-foreground">消息</dt>
                          <dd className="min-w-0 break-words text-right">
                            {canShare ? '包含消息' : '暂无消息'}
                          </dd>
                          <dt className="text-muted-foreground">更新时间</dt>
                          <dd className="min-w-0 break-words text-right">
                            {DETAIL_TIME_FORMATTER.format(session.updatedAt)}
                          </dd>
                          <dt className="text-muted-foreground">创建时间</dt>
                          <dd className="min-w-0 break-words text-right">
                            {DETAIL_TIME_FORMATTER.format(session.createdAt)}
                          </dd>
                        </dl>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </nav>
  );
}

function getStatusText(status: AIChatStatus): string {
  if (status === 'loading') return '等待';
  if (status === 'streaming') return '输出';
  if (status === 'confirming') return '待确认';
  if (status === 'error') return '错误';
  return '空闲';
}

function getStatusColor(status: AIChatStatus): string {
  if (status === 'error') return 'text-destructive';
  if (status === 'confirming') return 'text-warning';
  return 'text-info';
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return text;

  const lowerText = text.toLocaleLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const matchIndex = lowerText.indexOf(query, cursor);
    if (matchIndex === -1) {
      parts.push(<span key={`text-${cursor}`}>{text.slice(cursor)}</span>);
      break;
    }
    if (matchIndex > cursor) {
      parts.push(<span key={`text-${cursor}`}>{text.slice(cursor, matchIndex)}</span>);
    }
    parts.push(
      <mark key={`match-${matchIndex}`} className="rounded-sm bg-warning/40 px-0.5 text-inherit">
        {text.slice(matchIndex, matchIndex + query.length)}
      </mark>
    );
    cursor = matchIndex + query.length;
  }

  return <>{parts}</>;
}
