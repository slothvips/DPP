import { type ReactNode, useCallback, useMemo, useRef } from 'react';
import { cn } from '@/utils/cn';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  estimateSize?: number;
  overscan?: number;
  containerClassName?: string;
  itemClassName?: string;
}

export function VirtualList<T>({
  items,
  renderItem,
  estimateSize = 50,
  overscan = 5,
  containerClassName,
  itemClassName,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const getScrollElement = useCallback(() => parentRef.current, []);

  const virtualizer = useVirtualizer(
    useMemo(
      () => ({
        count: items.length,
        getScrollElement,
        estimateSize: () => estimateSize,
        overscan,
      }),
      [items.length, getScrollElement, estimateSize, overscan]
    )
  );

  return (
    <div ref={parentRef} className={cn('overflow-auto', containerClassName)}>
      <div
        className="relative w-full"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            className={cn('absolute left-0 top-0 w-full', itemClassName)}
            style={{
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderItem(items[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
