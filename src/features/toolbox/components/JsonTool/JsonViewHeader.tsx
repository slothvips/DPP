import { Check, ChevronLeft, Copy, Download, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface JsonViewHeaderProps {
  copied: boolean;
  error: string | null;
  hasValue: boolean;
  isFormatted: boolean;
  onBack?: () => void;
  onClear: () => void;
  onCopy: () => void;
  onExport: () => void;
  onImport: () => void;
}

export function JsonViewHeader({
  copied,
  error,
  hasValue,
  isFormatted,
  onBack,
  onClear,
  onCopy,
  onExport,
  onImport,
}: JsonViewHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-border shrink-0 bg-background">
      <div className="flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} title="返回工具箱">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <h2 className="text-lg font-semibold text-foreground">JSON 编辑器</h2>
        <p className="text-sm text-muted-foreground">
          {isFormatted ? '已格式化' : '已压缩'}
          {error && <span className="text-destructive ml-2">• 有错误</span>}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onImport} title="导入文件">
          <Upload className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onExport} title="导出文件">
          <Download className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onClear} title="清空">
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onCopy} title="复制" disabled={!hasValue}>
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
