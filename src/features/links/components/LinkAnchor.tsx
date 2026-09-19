import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { reportNativeLinkOpen } from '@/features/links/utils';

interface LinkAnchorProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  onSingleClick?: () => void | Promise<void>;
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
}

export function LinkAnchor({
  href,
  children,
  className,
  onSingleClick,
  target,
  ...props
}: LinkAnchorProps) {
  const handleClick = async (event: MouseEvent<HTMLAnchorElement>) => {
    // 非主键交给 auxclick；组合键保持原生开标签，只补访问记录
    if (event.button !== 0) return;
    if (isModifiedClick(event)) {
      reportNativeLinkOpen(href);
      return;
    }
    event.preventDefault();
    if (onSingleClick) {
      await onSingleClick();
    }
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      onAuxClick={(event) => {
        if (event.button === 1) reportNativeLinkOpen(href);
      }}
      className={className}
      target={target}
      {...props}
    >
      {children}
    </a>
  );
}
