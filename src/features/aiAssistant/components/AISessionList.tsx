// AI Session List Component
import { Check, ChevronDown, History, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { AIChatStatus } from '../hooks/useAIChat.types';
import type { AISession } from '../types';

interface AISessionListProps {
  sessions: AISession[];
  currentSessionId: string | null;
  sessionStatuses: Record<string, AIChatStatus>;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  disabled?: boolean;
}

export function AISessionList({
  sessions,
  currentSessionId,
  sessionStatuses,
  onSelectSession,
  onDeleteSession,
  disabled = false,
}: AISessionListProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelectSession = (id: string) => {
    if (!disabled) {
      onSelectSession(id);
      setIsOpen(false);
    }
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      onDeleteSession(id);
    }
  };

  return (
    <div className="relative min-w-0">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        disabled={disabled}
        className="h-8 w-full min-w-0 max-w-[180px] justify-start rounded-lg border border-border/55 bg-muted/35 px-2.5 text-xs font-normal"
        title={currentSession?.title || '新会话'}
      >
        <History className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">历史</span>
        <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div className="absolute left-0 top-full z-50 mt-2 max-h-56 w-72 overflow-y-auto overscroll-contain rounded-xl border border-border/60 bg-popover/98 p-1.5 shadow-xl custom-scrollbar">
            <div className="p-1">
              {/* Session List */}
              {sessions.length === 0 ? (
                <div className="px-3 py-3 text-xs text-muted-foreground">暂无会话</div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs hover:bg-accent ${
                      session.id === currentSessionId ? 'bg-accent/72' : ''
                    } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
                    onClick={() => handleSelectSession(session.id)}
                  >
                    <div className="flex items-center min-w-0 flex-1">
                      {session.id === currentSessionId && (
                        <Check className="w-3 h-3 mr-1.5 flex-shrink-0" />
                      )}
                      <span className="truncate">{session.title}</span>
                    </div>
                    {sessionStatuses[session.id] !== 'idle' && (
                      <span
                        className={`mr-1.5 flex shrink-0 items-center gap-1 text-[10px] ${
                          sessionStatuses[session.id] === 'error'
                            ? 'text-destructive'
                            : sessionStatuses[session.id] === 'confirming'
                              ? 'text-warning'
                              : 'text-info'
                        }`}
                        title={`会话状态：${getStatusText(sessionStatuses[session.id])}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {getStatusText(sessionStatuses[session.id])}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      disabled={disabled}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function getStatusText(status: AIChatStatus): string {
  if (status === 'loading') return '等待';
  if (status === 'streaming') return '输出';
  if (status === 'confirming') return '待确认';
  if (status === 'error') return '错误';
  return '空闲';
}
