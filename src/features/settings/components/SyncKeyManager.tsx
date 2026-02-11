import {
  AlertTriangle,
  Bug,
  Copy,
  Download,
  Eye,
  EyeOff,
  Key,
  RefreshCw,
  Server,
  Shield,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
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
import { useToast } from '@/components/ui/toast';
import { getSyncEngine } from '@/db';
import {
  clearKey,
  exportKey,
  generateSyncKey,
  importKey,
  loadKey,
  storeKey,
  verifyKey,
} from '@/lib/crypto/encryption';
import { logger } from '@/utils/logger';

interface SyncKeyManagerProps {
  // Optional callback to notify parent when key changes
  onKeyChange?: (key: string) => void;
  // Optional callback to notify parent when key is cleared
  onClear?: () => void;
  // Optional prop to trigger key check from parent
  initialKeyLoaded?: boolean;
}

export function SyncKeyManager({
  onKeyChange,
  onClear,
  initialKeyLoaded,
}: SyncKeyManagerProps = {}) {
  const { toast } = useToast();
  const [hasKey, setHasKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [keyString, setKeyString] = useState('');
  const [importInput, setImportInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isChangeDialogOpen, setIsChangeDialogOpen] = useState(false);
  const [newKeyInput, setNewKeyInput] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [migrationMode, setMigrationMode] = useState<'authority' | 'member'>('member');
  const [isMigrating, setIsMigrating] = useState(false);

  const checkKey = React.useCallback(async () => {
    try {
      const key = await loadKey();
      if (key) {
        setHasKey(true);
        const exported = await exportKey(key);
        setKeyString(exported);
      } else {
        setHasKey(false);
        setKeyString('');
      }
    } catch (e) {
      logger.error('Failed to load key:', e);
    }
  }, []);

  useEffect(() => {
    if (initialKeyLoaded !== undefined) {
      checkKey();
    } else {
      checkKey();
    }
  }, [checkKey, initialKeyLoaded]);

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      const key = await generateSyncKey();
      await storeKey(key);
      await checkKey();
      toast('同步密钥已生成并保存', 'success');
      if (onKeyChange) {
        const exported = await exportKey(key);
        onKeyChange(exported);
      }
    } catch (e) {
      logger.error(e);
      toast('生成密钥失败', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImport = async () => {
    if (!importInput.trim()) return;

    try {
      setIsImporting(true);
      const key = await importKey(importInput.trim());
      await storeKey(key);
      await checkKey();
      toast('同步密钥已导入', 'success');
      if (onKeyChange) {
        onKeyChange(importInput.trim());
      }
    } catch (e) {
      logger.error(e);
      toast('无效的密钥格式', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClear = async () => {
    if (
      !confirm(
        '确定要清除同步密钥吗？\n\n如果没有密钥，您将无法解密服务器上的同步数据。请确保您已经备份了密钥。'
      )
    ) {
      return;
    }

    try {
      await clearKey();
      await checkKey();
      setShowKey(false);
      if (onClear) onClear();
      toast('同步密钥已清除', 'info');
    } catch (e) {
      logger.error(e);
      toast('清除密钥失败', 'error');
    }
  };

  const handleGenerateNewKey = async () => {
    try {
      const key = await generateSyncKey();
      const exported = await exportKey(key);
      setNewKeyInput(exported);
    } catch (e) {
      logger.error(e);
      toast('生成新密钥失败', 'error');
    }
  };

  const handleMigration = async () => {
    if (!newKeyInput.trim()) return;

    try {
      setIsMigrating(true);

      const isValid = await verifyKey(newKeyInput.trim());
      if (!isValid) {
        toast('无效的密钥格式', 'error');
        return;
      }

      const key = await importKey(newKeyInput.trim());
      await storeKey(key);

      const engine = await getSyncEngine();
      if (engine) {
        if (migrationMode === 'authority') {
          // 权威数据源：重置同步状态并重新生成操作记录（保留本地数据，覆盖服务器数据）
          await engine.resetSyncState();
          await engine.regenerateOperations();
          // 触发后台推送
          engine.push().catch((e) => logger.error('[Migration] Push failed:', e));
        } else {
          // 普通成员：清空所有本地数据和同步状态（放弃本地数据，从服务器拉取）
          await engine.clearAllData();
          // 触发后台拉取
          engine.pull().catch((e) => logger.error('[Migration] Pull failed:', e));
        }
      }

      await checkKey();
      setIsChangeDialogOpen(false);
      setNewKeyInput('');
      setConfirmText('');
      setMigrationMode('member'); // Reset to default

      if (migrationMode === 'authority') {
        toast('密钥已更换。本地数据已重新加密，正在准备上传...', 'success');
      } else {
        toast('密钥已更换。本地数据已清除，正在从服务器拉取最新数据...', 'success');
      }

      if (onKeyChange) {
        onKeyChange(newKeyInput.trim());
      }
    } catch (e) {
      logger.error('Key migration failed:', e);
      toast('更换密钥失败', 'error');
    } finally {
      setIsMigrating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(keyString);
    toast('密钥已复制到剪贴板', 'success');
  };

  if (hasKey) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>同步密钥</span>
            <span className="text-xs font-normal text-success border border-success/20 bg-success/10 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Shield className="w-3 h-3" />
              已启用加密
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={isChangeDialogOpen} onOpenChange={setIsChangeDialogOpen}>
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
                        <ul className="list-disc list-inside space-y-1 opacity-90 text-[11px] leading-tight">
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
                      <div
                        className={`
                          border rounded-md p-3 cursor-pointer transition-all
                          ${
                            migrationMode === 'member'
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : 'border-input hover:border-primary/50 hover:bg-muted/50'
                          }
                        `}
                        onClick={() => setMigrationMode('member')}
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
                      </div>

                      <div
                        className={`
                          border rounded-md p-3 cursor-pointer transition-all
                          ${
                            migrationMode === 'authority'
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : 'border-input hover:border-primary/50 hover:bg-muted/50'
                          }
                        `}
                        onClick={() => setMigrationMode('authority')}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Server className="w-4 h-4 text-primary" />
                          <span className="font-medium text-sm">我是管理员</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          保留本地数据，重新加密并上传到云端。
                          <span className="block mt-1 text-primary font-semibold">
                            * 覆盖云端数据
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>新密钥</Label>
                    <div className="flex gap-2">
                      <Input
                        value={newKeyInput}
                        onChange={(e) => setNewKeyInput(e.target.value)}
                        placeholder="输入新密钥或生成随机密钥"
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        onClick={handleGenerateNewKey}
                        title="生成随机密钥"
                        className="shrink-0"
                      >
                        <Key className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-destructive font-medium">确认操作</Label>
                    <Input
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="请输入：确认更换密钥"
                      className="text-sm"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsChangeDialogOpen(false)}
                    disabled={isMigrating}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleMigration}
                    disabled={isMigrating || !newKeyInput || confirmText !== '确认更换密钥'}
                    variant={confirmText === '确认更换密钥' ? 'destructive' : 'default'}
                  >
                    {isMigrating ? '正在处理...' : '确认更换'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              清除密钥
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const url = browser.runtime.getURL('/debug.html');
                window.open(url, '_blank');
              }}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              title="调试同步数据"
            >
              <Bug className="w-3 h-3" />
            </Button>
          </div>
        </Label>

        <div className="relative">
          <Input
            readOnly
            value={keyString}
            type={showKey ? 'text' : 'password'}
            className="pr-20 font-mono text-sm bg-muted/50 text-muted-foreground"
          />
          <div className="absolute right-1 top-1 bottom-1 flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={copyToClipboard}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title="复制"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1 px-1">
          <p className="text-[10px] text-muted-foreground/80 flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-success" />
            数据在本地加密后传输，服务器无法解密
          </p>
          <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1.5">
            <Users className="w-3 h-3 text-primary" />
            若需共享数据，请确保团队成员使用相同密钥
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium flex items-center gap-2">
        同步密钥
        <span className="text-xs font-normal text-muted-foreground">(必填，用于加密数据)</span>
      </Label>

      <div className="relative">
        <Input
          value={importInput}
          onChange={(e) => setImportInput(e.target.value)}
          placeholder="在此输入密钥，或点击右侧生成..."
          className="font-mono text-sm pr-24"
        />
        <div className="absolute right-1 top-1 bottom-1 flex items-center">
          {importInput ? (
            <Button
              onClick={handleImport}
              disabled={isImporting}
              size="sm"
              className="h-7 px-3 text-xs bg-primary/10 text-primary hover:bg-primary/20 border-0"
            >
              导入
            </Button>
          ) : (
            <Button
              onClick={handleGenerate}
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
        <p className="text-[10px] text-muted-foreground/80">
          请妥善保管此密钥。丢失密钥将导致无法解密同步数据。
        </p>
        <p className="text-[10px] text-primary/80 flex items-center gap-1.5">
          <Users className="w-3 h-3" />
          团队协作提示：所有成员需配置完全一致的密钥才能共享数据
        </p>
      </div>
    </div>
  );
}
