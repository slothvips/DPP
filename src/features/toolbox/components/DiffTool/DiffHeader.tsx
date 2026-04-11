import { ChevronsLeftRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DiffHeaderProps {
  aiLoading: boolean;
  onAISummarize: () => void;
  onSwap: () => void;
}

export function DiffHeader({ aiLoading, onAISummarize, onSwap }: DiffHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-border shrink-0 bg-background">
      <div>
        <h2 className="text-lg font-semibold text-foreground">文本差异对比工具</h2>
        <p className="text-sm text-muted-foreground">双栏编辑，差异高亮</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={onAISummarize}
          title="AI 解读"
          disabled={aiLoading}
        >
          {aiLoading ? (
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </Button>
        <Button variant="outline" size="icon" onClick={onSwap} title="交换内容">
          <ChevronsLeftRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
