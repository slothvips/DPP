import type { BlackboardItem } from '@/features/blackboard/types';
import { BlackboardAddButton } from './BlackboardAddButton';
import { BlackboardItemView } from './BlackboardItem';

interface BlackboardGridProps {
  gridRef: React.RefObject<HTMLDivElement | null>;
  sortedItems: BlackboardItem[];
  focusId: string | null;
  onAdd: () => void | Promise<void>;
  onUpdate: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => Promise<void>;
  onLock: (id: string, locked: boolean) => Promise<void>;
  onResize: () => void;
  getItemColor: (id: string) => string;
  onFocusHandled: () => void;
}

export function BlackboardGrid({
  gridRef,
  sortedItems,
  focusId,
  onAdd,
  onUpdate,
  onDelete,
  onPin,
  onLock,
  onResize,
  getItemColor,
  onFocusHandled,
}: BlackboardGridProps) {
  return (
    <div ref={gridRef} className="mx-auto max-w-4xl pb-6">
      <div className="grid-sizer w-full [@media(min-width:520px)]:w-[calc(50%-12px)]" />

      <div className="grid-item mb-6 w-full [@media(min-width:520px)]:w-[calc(50%-12px)]">
        <BlackboardAddButton onAdd={onAdd} />
      </div>

      {sortedItems.map((item) => (
        <div
          key={item.id}
          className="grid-item mb-6 w-full [@media(min-width:520px)]:w-[calc(50%-12px)]"
        >
          <BlackboardItemView
            item={item}
            onUpdate={onUpdate}
            onDelete={async (id) => onDelete(id)}
            onPin={onPin}
            onLock={onLock}
            onResize={onResize}
            color={getItemColor(item.id)}
            readOnly={item.id.startsWith('system-')}
            isFocused={item.id === focusId}
            onFocusHandled={onFocusHandled}
          />
        </div>
      ))}
    </div>
  );
}
