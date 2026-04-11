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
            'flex items-center justify-between p-4 rounded-lg border transition-colors',
            currentEnvId === env.id
              ? 'border-primary/50 bg-primary/5 dark:bg-primary/10'
              : 'bg-card hover:bg-accent/50'
          )}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{env.name}</span>
              {currentEnvId === env.id && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" /> 当前使用
                </span>
              )}
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <span className="truncate max-w-[200px]">{env.host}</span>
              <span>•</span>
              <span>{env.user || '匿名用户'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentEnvId !== env.id && (
              <Button
                variant="outline"
                size="sm"
                className="border-primary/30 text-primary hover:bg-primary/5 hover:text-primary hover:border-primary/60"
                onClick={() => onSetCurrent(env.id)}
                title="设为当前"
              >
                设为当前
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => onEdit(env)} title="编辑">
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(env.id)}
              title="删除"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
