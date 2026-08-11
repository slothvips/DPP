import { AlertTriangle, Check, CheckCircle2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import {
  PERSONAL_KEY_SETUP_STEPS,
  type PersonalKeySetupProgressState,
  getPersonalKeySetupStatusText,
  getPersonalKeySetupStepIndex,
} from './personalKeySetupSteps';

interface PersonalKeySetupProgressProps {
  progress: PersonalKeySetupProgressState;
  onDismissError?: () => void;
  onOpenCustodyGuide?: () => void;
}

export function PersonalKeySetupProgress({
  progress,
  onDismissError,
  onOpenCustodyGuide,
}: PersonalKeySetupProgressProps) {
  const currentIndex = getPersonalKeySetupStepIndex(progress);
  const isError = progress.phase === 'error';
  const isDone = progress.phase === 'done';

  return (
    <div
      className={cn(
        'space-y-2.5 rounded-lg border px-3 py-2.5',
        isError
          ? 'border-destructive/30 bg-destructive/5'
          : isDone
            ? 'border-success/30 bg-success/5'
            : 'border-primary/25 bg-primary/5'
      )}
      data-testid="personal-key-setup-progress"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        {isError ? (
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
        ) : isDone ? (
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
        ) : (
          <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
        )}
        <div className="min-w-0 flex-1 space-y-0.5">
          <p
            className={cn('text-xs font-medium', isError ? 'text-destructive' : 'text-foreground')}
          >
            {isError
              ? '后续同步未完成'
              : isDone
                ? '个人私钥后续处理完成'
                : '正在完成个人私钥后续处理'}
          </p>
          <p className="text-[11px] leading-5 text-muted-foreground">
            {getPersonalKeySetupStatusText(progress)}
          </p>
        </div>
      </div>

      <ol className="space-y-1.5 pl-0.5">
        {PERSONAL_KEY_SETUP_STEPS.map((step, index) => {
          const completed = isDone || currentIndex > index;
          const active = !isDone && !isError && currentIndex === index;
          const failed = isError && currentIndex === index;

          return (
            <li
              key={step.id}
              className="flex items-center gap-2 text-[11px] leading-4"
              data-testid={`personal-key-setup-step-${step.id}`}
              data-state={completed ? 'done' : failed ? 'error' : active ? 'active' : 'pending'}
            >
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                  completed && 'border-success/40 bg-success/15 text-success',
                  active && 'border-primary/40 bg-primary/10 text-primary',
                  failed && 'border-destructive/40 bg-destructive/10 text-destructive',
                  !completed && !active && !failed && 'border-border text-muted-foreground'
                )}
              >
                {completed ? (
                  <Check className="h-2.5 w-2.5" />
                ) : failed ? (
                  <X className="h-2.5 w-2.5" />
                ) : active ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : (
                  <span className="text-[9px]">{index + 1}</span>
                )}
              </span>
              <span
                className={cn(
                  completed && 'text-foreground',
                  active && 'font-medium text-foreground',
                  failed && 'font-medium text-destructive',
                  !completed && !active && !failed && 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      {isError ? (
        <div className="flex flex-wrap gap-2 pt-0.5">
          {onOpenCustodyGuide ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              onClick={onOpenCustodyGuide}
              data-testid="personal-key-setup-open-custody"
            >
              查看保管指南
            </Button>
          ) : null}
          {onDismissError ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px]"
              onClick={onDismissError}
              data-testid="personal-key-setup-dismiss-error"
            >
              知道了
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
