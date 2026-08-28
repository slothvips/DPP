import { Check, ChevronDown, ChevronUp, CircleAlert, ListTodo, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { AIPlan, AIPlanStepStatus } from '@/lib/ai/plan';

interface AIPlanPanelProps {
  plan: AIPlan | null;
  title?: string;
  defaultExpanded?: boolean;
}

export function AIPlanPanel({
  plan,
  title = '当前计划',
  defaultExpanded = true,
}: AIPlanPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!plan) return null;

  return (
    <section
      className="max-h-72 shrink-0 overflow-y-auto overscroll-contain border-b border-primary/20 bg-primary/5 px-2 py-3 custom-scrollbar sm:px-3"
      aria-label={title}
    >
      <div className="flex items-start gap-2">
        <ListTodo className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-foreground">{title}</p>
            <span className="text-[11px] text-muted-foreground">{getPlanProgress(plan)}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto h-7 w-7 rounded-md text-muted-foreground"
              onClick={() => setIsExpanded((expanded) => !expanded)}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? '收起计划' : '展开计划'}
              title={isExpanded ? '收起计划' : '展开计划'}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
          {isExpanded && (
            <>
              <p className="mt-1 break-words text-xs text-muted-foreground">{plan.goal}</p>
              <ol className="mt-2 space-y-1.5">
                {plan.steps.map((step) => (
                  <li key={step.id} className="flex min-w-0 items-start gap-2 text-xs">
                    <StepIcon status={step.status} />
                    <span
                      className={`min-w-0 break-words ${step.status === 'completed' ? 'text-muted-foreground' : 'text-foreground'}`}
                    >
                      {step.title}
                      {step.note && (
                        <span className="ml-1 text-[11px] text-muted-foreground">
                          ({step.note})
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
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
