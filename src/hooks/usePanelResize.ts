import { useCallback, useEffect, useRef, useState } from 'react';

export type ResizeUnit = 'px' | 'percent';

interface UsePanelResizeOptions {
  /** 初始值 */
  initialValue: number;
  /** 最小值 */
  min: number;
  /** 最大值 */
  max: number;
  /** 单位类型 */
  unit: ResizeUnit;
  /** 拖拽方向：left 表示向左拖增大，right 表示向右拖增大 */
  direction?: 'left' | 'right';
}

interface UsePanelResizeReturn {
  /** 当前值 */
  value: number;
  /** 设置值 */
  setValue: (value: number) => void;
  /** 容器 ref（仅 percent 模式需要） */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** 拖拽手柄的 props */
  handleProps: {
    onMouseDown: (e: React.MouseEvent) => void;
    className: string;
  };
}

/**
 * 面板拖拽调整大小的 hook
 *
 * @example
 * // 百分比模式（用于左右分栏）
 * const { value, containerRef, handleProps } = usePanelResize({
 *   initialValue: 50,
 *   min: 20,
 *   max: 80,
 *   unit: 'percent',
 * });
 *
 * @example
 * // 像素模式（用于固定宽度侧边栏）
 * const { value, handleProps } = usePanelResize({
 *   initialValue: 500,
 *   min: 300,
 *   max: 800,
 *   unit: 'px',
 *   direction: 'left', // 向左拖动增大宽度
 * });
 */
export function usePanelResize({
  initialValue,
  min,
  max,
  unit,
  direction = 'right',
}: UsePanelResizeOptions): UsePanelResizeReturn {
  const [value, setValue] = useState(initialValue);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startValueRef = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizingRef.current = true;
      startXRef.current = e.clientX;
      startValueRef.current = value;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [value]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;

      if (unit === 'percent') {
        // 百分比模式：基于容器宽度计算
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const newValue = ((e.clientX - rect.left) / rect.width) * 100;
        setValue(Math.min(Math.max(newValue, min), max));
      } else {
        // 像素模式：基于拖拽距离计算
        const delta = e.clientX - startXRef.current;
        const actualDelta = direction === 'left' ? -delta : delta;
        const newValue = startValueRef.current + actualDelta;
        setValue(Math.min(Math.max(newValue, min), max));
      }
    };

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [unit, min, max, direction]);

  return {
    value,
    setValue,
    containerRef,
    handleProps: {
      onMouseDown: handleMouseDown,
      className: 'w-1 cursor-col-resize bg-border hover:bg-primary/50 transition-colors shrink-0',
    },
  };
}
