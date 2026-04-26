import React from 'react';
import { BlackboardAddButton } from './BlackboardAddButton';
import { BlackboardDeleteDialog } from './BlackboardDeleteDialog';
import { BlackboardEmptyState } from './BlackboardEmptyState';
import { BlackboardGrid } from './BlackboardGrid';
import { useBlackboardView } from './useBlackboardView';

export function BlackboardView() {
  const {
    confirmDelete,
    deleteId,
    focusId,
    getItemColor,
    gridRef,
    handleAdd,
    handleLock,
    handlePin,
    handleResize,
    handleUpdate,
    items,
    setDeleteId,
    setFocusId,
    sortedItems,
  } = useBlackboardView();

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[20px] border border-border/45 bg-muted/30 ring-1 ring-border/20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDMiLz4KPC9zdmc+')]">
      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar sm:p-6">
        {items === undefined && (
          <div className="flex items-center justify-center h-32" data-testid="loading">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        {items !== undefined && sortedItems?.length === 0 && <BlackboardEmptyState />}

        <BlackboardGrid
          gridRef={gridRef}
          sortedItems={sortedItems || []}
          focusId={focusId}
          onUpdate={handleUpdate}
          onDelete={setDeleteId}
          onPin={handlePin}
          onLock={handleLock}
          onResize={handleResize}
          getItemColor={getItemColor}
          onFocusHandled={() => setFocusId(null)}
        />
      </div>

      <BlackboardAddButton onAdd={handleAdd} />

      <BlackboardDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
