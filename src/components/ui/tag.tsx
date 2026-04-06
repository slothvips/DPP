import { transparentize } from 'color2k';
import React from 'react';
import { cn } from '@/utils/cn';

interface TagProps {
  name: string;
  color?: string;
  size?: 'sm' | 'md';
  className?: string;
  onClick?: () => void;
}

function getTagStyle(color?: string): React.CSSProperties | undefined {
  if (!color) {
    return undefined;
  }

  try {
    return {
      backgroundColor: transparentize(color, 0.82),
      borderColor: transparentize(color, 0.65),
      color,
    };
  } catch {
    return undefined;
  }
}

export function Tag({ name, color, size = 'md', className, onClick }: TagProps) {
  const tagStyle = getTagStyle(color);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded font-medium bg-info/20 dark:bg-info/30 text-info border border-info/30 dark:border-info/40 max-w-[120px] group/tag relative transition-colors',
        size === 'sm' ? 'px-1 py-0 text-[10px] h-4' : 'px-2 py-0.5 text-xs',
        onClick && 'cursor-pointer hover:bg-info/30 dark:hover:bg-info/40',
        className
      )}
      style={tagStyle}
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
    </span>
  );
}
