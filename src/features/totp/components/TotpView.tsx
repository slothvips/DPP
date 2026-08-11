import { ClipboardPaste, Download, Eye, EyeOff, Lock, Search, Shield } from 'lucide-react';
import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';
import { useTotpAccounts } from '../hooks/useTotpAccounts';
import { useTotpTicker } from '../hooks/useTotpCode';
import { useTotpPinLock } from '../hooks/useTotpPinLock';
import type { TotpAccountFormData, TotpAccountItem } from '../types';
import { TotpAccountDialog } from './TotpAccountDialog';
import { TotpAccountListItem } from './TotpAccountListItem';
import { TotpExportDialog } from './TotpExportDialog';
import { TotpForgotPinDialog } from './TotpForgotPinDialog';
import { TotpLockScreen } from './TotpLockScreen';
import { TotpPersonalKeyNotice } from './TotpPersonalKeyNotice';
import { TotpPinSettingsDialog } from './TotpPinSettingsDialog';

interface TotpViewProps {
  /** 验证器标签是否处于前台（用于离开时自动锁屏） */
  isActive?: boolean;
}

function matchesSearch(account: TotpAccountItem, query: string): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const haystack = [account.label, account.issuer ?? '', account.account ?? '']
    .join(' ')
    .toLowerCase();

  return tokens.every((token) => haystack.includes(token));
}

