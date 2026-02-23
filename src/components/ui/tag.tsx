import React from 'react';
import { cn } from '@/utils/cn';

interface TagProps {
  name: string;
  color?: string; // e.g. "red", "#f00", "bg-red-500" - currently unused but kept for interface compatibility
  size?: 'sm' | 'md'; // 'sm' for compact lists
  onRemove?: () => void;
  className?: string;
  onClick?: () => void;
}

export function Tag({
  name,
  color: _color,
  size = 'md',
  onRemove: _onRemove,
  className,
  onClick,
}: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded font-medium bg-info/10 text-info border border-info/20 max-w-[120px] group/tag relative transition-colors',
        size === 'sm' ? 'px-1 py-0 text-[10px] h-4' : 'px-2 py-0.5 text-xs',
        onClick && 'cursor-pointer hover:bg-info/20',
        className
      )}
      title={name}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <span className="truncate">{name}</span>
      {/* {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 shrink-0 text-info hover:text-info-foreground hover:bg-info rounded-full p-0.5 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )} */}
    </span>
  );
}
