import { AlertTriangle, Check, Copy, Download, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { logger } from '@/utils/logger';
import { exportTotpAccountsAsText } from '../totpCrypto';
import type { TotpAccountItem } from '../types';

interface TotpExportDialogProps {
  open: boolean;
  accounts: TotpAccountItem[];
  onOpenChange: (open: boolean) => void;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function accountDetail(account: TotpAccountItem): string {
  return [account.issuer, account.account].filter(Boolean).join(' · ');
}

export function TotpExportDialog({ open, accounts, onOpenChange }: TotpExportDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      setBusy(false);
      return;
    }
    setSelectedIds(accounts.map((account) => account.id));
  }, [open, accounts]);

  const selectedAccounts = useMemo(
    () => accounts.filter((account) => selectedIds.includes(account.id)),
    [accounts, selectedIds]
  );
  const exportText = useMemo(() => exportTotpAccountsAsText(selectedAccounts), [selectedAccounts]);
  const allSelected = accounts.length > 0 && selectedIds.length === accounts.length;
  const noneSelected = selectedIds.length === 0;

  function toggleAccount(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      }
      return prev.filter((item) => item !== id);
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? accounts.map((account) => account.id) : []);
  }

  async function handleCopy() {
    if (noneSelected) return;
    setBusy(true);
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      logger.warn('Clipboard API not available', error);
    } finally {
      setBusy(false);
    }
  }

  function handleDownload() {
    if (noneSelected) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(`dpp-totp-export-${stamp}.txt`, exportText);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[86vh] flex-col gap-4 overflow-hidden border-border/60 bg-background/96 sm:max-w-[440px]"
        data-testid="totp-export-dialog"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>导出账户</DialogTitle>
          <DialogDescription>
            勾选要导出的账户，导出为 otpauth:// 文本供另一台设备「导入」。默认不展示明文。
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="totp-export-select-all"
                  checked={allSelected ? true : noneSelected ? false : 'indeterminate'}
                  onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                  data-testid="totp-export-select-all"
                />
                <Label
                  htmlFor="totp-export-select-all"
                  className="cursor-pointer text-sm font-medium"
                >
                  全选
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                已选 {selectedIds.length} / {accounts.length}
              </p>
            </div>

            <div
              className="max-h-[min(50vh,280px)] space-y-1 overflow-y-auto rounded-xl border border-border/55 bg-muted/20 p-2 dark:bg-muted/15"
              data-testid="totp-export-account-list"
            >
              {accounts.map((account) => {
                const detail = accountDetail(account);
                const checkboxId = `totp-export-${account.id}`;
                return (
                  <div
                    key={account.id}
                    className="flex min-w-0 items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/40"
                  >
                    <Checkbox
                      id={checkboxId}
                      className="mt-0.5 shrink-0"
                      checked={selectedIds.includes(account.id)}
                      onCheckedChange={(checked) => toggleAccount(account.id, checked === true)}
                      data-testid={`totp-export-check-${account.id}`}
                    />
                    <Label
                      htmlFor={checkboxId}
                      className="min-w-0 flex-1 cursor-pointer space-y-0.5"
                    >
                      <span className="block truncate text-sm font-medium text-foreground">
                        {account.label}
                      </span>
                      {detail ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {detail}
                        </span>
                      ) : null}
                    </Label>
                  </div>
                );
              })}
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning/8 px-3 py-2.5 dark:border-warning/35 dark:bg-warning/12">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              <p className="text-xs leading-5 text-warning">
                含所选账户密钥，不会在界面显示明文。完成迁移后，请务必尽快删除一切明文备份文件，并清理剪贴板，防止泄露。
              </p>
            </div>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border/50 pt-3 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={noneSelected}
              onClick={handleDownload}
              data-testid="totp-export-download-button"
            >
              <Download className="mr-1.5 h-4 w-4" />
              下载 .txt
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              disabled={busy || noneSelected}
              onClick={() => void handleCopy()}
              data-testid="totp-export-copy-button"
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : copied ? (
                <Check className="mr-1.5 h-4 w-4" />
              ) : (
                <Copy className="mr-1.5 h-4 w-4" />
              )}
              {copied ? '已复制' : allSelected ? '复制全部' : '复制所选'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
