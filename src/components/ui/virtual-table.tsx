import { type ReactNode, useCallback, useMemo, useRef } from 'react';
import { cn } from '@/utils/cn';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface VirtualTableProps<T> {
  items: T[];
  renderRow: (item: T, index: number) => ReactNode;
  estimateSize?: number;
  overscan?: number;
  containerClassName?: string;
  rowClassName?: string;
}

export function VirtualTable<T>({
  items,
  renderRow,
  estimateSize = 50,
  overscan = 5,
  containerClassName,
  rowClassName,
}: VirtualTableProps<T>) {
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
            className={cn('absolute left-0 top-0 w-full', rowClassName)}
            style={{
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderRow(items[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
