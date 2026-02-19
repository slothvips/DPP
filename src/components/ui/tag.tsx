import { X } from 'lucide-react';
import React from 'react';
import { cn } from '@/utils/cn';

interface TagProps {
  name: string;
  color?: string; // hex color like "#FF5733"
  size?: 'sm' | 'md'; // 'sm' for compact lists
  onRemove?: () => void;
  className?: string;
  onClick?: () => void;
}

function getColorStyles(color?: string) {
  if (!color) {
    return {
      bg: 'bg-info/10',
      text: 'text-info',
      border: 'border-info/20',
      hoverBg: 'hover:bg-info/20',
      removeHover: 'hover:text-info-foreground hover:bg-info',
    };
  }

  // Parse hex color
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate lighter background color
  const bgR = Math.min(255, Math.round(r + (255 - r) * 0.85));
  const bgG = Math.min(255, Math.round(g + (255 - g) * 0.85));
  const bgB = Math.min(255, Math.round(b + (255 - b) * 0.85));

  // Calculate darker hover color
  const hoverR = Math.max(0, Math.round(r * 0.8));
  const hoverG = Math.max(0, Math.round(g * 0.8));
  const hoverB = Math.max(0, Math.round(b * 0.8));

  const textColor = `rgb(${r}, ${g}, ${b})`;
  const bgColor = `rgb(${bgR}, ${bgG}, ${bgB})`;
  const hoverColor = `rgb(${hoverR}, ${hoverG}, ${hoverB})`;

  return {
    bg: '',
    text: '',
    border: '',
    hoverBg: '',
    removeHover: '',
    customStyle: {
      backgroundColor: bgColor,
      color: textColor,
      borderColor: `rgba(${r}, ${g}, ${b}, 0.2)`,
    },
    customHover: {
      backgroundColor: hoverColor,
    },
    customRemoveHover: {
      backgroundColor: textColor,
      color: 'white',
    },
  };
}

export function Tag({ name, color, size = 'md', onRemove, className, onClick }: TagProps) {
  const colorStyles = getColorStyles(color);
  const hasCustomColor = !!color;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded font-medium border max-w-[120px] group/tag relative transition-colors',
        !hasCustomColor && colorStyles.bg,
        !hasCustomColor && colorStyles.text,
        !hasCustomColor && colorStyles.border,
        size === 'sm' ? 'px-1 py-0 text-[10px] h-4' : 'px-2 py-0.5 text-xs',
        !hasCustomColor && onClick && colorStyles.hoverBg,
        className
      )}
      style={hasCustomColor ? colorStyles.customStyle : undefined}
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
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={cn(
            'ml-1 shrink-0 rounded-full p-0.5 transition-colors',
            !hasCustomColor && colorStyles.removeHover
          )}
          style={hasCustomColor ? colorStyles.customRemoveHover : undefined}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}
