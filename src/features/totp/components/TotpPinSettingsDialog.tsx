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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { logger } from '@/utils/logger';
import {
  DEFAULT_TOTP_PIN_AUTO_LOCK_MINUTES,
  TOTP_PIN_AUTO_LOCK_OPTIONS,
  TOTP_PIN_MAX_LENGTH,
  TOTP_PIN_MIN_LENGTH,
  clearTotpPin,
  isValidTotpPin,
  normalizeTotpPin,
  setTotpPin,
  updateTotpPinAutoLockMinutes,
  verifyTotpPin,
} from '../totpPin';

interface TotpPinSettingsDialogProps {
  open: boolean;
  pinEnabled: boolean;
  autoLockMinutes: number;
  onOpenChange: (open: boolean) => void;
  onPinChanged: () => void;
  onLockNow?: () => void;
}

export function TotpPinSettingsDialog({
  open,
  pinEnabled,
  autoLockMinutes,
  onOpenChange,
  onPinChanged,
  onLockNow,
}: TotpPinSettingsDialogProps) {
  const { toast } = useToast();
  const [currentPin, setCurrentPin] = useState('');
  const [nextPin, setNextPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [lockMinutes, setLockMinutes] = useState(String(DEFAULT_TOTP_PIN_AUTO_LOCK_MINUTES));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCurrentPin('');
    setNextPin('');
    setConfirmPin('');
    setLockMinutes(String(autoLockMinutes));
    setBusy(false);
    setError(null);
  }, [open, autoLockMinutes]);

  async function handleSavePin() {
    setError(null);

    const normalizedNext = normalizeTotpPin(nextPin);
    const normalizedConfirm = normalizeTotpPin(confirmPin);
    const minutes = Number(lockMinutes);

    if (pinEnabled) {
      const ok = await verifyTotpPin(currentPin);
      if (!ok) {
        setError('当前 PIN 不正确');
        return;
      }
    }

    if (!isValidTotpPin(normalizedNext)) {
      setError(`新 PIN 需为 ${TOTP_PIN_MIN_LENGTH}–${TOTP_PIN_MAX_LENGTH} 位数字`);
      return;
    }
    if (normalizedNext !== normalizedConfirm) {
      setError('两次输入的新 PIN 不一致');
      return;
    }

    setBusy(true);
    try {
      await setTotpPin(
        normalizedNext,
        Number.isFinite(minutes) ? minutes : DEFAULT_TOTP_PIN_AUTO_LOCK_MINUTES
      );
      toast(pinEnabled ? 'PIN 已更新' : 'PIN 已设置', 'success');
      onPinChanged();
      onOpenChange(false);
    } catch (err) {
      logger.error('Failed to set TOTP PIN', err);
      setError(err instanceof Error ? err.message : '设置失败');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveLockOnly() {
    if (!pinEnabled) return;
    setError(null);
    setBusy(true);
    try {
      const ok = await verifyTotpPin(currentPin);
      if (!ok) {
        setError('当前 PIN 不正确');
        return;
      }
      await updateTotpPinAutoLockMinutes(Number(lockMinutes) || 0);
      toast('锁定时间已更新', 'success');
      onPinChanged();
      onOpenChange(false);
    } catch (err) {
      logger.error('Failed to update TOTP PIN auto-lock', err);
      setError('更新失败');
    } finally {
      setBusy(false);
    }
  }

  const changingPin = nextPin.length > 0 || confirmPin.length > 0 || !pinEnabled;

  /** Enter 提交时：未改 PIN 则只保存锁定时间，避免误走更新 PIN 校验 */
  async function handleFormSubmit(event: FormEvent) {
    event.preventDefault();
    if (pinEnabled && !changingPin) {
      await handleSaveLockOnly();
      return;
    }
    await handleSavePin();
  }

  async function handleRemove() {
    setError(null);
    setBusy(true);
    try {
      const ok = await verifyTotpPin(currentPin);
      if (!ok) {
        setError('当前 PIN 不正确');
        return;
      }
      await clearTotpPin();
      toast('已关闭 PIN 锁定', 'success');
      onPinChanged();
      onOpenChange(false);
    } catch (err) {
      logger.error('Failed to clear TOTP PIN', err);
      setError('关闭失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[86vh] flex-col gap-4 overflow-hidden border-border/60 bg-background/96 sm:max-w-[420px]"
        data-testid="totp-pin-settings-dialog"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{pinEnabled ? '管理 PIN' : '设置 PIN'}</DialogTitle>
          <DialogDescription>
            PIN
            仅用于本机锁定验证器界面，无法找回。离开验证器、隐藏侧边栏，或空闲超时后将自动锁屏。建议同时配置个人私钥，以便遗忘
            PIN 时可用私钥重置。
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => void handleFormSubmit(event)}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-1">
            {pinEnabled ? (
              <div className="grid gap-1.5">
                <Label htmlFor="totp-pin-current">当前 PIN</Label>
                <Input
                  id="totp-pin-current"
                  data-testid="totp-pin-current-input"
                  type="password"
                  inputMode="numeric"
                  value={currentPin}
                  onChange={(event) => setCurrentPin(normalizeTotpPin(event.target.value))}
                  className="rounded-xl tracking-[0.35em]"
                  autoFocus
                />
              </div>
            ) : null}

            <div className="grid gap-1.5">
              <Label htmlFor="totp-pin-next">{pinEnabled ? '新 PIN（可选）' : 'PIN'}</Label>
              <Input
                id="totp-pin-next"
                data-testid="totp-pin-next-input"
                type="password"
                inputMode="numeric"
                value={nextPin}
                onChange={(event) => setNextPin(normalizeTotpPin(event.target.value))}
                placeholder={`${TOTP_PIN_MIN_LENGTH}–${TOTP_PIN_MAX_LENGTH} 位数字`}
                className="rounded-xl tracking-[0.35em]"
                autoFocus={!pinEnabled}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="totp-pin-confirm">确认 PIN</Label>
              <Input
                id="totp-pin-confirm"
                data-testid="totp-pin-confirm-input"
                type="password"
                inputMode="numeric"
                value={confirmPin}
                onChange={(event) => setConfirmPin(normalizeTotpPin(event.target.value))}
                className="rounded-xl tracking-[0.35em]"
              />
            </div>

            <div className="grid gap-1.5">
              <Label>自动锁定</Label>
              <Select value={lockMinutes} onValueChange={setLockMinutes}>
                <SelectTrigger className="rounded-xl" data-testid="totp-pin-autolock-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TOTP_PIN_AUTO_LOCK_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs leading-5 text-muted-foreground">
                离开验证器或隐藏侧边栏时始终锁定；空闲选项为额外超时。
              </p>
            </div>

            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>

          <DialogFooter className="shrink-0 flex-col gap-2 border-t border-border/50 pt-3 sm:flex-col">
            <div className="flex w-full flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              {pinEnabled && !changingPin ? (
                <Button
                  type="submit"
                  className="rounded-xl"
                  disabled={busy || currentPin.length < TOTP_PIN_MIN_LENGTH}
                  data-testid="totp-pin-save-lock-button"
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  保存锁定时间
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="rounded-xl"
                  disabled={busy}
                  data-testid="totp-pin-save-button"
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {pinEnabled ? '更新 PIN' : '启用 PIN'}
                </Button>
              )}
            </div>
            {pinEnabled ? (
              <div className="flex w-full flex-col gap-1">
                {onLockNow ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    disabled={busy}
                    onClick={() => {
                      onOpenChange(false);
                      onLockNow();
                    }}
                    data-testid="totp-pin-lock-now-button"
                  >
                    立即锁定
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={busy || currentPin.length < TOTP_PIN_MIN_LENGTH}
                  onClick={() => void handleRemove()}
                  data-testid="totp-pin-remove-button"
                >
                  关闭 PIN 锁定
                </Button>
              </div>
            ) : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
