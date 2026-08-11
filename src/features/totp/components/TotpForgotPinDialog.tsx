import { Loader2 } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
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
import { hasPersonalKey, verifyPersonalKeyInput } from '@/lib/crypto/personalKey';
import { clearAllLocalTotpAccounts } from '@/lib/db/totp';
import { logger } from '@/utils/logger';
import { clearTotpPin } from '../totpPin';

const WIPE_CONFIRM_TEXT = '删除全部账户';

interface TotpForgotPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReset: () => void;
}

export function TotpForgotPinDialog({ open, onOpenChange, onReset }: TotpForgotPinDialogProps) {
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [personalKeyConfigured, setPersonalKeyConfigured] = useState(false);
  const [personalKeyInput, setPersonalKeyInput] = useState('');
  const [wipeConfirm, setWipeConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setPersonalKeyInput('');
    setWipeConfirm('');
    setBusy(false);
    setError(null);
    setLoadingConfig(true);

    void hasPersonalKey()
      .then((configured) => {
        setPersonalKeyConfigured(configured);
      })
      .catch((err) => {
        logger.error('Failed to check personal key for PIN reset', err);
        setPersonalKeyConfigured(false);
      })
      .finally(() => {
        setLoadingConfig(false);
      });
  }, [open]);

  async function handleResetWithPersonalKey(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const ok = await verifyPersonalKeyInput(personalKeyInput);
      if (!ok) {
        setError('个人私钥不正确');
        return;
      }
      await clearTotpPin();
      onReset();
      onOpenChange(false);
    } catch (err) {
      logger.error('Failed to reset TOTP PIN with personal key', err);
      setError('重置失败，请重试');
    } finally {
      setBusy(false);
    }
  }

  async function handleResetByWipe(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (wipeConfirm.trim() !== WIPE_CONFIRM_TEXT) {
      setError(`请输入「${WIPE_CONFIRM_TEXT}」以确认`);
      return;
    }

    setBusy(true);
    try {
      await clearAllLocalTotpAccounts();
      await clearTotpPin();
      onReset();
      onOpenChange(false);
    } catch (err) {
      logger.error('Failed to reset TOTP PIN by wiping accounts', err);
      setError('重置失败，请重试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[86vh] flex-col gap-4 overflow-hidden border-border/60 bg-background/96 sm:max-w-[440px]"
        data-testid="totp-forgot-pin-dialog"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>忘记 PIN</DialogTitle>
          <DialogDescription>
            PIN 无法找回。为避免他人随意解锁，重置必须通过额外验证，而不是直接清除锁定。
          </DialogDescription>
        </DialogHeader>

        {loadingConfig ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : personalKeyConfigured ? (
          <form
            onSubmit={(event) => void handleResetWithPersonalKey(event)}
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-1">
              <div className="rounded-xl border border-warning/25 bg-warning/8 px-3 py-2.5 dark:border-warning/35 dark:bg-warning/12">
                <p className="text-xs leading-5 text-warning">
                  已配置个人私钥。请输入个人私钥以清除 PIN
                  锁定；验证器账户将保留。不知道私钥则无法重置。
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="totp-forgot-personal-key">个人私钥</Label>
                <Input
                  id="totp-forgot-personal-key"
                  data-testid="totp-forgot-personal-key-input"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={personalKeyInput}
                  onChange={(event) => {
                    setError(null);
                    setPersonalKeyInput(event.target.value);
                  }}
                  placeholder="粘贴个人私钥"
                  className="rounded-xl font-mono text-xs"
                  autoFocus
                  disabled={busy}
                />
              </div>
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
            </div>
            <DialogFooter className="shrink-0 gap-2 border-t border-border/50 pt-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="rounded-xl"
                disabled={busy || !personalKeyInput.trim()}
                data-testid="totp-forgot-pin-confirm"
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                验证并清除 PIN
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form
            onSubmit={(event) => void handleResetByWipe(event)}
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-1">
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                <p className="text-xs leading-5 text-destructive">
                  未配置个人私钥时，遗忘 PIN
                  只能通过删除本机全部验证器账户来重置。此操作不可恢复，请确认你已有备份。
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="totp-forgot-wipe-confirm">输入「{WIPE_CONFIRM_TEXT}」以确认</Label>
                <Input
                  id="totp-forgot-wipe-confirm"
                  data-testid="totp-forgot-wipe-confirm-input"
                  value={wipeConfirm}
                  onChange={(event) => {
                    setError(null);
                    setWipeConfirm(event.target.value);
                  }}
                  placeholder={WIPE_CONFIRM_TEXT}
                  className="rounded-xl"
                  autoFocus
                  disabled={busy}
                />
              </div>
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
            </div>
            <DialogFooter className="shrink-0 gap-2 border-t border-border/50 pt-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="rounded-xl"
                disabled={busy || wipeConfirm.trim() !== WIPE_CONFIRM_TEXT}
                data-testid="totp-forgot-pin-confirm"
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                删除账户并清除 PIN
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
