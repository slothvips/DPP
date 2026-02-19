import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import Masonry from 'masonry-layout';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { db } from '@/db';
import { addBlackboard, deleteBlackboard, updateBlackboard } from '@/lib/db';
import { BlackboardItemView } from './BlackboardItem';
import { SYSTEM_NOTES } from './tips';

const STICKY_COLORS = [
  'bg-yellow-100',
  'bg-blue-100',
  'bg-green-100',
  'bg-pink-100',
  'bg-purple-100',
  'bg-orange-100',
];

export function BlackboardView() {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const masonryRef = useRef<Masonry | null>(null);

  const items = useLiveQuery(async () => {
    return await db.blackboard.orderBy('createdAt').reverse().toArray();
  });

  const handleAdd = async () => {
    const result = await addBlackboard({
      content: '',
      pinned: false,
    });
    setFocusId(result.id);
  };

  const handleUpdate = async (id: string, content: string) => {
    await updateBlackboard({
      id,
      content,
    });
  };

  const confirmDelete = async () => {
    if (deleteId) {
      await deleteBlackboard({ id: deleteId });
      setDeleteId(null);
    }
  };

  const handlePin = async (id: string, pinned: boolean) => {
    await updateBlackboard({
      id,
      pinned,
    });
  };

  // Sort: pinned first, then by createdAt desc
  const sortedItems = [...SYSTEM_NOTES, ...(items || [])].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt - a.createdAt;
  });

  // Initialize Masonry
  useEffect(() => {
    if (gridRef.current && !masonryRef.current) {
      masonryRef.current = new Masonry(gridRef.current, {
        itemSelector: '.grid-item',
        columnWidth: '.grid-sizer',
        percentPosition: true,
        gutter: 24, // 1.5rem / gap-6
        transitionDuration: '0.2s', // Smooth re-layout
      });
    }

    // Cleanup
    return () => {
      masonryRef.current?.destroy?.();
      masonryRef.current = null;
    };
  }, []);

  // Update layout when items change
  useEffect(() => {
    if (masonryRef.current) {
      masonryRef.current?.reloadItems?.();
      masonryRef.current?.layout?.();
    }
  }, [sortedItems]);

  const handleResize = () => {
    masonryRef.current?.layout?.();
  };

  // Assign consistent colors based on ID hash
  const getItemColor = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % STICKY_COLORS.length;
    return STICKY_COLORS[index];
  };

  return (
    <div className="flex flex-col h-full bg-stone-100 dark:bg-stone-900 relative bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')]">
      <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
        {/* Loading State */}
        {items === undefined && (
          <div className="flex items-center justify-center h-32" data-testid="loading">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        {/* Empty State */}
        {items !== undefined && sortedItems?.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
            <div className="border-2 border-dashed border-current rounded-lg p-8 mb-4">
              <Plus className="w-12 h-12" />
            </div>
            <p className="text-lg font-medium">黑板上空空如也</p>
            <p className="text-sm">点击右下角添加第一张便签</p>
          </div>
        )}

        {/* Masonry Layout Container */}
        <div ref={gridRef} className="max-w-5xl mx-auto pb-24">
          {/* Grid sizer for column width calculation */}
          <div className="grid-sizer w-full md:w-[calc(50%-12px)]" />

          {sortedItems?.map((item) => (
            <div key={item.id} className="grid-item w-full md:w-[calc(50%-12px)] mb-6">
              <BlackboardItemView
                item={item}
                onUpdate={handleUpdate}
                onDelete={async (id) => setDeleteId(id)}
                onPin={handlePin}
                onResize={handleResize}
                color={getItemColor(item.id)}
                readOnly={item.id.startsWith('system-')}
                isFocused={item.id === focusId}
                onFocusHandled={() => setFocusId(null)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="absolute bottom-6 right-6">
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-transform hover:scale-105 active:scale-95 bg-primary text-primary-foreground"
          onClick={handleAdd}
          title="添加新便签"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除便签</DialogTitle>
            <DialogDescription>确定要撕掉这张便签吗？此操作无法撤销。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
