import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TimestampHeaderProps {
  onBack?: () => void;
}

export function TimestampHeader({ onBack }: TimestampHeaderProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3 border-b border-border bg-background p-4">
      {onBack && (
        <Button variant="ghost" size="icon" onClick={onBack} title="返回工具箱">
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold text-foreground">时间戳转换器</h2>
        <p className="break-words text-sm text-muted-foreground">
          时间戳与日期时间互转，支持多时区
        </p>
      </div>
    </div>
  );
}
