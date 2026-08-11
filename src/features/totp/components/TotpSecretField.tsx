import { Check, Copy, PencilLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/utils/cn';
import { logger } from '@/utils/logger';
import { VALIDATION_LIMITS } from '@/utils/validation';

interface TotpSecretFieldProps {
  secret: string;
  error?: string | null;
  /** 已导入后锁定：仅可复制，不可修改 */
  locked?: boolean;
  onSecretChange: (value: string) => void;
}

export function TotpSecretField({
  secret,
  error,
  locked = false,
  onSecretChange,
}: TotpSecretFieldProps) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(!locked && !secret);
  const [hadSecret, setHadSecret] = useState(Boolean(secret));

  useEffect(() => {
    if (locked) {
      setEditing(false);
      return;
    }
    // 粘贴导入填入密钥后，自动回到隐藏 + 点击复制
    if (secret && !hadSecret) {
      setEditing(false);
    }
    setHadSecret(Boolean(secret));
  }, [secret, hadSecret, locked]);

  async function handleCopy() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      logger.warn('Clipboard API not available');
    }
  }

  if (locked || !editing) {
    return (
      <div className="grid gap-1.5">
        <Label>密钥</Label>
        <button
          type="button"
          onClick={() => void handleCopy()}
          disabled={!secret}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background/90 px-3 text-left text-sm transition-colors',
            'hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50'
          )}
          title="点击复制密钥"
          data-testid="totp-copy-secret-button"
        >
          <span className="font-mono text-xs tracking-widest text-muted-foreground">
            {secret ? '••••••••••••••••' : '尚未填写密钥'}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-success" />
                <span className="text-success">已复制</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>复制</span>
              </>
            )}
          </span>
        </button>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {locked ? '密钥导入后不可修改，点击上方可复制' : '默认隐藏明文，点击上方即可复制'}
          </p>
          {!locked ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
              onClick={() => setEditing(true)}
              data-testid="totp-edit-secret-button"
            >
              <PencilLine className="mr-1 h-3 w-3" />
              {secret ? '更换' : '填写'}
            </Button>
          ) : null}
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor="totp-secret">密钥</Label>
        {secret ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => setEditing(false)}
          >
            完成
          </Button>
        ) : null}
      </div>
      <Input
        id="totp-secret"
        data-testid="totp-input-secret"
        type="password"
        value={secret}
        onChange={(e) => onSecretChange(e.target.value)}
        placeholder="Base32 密钥"
        maxLength={VALIDATION_LIMITS.TOTP_SECRET_MAX}
        autoComplete="off"
        spellCheck={false}
        className={cn('rounded-xl font-mono text-xs', error && 'border-destructive')}
        required
      />
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">输入时以掩码显示；导入保存后不可再修改</p>
      )}
    </div>
  );
}
