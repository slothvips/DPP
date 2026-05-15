import { Check, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { JenkinsEnvironment } from '@/db';
import { cn } from '@/utils/cn';

interface JenkinsEnvListProps {
  environments: JenkinsEnvironment[];
  currentEnvId: string;
  onSetCurrent: (id: string) => void;
  onEdit: (env: JenkinsEnvironment) => void;
  onDelete: (id: string) => void;
}

export function JenkinsEnvList({
  environments,
  currentEnvId,
  onSetCurrent,
  onEdit,
  onDelete,
}: JenkinsEnvListProps) {
  if (environments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
        暂无 Jenkins 环境配置。
        <br />
        请添加一个环境以开始使用。
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {environments.map((env) => (
        <div
          key={env.id}
          className={cn(
            'flex flex-col gap-3 rounded-lg border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between',
            currentEnvId === env.id
              ? 'border-primary/50 bg-primary/5 dark:bg-primary/10'
              : 'bg-card hover:bg-accent/50'
          )}
        >
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{env.name}</span>
              {currentEnvId === env.id && (
                <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  <Check className="h-3 w-3 shrink-0" /> 当前使用
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="min-w-0 truncate">{env.host}</span>
              <span className="hidden sm:inline">•</span>
              <span className="shrink-0">{env.user || '匿名用户'}</span>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 self-stretch sm:self-auto">
            {currentEnvId !== env.id && (
              <Button
                variant="outline"
                size="sm"
                className="border-primary/30 text-primary hover:border-primary/60 hover:bg-primary/5 hover:text-primary"
                onClick={() => onSetCurrent(env.id)}
                title="设为当前"
              >
                设为当前
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => onEdit(env)} title="编辑">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(env.id)}
              title="删除"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
