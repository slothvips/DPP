import type { AnchorHTMLAttributes, MouseEvent } from 'react';

interface LinkAnchorProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  onSingleClick?: () => void | Promise<void>;
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
    if (event.button === 0 && onSingleClick) {
      await onSingleClick();
    }
  };

  return (
    <a href={href} onClick={handleClick} className={className} target={target} {...props}>
      {children}
    </a>
  );
}
