import { type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/utils/cn';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface VirtualListHandle {
  scrollToIndex: (index: number) => void;
  scrollToBottom: () => void;
}

export interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  estimateSize?: number;
  overscan?: number;
  containerClassName?: string;
  itemClassName?: string;
  /** Measure rendered rows instead of assuming a fixed height. */
  dynamicSize?: boolean;
  handleRef?: { current: VirtualListHandle | null };
  /** Called when the scroll position enters or leaves the bottom. */
  onScroll?: (atBottom: boolean) => void;
}

export function VirtualList<T>({
  items,
  renderItem,
  estimateSize = 50,
  overscan = 5,
  containerClassName,
  itemClassName,
  dynamicSize = false,
  handleRef,
  onScroll,
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

  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = {
      scrollToIndex: (index) => virtualizer.scrollToIndex(index),
      scrollToBottom: () =>
        virtualizer.scrollToIndex(Math.max(0, items.length - 1), { align: 'end' }),
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef, items.length, virtualizer]);

  return (
    <div
      ref={parentRef}
      onScroll={
        onScroll
          ? (event) => {
              const el = event.currentTarget;
              onScroll(el.scrollTop + el.clientHeight >= el.scrollHeight - 24);
            }
          : undefined
      }
      className={cn('h-full min-h-0 overflow-auto', containerClassName)}
    >
      <div
        className="relative w-full"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={dynamicSize ? virtualizer.measureElement : undefined}
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
