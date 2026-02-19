// AI Session List Component
import { Check, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { AISession } from '../types';

interface AISessionListProps {
  sessions: AISession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
}

export function AISessionList({
  sessions,
  currentSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
}: AISessionListProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs font-normal h-7 px-2"
        title="会话列表"
      >
        {currentSession?.title || '新会话'}
        <span className="ml-1 text-muted-foreground">▼</span>
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div className="absolute left-0 top-full mt-1 w-72 bg-popover border rounded-md shadow-lg z-20 max-h-48 overflow-y-auto custom-scrollbar">
            <div className="p-1">
              {/* New Session Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onCreateSession();
                  setIsOpen(false);
                }}
                className="w-full justify-start text-xs h-8"
              >
                <Plus className="w-3 h-3 mr-2" />
                新建会话
              </Button>

              {/* Divider */}
              <div className="my-1 border-t" />

              {/* Session List */}
              {sessions.length === 0 ? (
                <div className="text-xs text-muted-foreground px-2 py-2">暂无会话</div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-sm text-xs cursor-pointer hover:bg-accent ${
                      session.id === currentSessionId ? 'bg-accent' : ''
                    }`}
                    onClick={() => {
                      onSelectSession(session.id);
                      setIsOpen(false);
                    }}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
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
