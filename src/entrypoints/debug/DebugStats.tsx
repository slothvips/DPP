import type { DebugOperation } from './debugTypes';

interface DebugStatsProps {
  ops: DebugOperation[];
  hasKey: boolean;
}

export function DebugStats({ ops, hasKey }: DebugStatsProps) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="p-4 border rounded bg-card">
        <div className="text-sm text-muted-foreground">Total Operations</div>
        <div className="text-2xl font-bold">{ops.length}</div>
      </div>
      <div className="p-4 border rounded bg-card">
        <div className="text-sm text-muted-foreground">Encryption Key</div>
        <div className="text-2xl font-bold text-success">{hasKey ? 'Loaded' : 'Missing'}</div>
      </div>
    </div>
  );
}
