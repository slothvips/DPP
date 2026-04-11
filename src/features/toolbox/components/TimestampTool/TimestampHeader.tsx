import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TimestampHeaderProps {
  onBack?: () => void;
}

export function TimestampHeader({ onBack }: TimestampHeaderProps) {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-border shrink-0 bg-background">
      {onBack && (
        <Button variant="ghost" size="icon" onClick={onBack} title="返回工具箱">
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
      <div className="flex-1">
        <h2 className="text-lg font-semibold text-foreground">时间戳转换器</h2>
        <p className="text-sm text-muted-foreground">时间戳与日期时间互转，支持多时区</p>
      </div>
    </div>
  );
}
