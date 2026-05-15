import { Bug, Copy, Eye, EyeOff, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SyncKeyChangeDialog } from './SyncKeyChangeDialog';

interface SyncKeyEnabledStateProps {
  confirmText: string;
  isChangeDialogOpen: boolean;
  isMigrating: boolean;
  keyString: string;
  migrationMode: 'authority' | 'member';
  newKeyInput: string;
  onClear: () => void;
  onConfirmTextChange: (value: string) => void;
  onCopyKey: () => void;
  onDebug: () => void;
  onGenerateNewKey: () => void;
  onMigrationModeChange: (value: 'authority' | 'member') => void;
  onNewKeyInputChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmitMigration: () => void;
  onToggleShowKey: () => void;
  showKey: boolean;
}

export function SyncKeyEnabledState({
  confirmText,
  isChangeDialogOpen,
  isMigrating,
  keyString,
  migrationMode,
  newKeyInput,
  onClear,
  onConfirmTextChange,
  onCopyKey,
  onDebug,
  onGenerateNewKey,
  onMigrationModeChange,
  onNewKeyInputChange,
  onOpenChange,
  onSubmitMigration,
  onToggleShowKey,
  showKey,
}: SyncKeyEnabledStateProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-medium">同步密钥</span>
          <span className="flex items-center gap-1 rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-xs font-normal text-success">
            <Shield className="h-3 w-3 shrink-0" />
            已启用加密
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SyncKeyChangeDialog
            confirmText={confirmText}
            isMigrating={isMigrating}
            migrationMode={migrationMode}
            newKeyInput={newKeyInput}
            onConfirmTextChange={onConfirmTextChange}
            onGenerateNewKey={onGenerateNewKey}
            onMigrationModeChange={onMigrationModeChange}
            onNewKeyInputChange={onNewKeyInputChange}
            onOpenChange={onOpenChange}
            onSubmit={onSubmitMigration}
            open={isChangeDialogOpen}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-6 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            清除密钥
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDebug}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            title="调试同步数据"
          >
            <Bug className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="relative min-w-0">
        <Input
          readOnly
          value={keyString}
          type={showKey ? 'text' : 'password'}
          className="min-w-0 bg-muted/50 pr-20 font-mono text-sm text-muted-foreground"
        />
        <div className="absolute bottom-1 right-1 top-1 flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onToggleShowKey}
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCopyKey}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="复制"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1 px-1">
        <p className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
          <Shield className="mt-0.5 h-3 w-3 shrink-0 text-success" />
          数据在本地加密后传输，服务器无法解密
        </p>
        <p className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
          <Users className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
          若需共享数据，请确保团队成员使用相同密钥
        </p>
      </div>
    </div>
  );
}
