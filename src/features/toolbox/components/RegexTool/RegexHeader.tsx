import { Check, ChevronLeft, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RegexHeaderProps {
  onBack?: () => void;
  copied: boolean;
  hasMatches: boolean;
  onCopy: () => void;
}

export function RegexHeader({ onBack, copied, hasMatches, onCopy }: RegexHeaderProps) {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-border shrink-0 bg-background">
      {onBack && (
        <Button variant="ghost" size="icon" onClick={onBack} title="返回工具箱">
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
      <div className="flex-1">
        <h2 className="text-lg font-semibold text-foreground">正则表达式测试器</h2>
        <p className="text-sm text-muted-foreground">实时匹配测试，高亮显示匹配结果</p>
      </div>
      {hasMatches && (
        <Button variant="outline" size="icon" onClick={onCopy} title="复制所有匹配">
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
}
