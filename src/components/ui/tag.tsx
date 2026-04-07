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
      backgroundColor: transparentize(color, 0.9),
      borderColor: transparentize(color, 0.72),
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
        'inline-flex items-center gap-1.5 rounded font-medium border bg-muted/80 text-foreground border-border max-w-[120px] group/tag relative transition-colors shadow-sm',
        size === 'sm' ? 'px-1 py-0 text-[10px] h-4' : 'px-2 py-0.5 text-xs',
        onClick && 'cursor-pointer hover:bg-muted',
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
      {color && (
        <span
          className={cn(
            'shrink-0 rounded-full border border-background/80 ring-1 ring-border/60',
            size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2'
          )}
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      )}
      <span className="truncate">{name}</span>
    </span>
  );
}
