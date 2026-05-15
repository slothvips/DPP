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
      className="absolute inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden transition-opacity duration-200"
      style={{
        opacity: isShown ? 1 : 0,
        visibility: isShown ? 'visible' : 'hidden',
        pointerEvents: isShown ? 'auto' : 'none',
      }}
    >
      <div className="h-full min-h-0 min-w-0 overflow-hidden">{children}</div>
    </div>
  );
}
