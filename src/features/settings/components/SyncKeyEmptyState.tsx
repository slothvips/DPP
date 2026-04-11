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
      <Label className="text-sm font-medium flex items-center gap-2">
        同步密钥
        <span className="text-xs font-normal text-muted-foreground">(必填，用于加密数据)</span>
      </Label>

      <div className="relative">
        <Input
          value={importInput}
          onChange={(event) => onImportInputChange(event.target.value)}
          placeholder="在此输入密钥，或点击右侧生成..."
          className="font-mono text-sm pr-24"
        />
        <div className="absolute right-1 top-1 bottom-1 flex items-center">
          {importInput ? (
            <Button
              onClick={onImport}
              disabled={isImporting}
              size="sm"
              className="h-7 px-3 text-xs bg-primary/10 text-primary hover:bg-primary/20 border-0"
            >
              导入
            </Button>
          ) : (
            <Button
              onClick={onGenerate}
              disabled={isGenerating}
              variant="ghost"
              size="sm"
              className="h-7 px-3 text-xs text-primary hover:text-primary hover:bg-primary/10"
            >
              <Key className="w-3 h-3 mr-1.5" />
              生成随机密钥
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1 px-1 pt-1">
        <p className="text-[10px] text-muted-foreground">
          请妥善保管此密钥。丢失密钥将导致无法解密同步数据。
        </p>
        <p className="text-[10px] text-primary flex items-center gap-1.5">
          <Users className="w-3 h-3" />
          团队协作提示：所有成员需配置完全一致的密钥才能共享数据
        </p>
      </div>
    </div>
  );
}
