import type { ReactNode } from 'react';

interface KeepAliveTabPanelProps {
  active: boolean;
  children: ReactNode;
  visible: boolean;
}

export function KeepAliveTabPanel({ active, children, visible }: KeepAliveTabPanelProps) {
  const isShown = active && visible;

  return (
    <div
      className="absolute inset-0 transition-opacity duration-200"
      style={{
        opacity: isShown ? 1 : 0,
        visibility: isShown ? 'visible' : 'hidden',
        pointerEvents: isShown ? 'auto' : 'none',
      }}
    >
      {children}
    </div>
  );
}
