import { ChevronDown, ChevronUp, Clipboard } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface JsonErrorPanelProps {
  error: string;
  onCopyError: () => void;
  onToggle: () => void;
  showErrors: boolean;
}

export function JsonErrorPanel({ error, onCopyError, onToggle, showErrors }: JsonErrorPanelProps) {
  return (
    <div className="border-b border-border bg-destructive/10">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-4 py-2 text-sm font-medium text-destructive hover:text-destructive/80 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-destructive" />
          JSON 语法错误
        </span>
        {showErrors ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {showErrors && (
        <div className="px-4 pb-3">
          <div className="flex items-start justify-between gap-2">
            <code className="text-sm text-destructive/80 bg-destructive/5 px-2 py-1 rounded font-mono break-all">
              {error}
            </code>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onCopyError}>
              <Clipboard className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
