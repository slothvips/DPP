// AI Session List Component
import { Check, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { AISession } from '../types';

interface AISessionListProps {
  sessions: AISession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  disabled?: boolean;
}

export function AISessionList({
  sessions,
  currentSessionId,
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
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        disabled={disabled}
        className="h-8 max-w-[140px] rounded-xl border border-border/60 bg-background/78 px-3 text-xs font-normal"
        title={currentSession?.title || '新会话'}
      >
        <span className="truncate">{currentSession?.title || '新会话'}</span>
        <span className="ml-1 text-muted-foreground shrink-0">▼</span>
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div className="absolute left-0 top-full z-20 mt-1 max-h-56 w-72 overflow-y-auto rounded-2xl border border-border/60 bg-popover/98 p-1 shadow-md custom-scrollbar">
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
