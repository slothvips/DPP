import { useLiveQuery } from 'dexie-react-hooks';
import 'virtual:uno.css';
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { db } from '@/db';
import { BlackboardDeleteDialog } from '@/features/blackboard/components/BlackboardDeleteDialog';
import { BlackboardItemView } from '@/features/blackboard/components/BlackboardItem';
import { SYSTEM_NOTES } from '@/features/blackboard/components/tips';
import type { BlackboardItem } from '@/features/blackboard/types';
import { useTheme } from '@/hooks/useTheme';
import { deleteBlackboard, updateBlackboard } from '@/lib/db';
import { logger } from '@/utils/logger';
import '@unocss/reset/tailwind.css';

function BlackboardNotePage() {
  useTheme();
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const noteId = new URLSearchParams(window.location.search).get('id');
  const systemNote = SYSTEM_NOTES.find((note) => note.id === noteId);
  const storedNote = useLiveQuery(
    async () => {
      if (!noteId || systemNote) {
        return undefined;
      }
      const note = await db.blackboard.get(noteId);
      return note?.deletedAt ? undefined : note;
    },
    [noteId, systemNote],
    null
  );
  const item = systemNote ?? storedNote ?? undefined;
  const loading = !systemNote && storedNote === null;

  async function handleUpdate(id: string, content: string) {
    try {
      await updateBlackboard({ id, content });
    } catch (error) {
      logger.error('Failed to update blackboard note', error);
      toast('保存便签失败', 'error');
    }
  }

  async function handlePin(id: string, pinned: boolean) {
    try {
      await updateBlackboard({ id, pinned });
    } catch (error) {
      logger.error('Failed to pin blackboard note', error);
      toast('更新置顶状态失败', 'error');
    }
  }

  async function handleLock(id: string, locked: boolean) {
    try {
      await updateBlackboard({ id, locked });
    } catch (error) {
      logger.error('Failed to lock blackboard note', error);
      toast('更新锁定状态失败', 'error');
    }
  }

  async function handleDelete() {
    if (!item || item.id.startsWith('system-')) {
      return;
    }
    try {
      await deleteBlackboard({ id: item.id });
      setDeleteOpen(false);
    } catch (error) {
      logger.error('Failed to delete blackboard note', error);
      toast('删除便签失败', 'error');
    }
  }

  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-8">
      <div className="mx-auto min-h-[calc(100vh-2rem)] max-w-5xl overflow-hidden rounded-[20px] border border-border/45 bg-muted/30 p-5 ring-1 ring-border/20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDMiLz4KPC9zdmc+')] sm:min-h-[calc(100vh-4rem)] sm:p-6">
        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center text-muted-foreground">
            加载中...
          </div>
        ) : item ? (
          <BlackboardItemView
            item={item as BlackboardItem}
            onUpdate={handleUpdate}
            onDelete={async () => setDeleteOpen(true)}
            onPin={handlePin}
            onLock={handleLock}
            color={item.id.startsWith('system-') ? 'bg-sticky-blue' : 'bg-sticky-yellow'}
            readOnly={item.id.startsWith('system-')}
            showOpenInBrowser={false}
            limitContentHeight={false}
          />
        ) : (
          <div className="flex min-h-[240px] items-center justify-center text-muted-foreground">
            便签不存在或已被删除
          </div>
        )}
      </div>
      <BlackboardDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
      />
    </main>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ToastProvider>
        <ErrorBoundary>
          <BlackboardNotePage />
        </ErrorBoundary>
      </ToastProvider>
    </React.StrictMode>
  );
}
