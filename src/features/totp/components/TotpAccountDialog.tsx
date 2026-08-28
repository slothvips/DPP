import { CheckCircle2, ChevronDown, ClipboardPaste, Loader2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/utils/cn';
import { VALIDATION_LIMITS } from '@/utils/validation';
import {
  DEFAULT_TOTP_PERIOD,
  TOTP_ALGORITHMS,
  TOTP_DIGITS_OPTIONS,
  isValidTotpSecret,
  parseTotpImportText,
} from '../totpCrypto';
import type { TotpAccountFormData, TotpAccountItem, TotpAlgorithm, TotpDigits } from '../types';
import { TotpQrScanPanel } from './TotpQrScanPanel';
import { TotpSecretField } from './TotpSecretField';

interface TotpAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: TotpAccountItem | null;
  onSave: (data: TotpAccountFormData) => Promise<void>;
  onImportMany?: (accounts: TotpAccountFormData[]) => Promise<void>;
}

const EMPTY_FORM: TotpAccountFormData = {
  label: '',
  issuer: '',
  account: '',
  secret: '',
  algorithm: 'SHA1',
  digits: 6,
  period: DEFAULT_TOTP_PERIOD,
};

export function TotpAccountDialog({
  isOpen,
  onClose,
  initialData,
  onSave,
  onImportMany,
}: TotpAccountDialogProps) {
  const isEdit = !!initialData;
  const [pasteText, setPasteText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedAccounts, setParsedAccounts] = useState<TotpAccountFormData[]>([]);
  const [formData, setFormData] = useState<TotpAccountFormData>(EMPTY_FORM);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [secretError, setSecretError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setFormData({
        label: initialData.label,
        issuer: initialData.issuer ?? '',
        account: initialData.account ?? '',
        secret: '',
        algorithm: initialData.algorithm,
        digits: initialData.digits,
        period: initialData.period,
      });
      setPasteText('');
      setParsedAccounts([]);
      setShowDetails(true);
    } else {
      setFormData(EMPTY_FORM);
      setPasteText('');
      setParsedAccounts([]);
      setShowDetails(false);
    }
    setParseError(null);
    setSecretError(null);
    setLoading(false);
  }, [isOpen, initialData]);

  function updateField<K extends keyof TotpAccountFormData>(key: K, value: TotpAccountFormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function applyParseResult(text: string) {
    if (!text.trim()) {
      setParseError(null);
      setParsedAccounts([]);
      return;
    }

    const result = parseTotpImportText(text);
    if (!result.ok) {
      setParseError(result.error);
      setParsedAccounts([]);
      return;
    }

    setParseError(null);
    setParsedAccounts(result.accounts);
    setFormData(result.accounts[0]);
    setSecretError(null);
    // 纯密钥通常需要改名，自动展开详情
    if (result.source === 'secret' || result.accounts.length === 1) {
      setShowDetails(true);
    }
  }

  function handlePasteChange(value: string) {
    setPasteText(value);
    applyParseResult(value);
  }

  function handleSecretChange(value: string) {
    updateField('secret', value);
    if (!value.trim()) {
      setSecretError(null);
      return;
    }
    setSecretError(isValidTotpSecret(value) ? null : '请输入有效的 Base32 密钥（A–Z / 2–7）');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!isEdit && parsedAccounts.length > 1 && onImportMany) {
      setLoading(true);
      try {
        await onImportMany(parsedAccounts);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!formData.label.trim()) {
      setShowDetails(true);
      return;
    }
    if (!isEdit && !isValidTotpSecret(formData.secret)) {
      setSecretError('请输入有效的 Base32 密钥（A–Z / 2–7）');
      setShowDetails(true);
      return;
    }

    setLoading(true);
    try {
      await onSave({
        ...formData,
        label: formData.label.trim(),
        issuer: formData.issuer.trim(),
        account: formData.account.trim(),
      });
    } finally {
      setLoading(false);
    }
  }

  const isBatch = !isEdit && parsedAccounts.length > 1;
  const hasParsed = parsedAccounts.length > 0;
  const canSubmit = isBatch
    ? !loading && !parseError && parsedAccounts.length > 1
    : isEdit
      ? !loading && !!formData.label.trim()
      : !loading &&
        !parseError &&
        !secretError &&
        !!formData.label.trim() &&
        isValidTotpSecret(formData.secret);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[86vh] flex-col gap-4 overflow-hidden border-border/60 bg-background/96 sm:max-w-[460px]">
        <DialogHeader className="shrink-0">
          <DialogTitle>{isEdit ? '编辑账户' : '导入账户'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? '仅可修改名称、发行方与账号。密钥及算法参数导入后不可更改。'
              : '扫描网页二维码，或粘贴 otpauth:// 链接 / 密钥，识别后即可导入。'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-1">
            {!isEdit && (
              <div className="grid gap-3">
                <TotpQrScanPanel onDetected={handlePasteChange} />

                <div className="grid gap-2">
                  <Label htmlFor="totp-paste" className="flex items-center gap-1.5">
                    <ClipboardPaste className="h-3.5 w-3.5 text-muted-foreground" />
                    粘贴导入
                  </Label>
                  <Textarea
                    id="totp-paste"
                    data-testid="totp-paste-input"
                    value={pasteText}
                    onChange={(e) => handlePasteChange(e.target.value)}
                    placeholder={'otpauth://totp/…\n或 Base32 密钥'}
                    className={cn(
                      'min-h-[120px] max-h-[40vh] resize-y rounded-xl font-mono text-xs leading-5',
                      parseError && 'border-destructive focus-visible:ring-destructive'
                    )}
                    autoFocus
                    spellCheck={false}
                  />
                  {parseError ? (
                    <p className="text-xs text-destructive">{parseError}</p>
                  ) : hasParsed ? (
                    <div className="flex items-center gap-1.5 text-xs text-primary">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {isBatch
                          ? `已识别 ${parsedAccounts.length} 个账户`
                          : `已识别「${formData.label}」`}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      支持扫码、单条或批量 URI；也可只贴密钥后改名称
                    </p>
                  )}
                </div>
              </div>
            )}

            {isBatch && (
              <div className="rounded-2xl border border-border/55 bg-muted/30 p-3 dark:bg-muted/25">
                <p className="text-xs font-medium text-foreground">将导入这些账户</p>
                <ul className="mt-2 max-h-32 space-y-1.5 overflow-y-auto">
                  {parsedAccounts.map((account, index) => (
                    <li
                      key={`${account.secret}-${index}`}
                      className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/90 px-2.5 py-1.5 text-xs"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-semibold text-primary">
                        {account.label.slice(0, 1).toUpperCase() || '?'}
                      </span>
                      <span className="min-w-0 truncate text-foreground">
                        {account.label}
                        {account.account ? (
                          <span className="text-muted-foreground"> · {account.account}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(isEdit || (!isBatch && (showDetails || hasParsed))) && (
              <div className="grid gap-3">
                {!isEdit && (
                  <button
                    type="button"
                    className="flex items-center justify-between rounded-xl border border-border/55 bg-muted/25 px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted/40"
                    onClick={() => setShowDetails((open) => !open)}
                    data-testid="totp-toggle-details"
                  >
                    <span>账户详情</span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform',
                        showDetails && 'rotate-180'
                      )}
                    />
                  </button>
                )}

                {(isEdit || showDetails) && (
                  <div className="grid gap-3 rounded-2xl border border-border/55 bg-background/88 p-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="totp-label">名称</Label>
                      <Input
                        id="totp-label"
                        data-testid="totp-input-label"
                        value={formData.label}
                        onChange={(e) => updateField('label', e.target.value)}
                        placeholder="例如 GitHub"
                        maxLength={VALIDATION_LIMITS.TOTP_LABEL_MAX}
                        required
                        className="rounded-xl"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5">
                        <Label htmlFor="totp-issuer">发行方</Label>
                        <Input
                          id="totp-issuer"
                          data-testid="totp-input-issuer"
                          value={formData.issuer}
                          onChange={(e) => updateField('issuer', e.target.value)}
                          placeholder="可选"
                          maxLength={VALIDATION_LIMITS.TOTP_ISSUER_MAX}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="totp-account">账号</Label>
                        <Input
                          id="totp-account"
                          data-testid="totp-input-account"
                          value={formData.account}
                          onChange={(e) => updateField('account', e.target.value)}
                          placeholder="可选"
                          maxLength={VALIDATION_LIMITS.TOTP_ACCOUNT_MAX}
                          className="rounded-xl"
                        />
                      </div>
                    </div>
                    {!isEdit && (
                      <TotpSecretField
                        secret={formData.secret}
                        error={secretError}
                        onSecretChange={handleSecretChange}
                      />
                    )}
                    {!isEdit && (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="grid gap-1.5">
                          <Label className="text-xs">算法</Label>
                          <Select
                            value={formData.algorithm}
                            onValueChange={(value) =>
                              updateField('algorithm', value as TotpAlgorithm)
                            }
                          >
                            <SelectTrigger
                              className="h-9 rounded-xl text-xs"
                              data-testid="totp-select-algorithm"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TOTP_ALGORITHMS.map((algo) => (
                                <SelectItem key={algo} value={algo}>
                                  {algo}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs">位数</Label>
                          <Select
                            value={String(formData.digits)}
                            onValueChange={(value) =>
                              updateField('digits', Number(value) as TotpDigits)
                            }
                          >
                            <SelectTrigger
                              className="h-9 rounded-xl text-xs"
                              data-testid="totp-select-digits"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TOTP_DIGITS_OPTIONS.map((digits) => (
                                <SelectItem key={digits} value={String(digits)}>
                                  {digits}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor="totp-period" className="text-xs">
                            周期
                          </Label>
                          <Input
                            id="totp-period"
                            data-testid="totp-input-period"
                            type="number"
                            min={10}
                            max={120}
                            value={formData.period}
                            onChange={(e) =>
                              updateField('period', Number(e.target.value) || DEFAULT_TOTP_PERIOD)
                            }
                            className="h-9 rounded-xl text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!isEdit && !hasParsed && !showDetails && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 justify-start px-1 text-xs text-muted-foreground"
                onClick={() => setShowDetails(true)}
                data-testid="totp-manual-entry-button"
              >
                没有链接？改为手动填写
              </Button>
            )}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border/50 pt-3 sm:gap-0">
            <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>
              取消
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="rounded-xl"
              data-testid="totp-save-button"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isBatch ? `导入 ${parsedAccounts.length} 个` : isEdit ? '保存' : '导入'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
