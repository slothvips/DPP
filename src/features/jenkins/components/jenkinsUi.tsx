import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/** Shared shell for the run / jobs / queue workbench panels. */
export function JenkinsPanel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-background/80',
        className
      )}
    >
      {children}
    </div>
  );
}

/** Shared panel header: icon + title + optional badge + right-aligned actions. */
export function JenkinsPanelHeader({
  icon,
  title,
  badge,
  children,
  className,
}: {
  icon?: ReactNode;
  title: string;
  badge?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-2 border-b border-border/50 px-2.5 py-2',
        className
      )}
    >
      {icon}
      <span className="text-sm font-semibold">{title}</span>
      {badge}
      <div className="min-w-0 flex-1" />
      {children}
    </div>
  );
}

export function JenkinsEmptyState({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-full min-h-32 flex-1 items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-6 text-center text-xs text-muted-foreground',
        className
      )}
    >
      {children}
    </div>
  );
}

export function JenkinsBadge({
  tone = 'muted',
  title,
  children,
}: {
  tone?: 'muted' | 'primary' | 'danger' | 'success';
  title?: string;
  children: ReactNode;
}) {
  const tones = {
    muted: 'border-border bg-muted text-muted-foreground',
    primary: 'border-primary/40 bg-primary/10 text-primary',
    danger: 'border-destructive/40 bg-destructive/10 text-destructive',
    success: 'border-success/40 bg-success/10 text-success',
  } as const;
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-normal',
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

export const JENKINS_SELECT_TRIGGER_CLASS = 'h-7 w-[6.5rem] rounded-lg text-xs';

/** Shared section heading used inside the Jenkins detail dialogs. */
export function JenkinsSectionHeader({
  id,
  icon,
  title,
}: {
  id?: string;
  icon?: ReactNode;
  title: string;
}) {
  return (
    <h3 id={id} className="mb-2 flex items-center gap-2 font-medium">
      {icon}
      {title}
    </h3>
  );
}
