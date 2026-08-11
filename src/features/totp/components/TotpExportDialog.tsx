import { Check, Copy, Download, Loader2, Shield } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

export function TotpExportDialog({ open, accounts, onOpenChange }: TotpExportDialogProps) {
  const exportText = useMemo(() => exportTotpAccountsAsText(accounts), [accounts]);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      setBusy(false);
    }
  }, [open]);

  async function handleCopy() {
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
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(`dpp-totp-export-${stamp}.txt`, exportText);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="border-border/60 bg-background/96 sm:max-w-[420px]"
        data-testid="totp-export-dialog"
      >
        <DialogHeader>
          <DialogTitle>导出账户</DialogTitle>
          <DialogDescription>
            导出为 otpauth:// 文本，供另一台设备「导入」粘贴。默认不展示明文，请直接复制或下载。
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-border/55 bg-muted/30 px-4 py-5 dark:bg-muted/25">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/15">
              <Shield className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-foreground">
                已准备 {accounts.length} 个账户的导出内容
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                含全部密钥，不会在界面显示明文。复制后请尽快粘贴到目标设备，并清理剪贴板。
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={handleDownload}
            data-testid="totp-export-download-button"
          >
            <Download className="mr-1.5 h-4 w-4" />
            下载 .txt
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            disabled={busy || accounts.length === 0}
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
            {copied ? '已复制' : '复制全部'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
