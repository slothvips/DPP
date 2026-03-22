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
        className="text-xs font-normal h-7 px-2 max-w-[120px]"
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
          <div className="absolute left-0 top-full mt-1 w-72 bg-popover border rounded-md shadow-lg z-20 max-h-48 overflow-y-auto custom-scrollbar">
            <div className="p-1">
              {/* Session List */}
              {sessions.length === 0 ? (
                <div className="text-xs text-muted-foreground px-2 py-2">暂无会话</div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-sm text-xs cursor-pointer hover:bg-accent ${
                      session.id === currentSessionId ? 'bg-accent' : ''
                    } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
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