export function TotpView({ isActive = true }: TotpViewProps) {
  const { accounts, addAccount, updateAccount, removeAccount, reorderAccounts } = useTotpAccounts();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isPinSettingsOpen, setIsPinSettingsOpen] = useState(false);
  const [isForgotPinOpen, setIsForgotPinOpen] = useState(false);
  const [showCodes, setShowCodes] = useState(false);
  const [editingAccount, setEditingAccount] = useState<TotpAccountItem | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [orderedAccounts, setOrderedAccounts] = useState<TotpAccountItem[]>([]);
  const orderedAccountsRef = useRef(orderedAccounts);
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();
  const pinLock = useTotpPinLock({ isActive });
  const nowMs = useTotpTicker(accounts.length > 0 && !pinLock.locked);
  const isSearching = search.trim().length > 0;

  const filteredAccounts = useMemo(
    () => accounts.filter((account) => matchesSearch(account, search)),
    [accounts, search]
  );

  orderedAccountsRef.current = orderedAccounts;

  useEffect(() => {
    if (draggedId) return;
    setOrderedAccounts(isSearching ? filteredAccounts : accounts);
  }, [accounts, filteredAccounts, isSearching, draggedId]);

  // 锁定时关闭敏感弹窗并隐藏验证码
  useEffect(() => {
    if (!pinLock.locked) return;
    setIsDialogOpen(false);
    setIsExportOpen(false);
    setIsPinSettingsOpen(false);
    setShowCodes(false);
    setEditingAccount(null);
  }, [pinLock.locked]);

  function handleImport() {
    setEditingAccount(null);
    setIsDialogOpen(true);
  }

  function handleExport() {
    if (accounts.length === 0) {
      toast('没有可导出的账户', 'info');
      return;
    }
    setIsExportOpen(true);
  }

  function handleEdit(account: TotpAccountItem) {
    setEditingAccount(account);
    setIsDialogOpen(true);
  }

  async function handleDelete(account: TotpAccountItem) {
    const confirmed = await confirm(`确定要删除「${account.label}」吗？`, '确认删除', 'danger');
    if (!confirmed) return;

    try {
      await removeAccount(account.id);
      toast('已删除', 'success');
    } catch (error) {
      logger.error('Failed to delete TOTP account:', error);
      toast('删除失败', 'error');
    }
  }

  async function handleSave(data: TotpAccountFormData) {
    try {
      if (editingAccount) {
        await updateAccount({
          id: editingAccount.id,
          label: data.label,
          issuer: data.issuer,
          account: data.account,
        });
        toast('已更新', 'success');
      } else {
        await addAccount({
          label: data.label,
          issuer: data.issuer || undefined,
          account: data.account || undefined,
          secret: data.secret,
          algorithm: data.algorithm,
          digits: data.digits,
          period: data.period,
        });
        toast('已导入', 'success');
      }
      setIsDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败';
      toast(message, 'error');
    }
  }

  async function handleImportMany(items: TotpAccountFormData[]) {
    try {
      for (const data of items) {
        await addAccount({
          label: data.label,
          issuer: data.issuer || undefined,
          account: data.account || undefined,
          secret: data.secret,
          algorithm: data.algorithm,
          digits: data.digits,
          period: data.period,
        });
      }
      toast(`已导入 ${items.length} 个账户`, 'success');
      setIsDialogOpen(false);
    } catch (error) {
      logger.error('Failed to import TOTP accounts:', error);
      const message = error instanceof Error ? error.message : '批量导入失败';
      toast(message, 'error');
    }
  }

  function handleDragStart(accountId: string) {
    setDraggedId(accountId);
  }

  function handleDragOver(_event: DragEvent, targetId: string) {
    if (!draggedId || draggedId === targetId || isSearching) return;

    setOrderedAccounts((prev) => {
      const next = [...prev];
      const from = next.findIndex((item) => item.id === draggedId);
      const to = next.findIndex((item) => item.id === targetId);
      if (from === -1 || to === -1 || from === to) return prev;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  async function handleDragEnd() {
    const nextOrder = orderedAccountsRef.current;
    setDraggedId(null);

    if (isSearching) return;

    try {
      await reorderAccounts({ orderedIds: nextOrder.map((item) => item.id) });
    } catch (error) {
      logger.error('Failed to reorder TOTP accounts:', error);
      toast('排序保存失败', 'error');
      setOrderedAccounts(accounts);
    }
  }

  const visibleAccounts = draggedId ? orderedAccounts : isSearching ? filteredAccounts : accounts;

  if (pinLock.locked) {
    return (
      <div className="flex h-full min-h-0 flex-col" data-testid="totp-view">
        <TotpLockScreen
          unlocking={pinLock.unlocking}
          error={pinLock.unlockError}
          onUnlock={pinLock.unlock}
          onForgotPin={() => setIsForgotPinOpen(true)}
          onClearError={pinLock.clearUnlockError}
        />
        <TotpForgotPinDialog
          open={isForgotPinOpen}
          onOpenChange={setIsForgotPinOpen}
          onReset={() => {
            pinLock.markUnlocked();
            toast('已重置 PIN 锁定，请尽快重新设置', 'success');
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="totp-view">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-border/55 bg-background/70 px-2 py-1.5 dark:bg-background/50">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索..."
            className="h-8 rounded-lg border-border/60 bg-background/88 pl-7 text-xs"
            data-testid="totp-search-input"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setIsPinSettingsOpen(true)}
          title={pinLock.pinEnabled ? '管理 PIN' : '设置 PIN'}
          data-testid="totp-pin-settings-button"
        >
          <Lock className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setShowCodes((value) => !value)}
          title={showCodes ? '隐藏验证码' : '显示验证码'}
          data-testid="totp-toggle-codes-button"
        >
          {showCodes ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1 rounded-lg px-2.5 text-xs"
          onClick={handleExport}
          disabled={accounts.length === 0}
          data-testid="totp-export-button"
        >
          <Download className="h-3.5 w-3.5" />
          导出
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0 gap-1 rounded-lg px-2.5 text-xs"
          onClick={handleImport}
          data-testid="totp-add-button"
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
          导入
        </Button>
      </div>

      <TotpPersonalKeyNotice />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {accounts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <Shield className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">还没有验证器账户</p>
            <p className="text-xs text-muted-foreground">粘贴 otpauth:// 或密钥即可导入</p>
            <div className="mt-1">
              <Button type="button" size="sm" className="h-8 rounded-lg" onClick={handleImport}>
                <ClipboardPaste className="mr-1 h-3.5 w-3.5" />
                导入
              </Button>
            </div>
          </div>
        ) : visibleAccounts.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
            没有匹配「{search}」的账户
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 p-2.5">
            {visibleAccounts.map((account) => (
              <TotpAccountListItem
                key={account.id}
                account={account}
                nowMs={nowMs}
                showCode={showCodes}
                isDragging={draggedId === account.id}
                dragEnabled={!isSearching}
                onEdit={handleEdit}
                onDelete={(item) => void handleDelete(item)}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={() => void handleDragEnd()}
              />
            ))}
          </div>
        )}
      </div>

      <TotpAccountDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        initialData={editingAccount}
        onSave={handleSave}
        onImportMany={handleImportMany}
      />
      <TotpExportDialog open={isExportOpen} accounts={accounts} onOpenChange={setIsExportOpen} />
      <TotpPinSettingsDialog
        open={isPinSettingsOpen}
        pinEnabled={pinLock.pinEnabled}
        autoLockMinutes={pinLock.autoLockMinutes}
        onOpenChange={setIsPinSettingsOpen}
        onPinChanged={() => {
          // 刚设置/更新 PIN 后保持当前会话解锁，避免立刻再锁
          pinLock.markUnlocked();
        }}
        onLockNow={pinLock.pinEnabled ? pinLock.lock : undefined}
      />
    </div>
  );
}
