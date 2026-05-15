import { Key, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SyncKeyEmptyStateProps {
  importInput: string;
  isGenerating: boolean;
  isImporting: boolean;
  onGenerate: () => void;
  onImport: () => void;
  onImportInputChange: (value: string) => void;
}

export function SyncKeyEmptyState({
  importInput,
  isGenerating,
  isImporting,
  onGenerate,
  onImport,
  onImportInputChange,
}: SyncKeyEmptyStateProps) {
  return (
    <div className="space-y-2">
      <Label className="flex flex-wrap items-center gap-2 text-sm font-medium">
        同步密钥
        <span className="text-xs font-normal text-muted-foreground">(必填，用于加密数据)</span>
      </Label>

      <div className="flex flex-col gap-2 sm:relative sm:block">
        <Input
          value={importInput}
          onChange={(event) => onImportInputChange(event.target.value)}
          placeholder="在此输入密钥，或点击右侧生成..."
          className="min-w-0 font-mono text-sm sm:pr-24"
        />
        <div className="flex justify-end sm:absolute sm:bottom-1 sm:right-1 sm:top-1 sm:items-center">
          {importInput ? (
            <Button
              onClick={onImport}
              disabled={isImporting}
              size="sm"
              className="h-7 border-0 bg-primary/10 px-3 text-xs text-primary hover:bg-primary/20"
            >
              导入
            </Button>
          ) : (
            <Button
              onClick={onGenerate}
              disabled={isGenerating}
              variant="ghost"
              size="sm"
              className="h-7 px-3 text-xs text-primary hover:bg-primary/10 hover:text-primary"
            >
              <Key className="mr-1.5 h-3 w-3 shrink-0" />
              生成随机密钥
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1 px-1 pt-1">
        <p className="text-[10px] text-muted-foreground">
          请妥善保管此密钥。丢失密钥将导致无法解密同步数据。
        </p>
        <p className="flex items-start gap-1.5 text-[10px] text-primary">
          <Users className="mt-0.5 h-3 w-3 shrink-0" />
          团队协作提示：所有成员需配置完全一致的密钥才能共享数据
        </p>
      </div>
    </div>
  );
}
