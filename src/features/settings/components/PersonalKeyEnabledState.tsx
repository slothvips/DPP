import { Copy, Eye, EyeOff, Shield, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PersonalKeyEnabledStateProps {
  actionsDisabled?: boolean;
  /** 仅禁用更换密钥（例如尚未配置同步服务器） */
  replaceDisabled?: boolean;
  isReplaceOpen: boolean;
  isReplacing: boolean;
  keyString: string;
  replaceInput: string;
  showKey: boolean;
  onClear: () => void;
  onCopyKey: () => void;
  onGenerateReplace: () => void;
  onReplace: () => void;
  onReplaceInputChange: (value: string) => void;
  onReplaceOpenChange: (open: boolean) => void;
  onToggleShowKey: () => void;
}

export function PersonalKeyEnabledState({
  actionsDisabled = false,
  replaceDisabled = false,
  isReplaceOpen,
  isReplacing,
  keyString,
  replaceInput,
  showKey,
  onClear,
  onCopyKey,
  onGenerateReplace,
  onReplace,
  onReplaceInputChange,
  onReplaceOpenChange,
  onToggleShowKey,
}: PersonalKeyEnabledStateProps) {
  return (
    <div className="space-y-2" data-testid="personal-key-enabled">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-medium">个人私钥</span>
          <span className="flex items-center gap-1 rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-xs font-normal text-success">
            <Shield className="h-3 w-3 shrink-0" />
            已配置
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={actionsDisabled || replaceDisabled}
            onClick={() => onReplaceOpenChange(true)}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            data-testid="personal-key-replace-button"
          >
            更换密钥
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={actionsDisabled}
            onClick={onClear}
            className="h-6 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            data-testid="personal-key-clear-button"
          >
            清除密钥
          </Button>
        </div>
      </div>

      <div className="relative min-w-0">
        <Input
          readOnly
          value={showKey ? keyString : '••••••••••••••••••••••••••••••••'}
          type={showKey ? 'text' : 'password'}
          className="min-w-0 bg-muted/50 pr-20 font-mono text-sm text-muted-foreground"
          data-testid="personal-key-value-input"
          autoComplete="off"
        />
        <div className="absolute bottom-1 right-1 top-1 flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onToggleShowKey}
            data-testid="personal-key-toggle-visibility"
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCopyKey}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="复制"
            data-testid="personal-key-copy-button"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="flex items-start gap-1.5 px-1 text-[10px] text-destructive">
        <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
        找回个人数据需要此私钥，请勿分享或丢失。
      </p>

      <Dialog open={isReplaceOpen} onOpenChange={onReplaceOpenChange}>
        <DialogContent className="sm:max-w-[420px]" data-testid="personal-key-replace-dialog">
          <DialogHeader>
            <DialogTitle>更换个人私钥</DialogTitle>
            <DialogDescription>
              覆盖后，旧密钥加密的个人数据将无法解密。本地个人数据会先用新密钥推送，再从服务器重建。请仅在你的其他可信设备上使用同一私钥。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-2">
            <Label htmlFor="personal-key-replace-input">新私钥</Label>
            <Input
              id="personal-key-replace-input"
              value={replaceInput}
              onChange={(event) => onReplaceInputChange(event.target.value)}
              placeholder="粘贴新的个人私钥..."
              className="font-mono text-sm"
              data-testid="personal-key-replace-input"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isReplacing}
              onClick={() => void onGenerateReplace()}
              data-testid="personal-key-replace-generate-button"
            >
              生成并替换
            </Button>
            <Button
              type="button"
              disabled={isReplacing || !replaceInput.trim()}
              onClick={() => void onReplace()}
              data-testid="personal-key-replace-confirm-button"
            >
              导入并替换
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
