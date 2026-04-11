import { AlertTriangle, Download, Key, RefreshCw, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SyncKeyChangeDialogProps {
  confirmText: string;
  isMigrating: boolean;
  migrationMode: 'authority' | 'member';
  newKeyInput: string;
  onConfirmTextChange: (value: string) => void;
  onGenerateNewKey: () => void;
  onMigrationModeChange: (value: 'authority' | 'member') => void;
  onNewKeyInputChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  open: boolean;
}

export function SyncKeyChangeDialog({
  confirmText,
  isMigrating,
  migrationMode,
  newKeyInput,
  onConfirmTextChange,
  onGenerateNewKey,
  onMigrationModeChange,
  onNewKeyInputChange,
  onOpenChange,
  onSubmit,
  open,
}: SyncKeyChangeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          更换密钥
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>更换同步密钥</DialogTitle>
          <DialogDescription className="space-y-3 pt-2">
            <div className="flex items-start gap-2 p-2 bg-destructive/10 text-destructive rounded-md text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1 font-medium">
                <p className="font-bold">⚠️ 高风险操作：将重置同步状态</p>
                <ul className="list-disc list-inside space-y-1 text-[11px] leading-tight">
                  <li>
                    <span className="font-semibold">同步中断：</span>
                    团队其他成员必须手动更换为相同的密钥，否则将无法继续同步。
                  </li>
                  <li>
                    <span className="font-semibold">全量重写：</span>
                    本设备将作为“权威数据源”，重新加密并上传所有本地数据。
                  </li>
                  <li>
                    <span className="font-semibold">覆盖风险：</span>
                    其他设备上未同步的修改可能会在更新密钥后被本设备的数据覆盖。
                  </li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              确认更换后，系统将使用新密钥重新初始化同步。请确保本设备的数据是最新的。
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>选择操作模式</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className={`border rounded-md p-3 text-left transition-all ${migrationMode === 'member' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-input hover:border-primary/50 hover:bg-muted/50'}`}
                onClick={() => onMigrationModeChange('member')}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Download className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">我是普通成员</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  清空本地数据，从云端下载最新数据。
                  <span className="block mt-1 text-destructive font-semibold">
                    * 本地数据将丢失
                  </span>
                </p>
              </button>

              <button
                type="button"
                className={`border rounded-md p-3 text-left transition-all ${migrationMode === 'authority' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-input hover:border-primary/50 hover:bg-muted/50'}`}
                onClick={() => onMigrationModeChange('authority')}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Server className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">我是管理员</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  保留本地数据，重新加密并上传到云端。
                  <span className="block mt-1 text-primary font-semibold">* 覆盖云端数据</span>
                </p>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>新密钥</Label>
            <div className="flex gap-2">
              <Input
                value={newKeyInput}
                onChange={(event) => onNewKeyInputChange(event.target.value)}
                placeholder="输入新密钥或生成随机密钥"
                className="font-mono text-sm"
              />
              {migrationMode === 'authority' && (
                <Button
                  variant="outline"
                  onClick={onGenerateNewKey}
                  title="生成随机密钥"
                  className="shrink-0"
                >
                  <Key className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-destructive font-medium">确认操作</Label>
            <Input
              value={confirmText}
              onChange={(event) => onConfirmTextChange(event.target.value)}
              placeholder="请输入：确认更换密钥"
              className="text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isMigrating}>
            取消
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isMigrating || !newKeyInput || confirmText !== '确认更换密钥'}
            variant={confirmText === '确认更换密钥' ? 'destructive' : 'default'}
          >
            {isMigrating ? '正在处理...' : '确认更换'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
