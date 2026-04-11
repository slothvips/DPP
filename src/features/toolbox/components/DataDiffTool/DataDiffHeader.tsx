import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DataDiffHeaderProps {
  onBack?: () => void;
  subtitle: string;
  title: string;
}

export function DataDiffHeader({ onBack, subtitle, title }: DataDiffHeaderProps) {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-border shrink-0 bg-background">
      {onBack && (
        <Button variant="ghost" size="icon" onClick={onBack} title="返回">
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
      <div className="flex-1">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
