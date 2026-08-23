import { Check, CircleAlert, ListTodo, Loader2 } from 'lucide-react';
import type { AIPlan, AIPlanStepStatus } from '@/lib/ai/plan';

export function AIPlanPanel({ plan, title = '当前计划' }: { plan: AIPlan | null; title?: string }) {
  if (!plan) return null;

  return (
    <section
      className="shrink-0 border-b border-primary/20 bg-primary/5 px-2 py-3 sm:px-3"
      aria-label={title}
    >
      <div className="flex items-start gap-2">
        <ListTodo className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-foreground">{title}</p>
            <span className="text-[11px] text-muted-foreground">{getPlanProgress(plan)}</span>
          </div>
          <p className="mt-1 break-words text-xs text-muted-foreground">{plan.goal}</p>
          <ol className="mt-2 space-y-1.5">
            {plan.steps.map((step) => (
              <li key={step.id} className="flex min-w-0 items-start gap-2 text-xs">
                <StepIcon status={step.status} />
                <span
                  className={
                    step.status === 'completed' ? 'text-muted-foreground' : 'text-foreground'
                  }
                >
                  {step.title}
                  {step.note && (
                    <span className="ml-1 text-[11px] text-muted-foreground">({step.note})</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function StepIcon({ status }: { status: AIPlanStepStatus }) {
  if (status === 'completed') return <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />;
  if (status === 'blocked')
    return <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />;
  if (status === 'in_progress')
    return <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-info" />;
  return (
    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border border-muted-foreground/50" />
  );
}

function getPlanProgress(plan: AIPlan): string {
  const completed = plan.steps.filter((step) => step.status === 'completed').length;
  return `${completed}/${plan.steps.length}`;
}
