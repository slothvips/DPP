import { useLiveQuery } from 'dexie-react-hooks';
import Masonry from 'masonry-layout';
import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '@/db';
import { addBlackboard, deleteBlackboard, updateBlackboard } from '@/lib/db';
import { SYSTEM_NOTES } from './tips';

const STICKY_COLORS = [
  'bg-sticky-yellow',
  'bg-sticky-blue',
  'bg-sticky-green',
  'bg-sticky-pink',
  'bg-sticky-purple',
  'bg-sticky-orange',
];

export function useBlackboardView() {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const masonryRef = useRef<Masonry | null>(null);

  const items = useLiveQuery(async () => {
    const result = await db.blackboard.filter((item) => !item.deletedAt).sortBy('createdAt');
    return result.reverse();
  });

  const sortedItems = useMemo(
    () =>
      [...SYSTEM_NOTES, ...(items || [])].sort((a, b) => {
        if (a.pinned !== b.pinned) {
          return a.pinned ? -1 : 1;
        }
        return b.createdAt - a.createdAt;
      }),
    [items]
  );

  useEffect(() => {
    if (gridRef.current && !masonryRef.current) {
      masonryRef.current = new Masonry(gridRef.current, {
        itemSelector: '.grid-item',
        columnWidth: '.grid-sizer',
        percentPosition: true,
        gutter: 24,
        transitionDuration: '0.2s',
      });
    }

    return () => {
      masonryRef.current?.destroy?.();
      masonryRef.current = null;
    };
  }, []);

  useEffect(() => {
    masonryRef.current?.reloadItems?.();
    masonryRef.current?.layout?.();
  }, [sortedItems]);

  const handleAdd = async () => {
    const result = await addBlackboard({
      content: '',
      pinned: false,
    });
    setFocusId(result.id);
  };

  const handleUpdate = async (id: string, content: string) => {
    await updateBlackboard({ id, content });
  };

  const confirmDelete = async () => {
    if (!deleteId) {
      return;
    }

    await deleteBlackboard({ id: deleteId });
    setDeleteId(null);
  };

  const handlePin = async (id: string, pinned: boolean) => {
    await updateBlackboard({ id, pinned });
  };

  const handleLock = async (id: string, locked: boolean) => {
    await updateBlackboard({ id, locked });
  };

  const handleResize = () => {
    masonryRef.current?.layout?.();
  };

  const getItemColor = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % STICKY_COLORS.length;
    return STICKY_COLORS[index];
  };

  return {
    confirmDelete,
    deleteId,
    gridRef,
    handleAdd,
    handleLock,
    handlePin,
    handleResize,
    handleUpdate,
    items,
    setDeleteId,
    setFocusId,
    focusId,
    sortedItems,
    getItemColor,
  };
}
