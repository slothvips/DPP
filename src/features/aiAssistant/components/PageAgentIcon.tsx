import { cn } from '@/utils/cn';

export interface PageAgentIconProps {
  className?: string;
}

export function PageAgentIcon({ className }: PageAgentIconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="url(#agent-gradient)"
      strokeWidth="2"
      className={cn('w-4 h-4', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="agent-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: 'var(--gradient-start)' }} />
          <stop offset="50%" style={{ stopColor: 'var(--gradient-middle)' }} />
          <stop offset="100%" style={{ stopColor: 'var(--gradient-end)' }} />
        </linearGradient>
      </defs>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="8" cy="16" r="1" style={{ fill: 'var(--gradient-start)' }} />
      <circle cx="16" cy="16" r="1" style={{ fill: 'var(--gradient-middle)' }} />
    </svg>
  );
}
