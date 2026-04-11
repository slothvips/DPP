import { Layers, RefreshCw, Search } from 'lucide-react';
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {environments.length > 0 && (
          <Select value={currentEnvId} onValueChange={onEnvChange}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-muted-foreground" />
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
          <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索 Job..."
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="h-8 pl-8"
          />
        </div>

        <Button onClick={onSync} disabled={loading} size="sm" className="h-8 text-xs gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '采集中' : '采集'}
        </Button>
      </div>
    </div>
  );
}
