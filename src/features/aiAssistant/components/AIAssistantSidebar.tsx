import { Library, Plus, Search } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { AIChatStatus } from '@/features/aiAssistant/hooks/useAIChat.types';
import type { AISession } from '@/features/aiAssistant/types';
import { AISessionList } from './AISessionList';

export type AIAssistantViewMode = 'chat' | 'materials';

interface AIAssistantSidebarProps {
  sessions: AISession[];
  currentSessionId: string | null;
  sessionStatuses: Record<string, AIChatStatus>;
  sessionIdsWithMessages: readonly string[];
  viewMode: AIAssistantViewMode;
  onViewModeChange: (mode: AIAssistantViewMode) => void;
  onSelectSession: (id: string) => Promise<void>;
  onDeleteSession: (id: string) => Promise<void>;
  onDuplicateSession: (id: string) => Promise<void>;
  onUpdateSessionTitle: (id: string, title: string) => Promise<void>;
  onSetSessionPinned: (id: string, pinned: boolean) => Promise<void>;
  onCreateSession: () => Promise<void>;
  onShareSession: (session: AISession) => Promise<void>;
  footer?: ReactNode;
}

export function AIAssistantSidebar({
  sessions,
  currentSessionId,
  sessionStatuses,
  sessionIdsWithMessages,
  viewMode,
  onViewModeChange,
  onSelectSession,
  onDeleteSession,
  onDuplicateSession,
  onUpdateSessionTitle,
  onSetSessionPinned,
  onCreateSession,
  onShareSession,
  footer,
}: AIAssistantSidebarProps) {
  const [sessionSearchOpen, setSessionSearchOpen] = useState(false);
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');

  function handleSearchOpenChange(open: boolean) {
    setSessionSearchOpen(open);
    if (!open) setSessionSearchQuery('');
  }

  async function selectSession(id: string) {
    await onSelectSession(id);
    setSessionSearchQuery('');
    setSessionSearchOpen(false);
  }

  return (
    <aside className="flex h-full min-h-0 flex-col bg-muted/15">
      <div className="grid shrink-0 gap-1 border-b border-border/60 p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewModeChange('materials')}
          aria-current={viewMode === 'materials' ? 'page' : undefined}
          className={`h-9 w-full justify-start rounded-lg px-2.5 ${
            viewMode === 'materials' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
          }`}
        >
          <Library className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">物料库</span>
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void onCreateSession()}
            className="h-9 w-full justify-start rounded-lg px-2.5 text-foreground"
          >
            <Plus className="mr-2 h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">新建会话</span>
          </Button>
        </div>
        <div className="relative flex shrink-0 items-center justify-between px-3 pb-1 pt-3 text-[11px] font-medium text-muted-foreground">
          <span>会话历史</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setSessionSearchOpen(true)}
            aria-label="搜索会话"
            title="搜索会话"
            className="h-7 w-7 rounded-md text-muted-foreground hover:!translate-y-0 hover:text-foreground active:!translate-y-0"
          >
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
        <AISessionList
          sessions={sessions}
          currentSessionId={currentSessionId}
          sessionStatuses={sessionStatuses}
          sessionIdsWithMessages={sessionIdsWithMessages}
          onSelectSession={onSelectSession}
          onDeleteSession={onDeleteSession}
          onDuplicateSession={onDuplicateSession}
          onUpdateSessionTitle={onUpdateSessionTitle}
          onSetSessionPinned={onSetSessionPinned}
          onShareSession={onShareSession}
          searchQuery=""
        />
      </div>
      {footer && (
        <div className="min-w-0 shrink-0 overflow-hidden border-t border-border/60 p-2">
          {footer}
        </div>
      )}
      <Dialog open={sessionSearchOpen} onOpenChange={handleSearchOpenChange}>
        <DialogContent className="flex h-[75vh] max-h-[40rem] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-3 p-4">
          <DialogHeader>
            <DialogTitle className="text-base">搜索会话</DialogTitle>
            <DialogDescription className="sr-only">
              按会话标题、角色或消息内容搜索
            </DialogDescription>
          </DialogHeader>
          <div className="relative shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={sessionSearchQuery}
              onChange={(event) => setSessionSearchQuery(event.target.value)}
              aria-label="搜索会话标题、角色或内容"
              placeholder="搜索标题、角色或内容"
              className="h-10 rounded-md pl-9 pr-3"
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-border/60 pt-1">
            <AISessionList
              sessions={sessions}
              currentSessionId={currentSessionId}
              sessionStatuses={sessionStatuses}
              sessionIdsWithMessages={sessionIdsWithMessages}
              onSelectSession={selectSession}
              onDeleteSession={onDeleteSession}
              onDuplicateSession={onDuplicateSession}
              onUpdateSessionTitle={onUpdateSessionTitle}
              onSetSessionPinned={onSetSessionPinned}
              onShareSession={onShareSession}
              searchQuery={sessionSearchQuery}
              searchOnly={true}
            />
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
