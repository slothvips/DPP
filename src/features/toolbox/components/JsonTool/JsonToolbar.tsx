import { Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface JsonToolbarProps {
  aiError: string | null;
  aiFixing: boolean;
  disabled: boolean;
  onAIFix: () => void;
  onFormat: () => void;
  onMinify: () => void;
}

export function JsonToolbar({
  aiError,
  aiFixing,
  disabled,
  onAIFix,
  onFormat,
  onMinify,
}: JsonToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30 shrink-0">
      <Button size="sm" variant="outline" onClick={onFormat} disabled={disabled || aiFixing}>
        格式化
      </Button>
      <Button size="sm" variant="outline" onClick={onMinify} disabled={disabled || aiFixing}>
        压缩
      </Button>
      <div className="h-4 w-px bg-border mx-1" />
      <Button size="sm" variant="outline" onClick={onAIFix} disabled={aiFixing}>
        {aiFixing ? (
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        ) : (
          <Zap className="h-3 w-3 mr-1" />
        )}
        AI 修复
      </Button>
      {aiError && <span className="text-xs text-destructive ml-2">{aiError}</span>}
    </div>
  );
}
