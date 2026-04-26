import { Layers, RefreshCw, Search, TerminalSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { JenkinsEnvironment } from '@/db';

interface JenkinsToolbarProps {
  currentEnvId?: string;
  environments: JenkinsEnvironment[];
  filter: string;
  loading: boolean;
  onEnvChange: (envId: string) => void;
  onFilterChange: (value: string) => void;
  onSync: () => void;
}

export function JenkinsToolbar({
  currentEnvId,
  environments,
  filter,
  loading,
  onEnvChange,
  onFilterChange,
  onSync,
}: JenkinsToolbarProps) {
  return (
    <div className="rounded-2xl border border-border/55 bg-success/6 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-success/9 text-success ring-1 ring-success/10">
            <TerminalSquare className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Jenkins</h2>
            <p className="text-xs text-muted-foreground">查看任务与最近构建</p>
          </div>
        </div>
        <Button
          onClick={onSync}
          disabled={loading}
          size="sm"
          className="h-9 gap-1.5 rounded-xl bg-success px-3 text-xs text-success-foreground shadow-sm"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '采集中' : '采集'}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        {environments.length > 0 && (
          <Select value={currentEnvId} onValueChange={onEnvChange}>
            <SelectTrigger className="h-9 w-[188px] rounded-xl border-border/60 bg-background/88 text-xs">
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="选择环境" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {[...environments]
                .sort((a, b) => a.order - b.order)
                .map((env) => (
                  <SelectItem key={env.id} value={env.id} className="text-xs">
                    {env.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索 Job..."
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="h-9 rounded-xl border-border/60 bg-background/88 pl-9"
          />
        </div>
      </div>
    </div>
  );
}
