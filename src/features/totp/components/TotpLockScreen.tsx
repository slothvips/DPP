import { Loader2, Lock } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { normalizeTotpPin } from '../totpPin';

interface TotpLockScreenProps {
  unlocking: boolean;
  error: string | null;
  onUnlock: (pin: string) => Promise<boolean>;
  onForgotPin: () => void;
  onClearError: () => void;
}

export function TotpLockScreen({
  unlocking,
  error,
  onUnlock,
  onForgotPin,
  onClearError,
}: TotpLockScreenProps) {
  const [pin, setPin] = useState('');

  useEffect(() => {
    setPin('');
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const ok = await onUnlock(pin);
    if (ok) {
      setPin('');
    }
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col items-center justify-center px-6"
      data-testid="totp-lock-screen"
    >
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="w-full max-w-xs space-y-4 rounded-2xl border border-border/55 bg-background/90 p-5 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <h2 className="text-sm font-semibold text-foreground">验证器已锁定</h2>
            <p className="text-xs leading-5 text-muted-foreground">
              输入 PIN 后才能查看验证码、导入或导出账户。PIN 无法找回。
            </p>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="totp-unlock-pin">PIN</Label>
          <Input
            id="totp-unlock-pin"
            data-testid="totp-unlock-pin-input"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={pin}
            onChange={(event) => {
              onClearError();
              setPin(normalizeTotpPin(event.target.value));
            }}
            placeholder="输入 PIN"
            className="rounded-xl tracking-[0.35em]"
            autoFocus
            disabled={unlocking}
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <Button
          type="submit"
          className="w-full rounded-xl"
          disabled={unlocking || pin.length < 4}
          data-testid="totp-unlock-submit"
        >
          {unlocking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          解锁
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="h-8 w-full rounded-xl text-xs text-muted-foreground"
          disabled={unlocking}
          onClick={onForgotPin}
          data-testid="totp-forgot-pin-button"
        >
          忘记 PIN？
        </Button>
      </form>
    </div>
  );
}
