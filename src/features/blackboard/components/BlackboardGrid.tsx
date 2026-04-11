import type { BlackboardItem } from '@/features/blackboard/types';
import { BlackboardItemView } from './BlackboardItem';

interface BlackboardGridProps {
  gridRef: React.RefObject<HTMLDivElement | null>;
  sortedItems: BlackboardItem[];
  focusId: string | null;
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
  onUpdate,
  onDelete,
  onPin,
  onLock,
  onResize,
  getItemColor,
  onFocusHandled,
}: BlackboardGridProps) {
  return (
    <div ref={gridRef} className="max-w-5xl mx-auto pb-24">
      <div className="grid-sizer w-full md:w-[calc(50%-12px)]" />

      {sortedItems.map((item) => (
        <div key={item.id} className="grid-item w-full md:w-[calc(50%-12px)] mb-6">
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
