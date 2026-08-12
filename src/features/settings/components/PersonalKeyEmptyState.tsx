import { Key, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PersonalKeyEmptyStateProps {
  importInput: string;
  isGenerating: boolean;
  isImporting: boolean;
  onGenerate: () => void;
  onImport: () => void;
  onImportInputChange: (value: string) => void;
}

export function PersonalKeyEmptyState({
  importInput,
  isGenerating,
  isImporting,
  onGenerate,
  onImport,
  onImportInputChange,
}: PersonalKeyEmptyStateProps) {
  return (
    <div className="space-y-2" data-testid="personal-key-empty">
      <Label htmlFor="personal-key-import-input" className="sr-only">
        个人私钥
      </Label>

      <div className="flex flex-col gap-2 sm:relative sm:block">
        <Input
          id="personal-key-import-input"
          value={importInput}
          onChange={(event) => onImportInputChange(event.target.value)}
          placeholder="粘贴已有个人私钥，或点击右侧生成..."
          className="min-w-0 font-mono text-sm sm:pr-24"
          data-testid="personal-key-import-input"
          autoComplete="off"
          spellCheck={false}
        />
        <div className="flex justify-end sm:absolute sm:bottom-1 sm:right-1 sm:top-1 sm:items-center">
          {importInput ? (
            <Button
              onClick={onImport}
              disabled={isImporting}
              size="sm"
              className="h-7 border-0 bg-primary/10 px-3 text-xs text-primary hover:bg-primary/20"
              data-testid="personal-key-import-button"
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
              data-testid="personal-key-generate-button"
            >
              <Key className="mr-1.5 h-3 w-3 shrink-0" />
              生成随机私钥
            </Button>
          )}
        </div>
      </div>

      <p className="flex items-start gap-1.5 px-1 pt-1 text-[10px] text-destructive">
        <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
        找回个人数据需要此私钥，请勿分享或丢失。
      </p>
    </div>
  );
}
