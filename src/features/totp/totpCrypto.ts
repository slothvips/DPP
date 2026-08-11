import * as OTPAuth from 'otpauth';
import type { TotpAccountFormData, TotpAccountItem, TotpAlgorithm, TotpDigits } from './types';

export const TOTP_ALGORITHMS: TotpAlgorithm[] = ['SHA1', 'SHA256', 'SHA512'];
export const TOTP_DIGITS_OPTIONS: TotpDigits[] = [6, 8];
export const DEFAULT_TOTP_PERIOD = 30;

/** 规范化 Base32 secret：去空格、转大写、去掉 padding */
export function normalizeTotpSecret(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase().replace(/=+$/, '');
}

export function isValidTotpSecret(raw: string): boolean {
  const secret = normalizeTotpSecret(raw);
  if (secret.length < 8) return false;
  if (!/^[A-Z2-7]+$/.test(secret)) return false;

  try {
    OTPAuth.Secret.fromBase32(secret);
    return true;
  } catch {
    return false;
  }
}

const OTPAUTH_URI_RE = /otpauth:\/\/[^\s<>"'`]+/gi;

function normalizeAlgorithm(value: string): TotpAlgorithm {
  const upper = value.toUpperCase().replace(/-/g, '');
  if (upper === 'SHA256' || upper === 'SHA512' || upper === 'SHA1') {
    return upper;
  }
  return 'SHA1';
}

function normalizeDigits(value: number): TotpDigits {
  return value === 8 ? 8 : 6;
}

function totpToFormData(totp: OTPAuth.TOTP): TotpAccountFormData {
  const issuer = totp.issuer?.trim() || '';
  const account = totp.label?.trim() || '';
  const label = issuer || account || '未命名账户';

  return {
    label,
    issuer,
    account: account && account !== label ? account : account,
    secret: totp.secret.base32,
    algorithm: normalizeAlgorithm(totp.algorithm),
    digits: normalizeDigits(totp.digits),
    period: totp.period || DEFAULT_TOTP_PERIOD,
  };
}

function parseOtpauthUri(uri: string): TotpAccountFormData {
  const parsed = OTPAuth.URI.parse(uri);
  if (!(parsed instanceof OTPAuth.TOTP)) {
    throw new Error('仅支持 TOTP（不支持 HOTP）');
  }
  return totpToFormData(parsed);
}

export type TotpImportParseResult =
  | { ok: true; accounts: TotpAccountFormData[]; source: 'uri' | 'secret' }
  | { ok: false; error: string };

/**
 * 解析粘贴文本：优先提取 otpauth:// URI（可多条），否则当作 Base32 密钥。
 */
export function parseTotpImportText(raw: string): TotpImportParseResult {
  const text = raw.trim();
  if (!text) {
    return { ok: false, error: '请粘贴 otpauth:// 链接或 Base32 密钥' };
  }

  const uriMatches = text.match(OTPAUTH_URI_RE) ?? [];
  if (uriMatches.length > 0) {
    const accounts: TotpAccountFormData[] = [];
    for (const uri of uriMatches) {
      const cleaned = uri.replace(/[),.;]+$/g, '');
      try {
        accounts.push(parseOtpauthUri(cleaned));
      } catch (error) {
        const message = error instanceof Error ? error.message : '无法解析链接';
        return { ok: false, error: `${message}：${cleaned.slice(0, 48)}` };
      }
    }
    return { ok: true, accounts, source: 'uri' };
  }

  // secret=XXXX 单行
  const secretParam = text.match(/(?:^|[?&\s])secret=([A-Za-z2-7=\s-]+)/i);
  if (secretParam?.[1] && isValidTotpSecret(secretParam[1])) {
    return {
      ok: true,
      accounts: [
        {
          label: '未命名账户',
          issuer: '',
          account: '',
          secret: normalizeTotpSecret(secretParam[1]),
          algorithm: 'SHA1',
          digits: 6,
          period: DEFAULT_TOTP_PERIOD,
        },
      ],
      source: 'secret',
    };
  }

  if (isValidTotpSecret(text)) {
    return {
      ok: true,
      accounts: [
        {
          label: '未命名账户',
          issuer: '',
          account: '',
          secret: normalizeTotpSecret(text),
          algorithm: 'SHA1',
          digits: 6,
          period: DEFAULT_TOTP_PERIOD,
        },
      ],
      source: 'secret',
    };
  }

  return {
    ok: false,
    error: '无法识别内容。请粘贴 otpauth://totp/... 链接，或有效的 Base32 密钥',
  };
}

function createTotp(
  account: Pick<
    TotpAccountItem,
    'secret' | 'algorithm' | 'digits' | 'period' | 'issuer' | 'label' | 'account'
  >
) {
  return new OTPAuth.TOTP({
    issuer: account.issuer || undefined,
    label: account.account || account.label,
    issuerInLabel: Boolean(account.issuer),
    algorithm: account.algorithm,
    digits: account.digits,
    period: account.period,
    secret: OTPAuth.Secret.fromBase32(normalizeTotpSecret(account.secret)),
  });
}

/** 导出为标准 otpauth:// URI，可直接粘贴回本应用导入 */
export function toOtpauthUri(
  account: Pick<
    TotpAccountItem,
    'secret' | 'algorithm' | 'digits' | 'period' | 'issuer' | 'label' | 'account'
  >
): string {
  return createTotp(account).toString();
}

export function exportTotpAccountsAsText(
  accounts: Array<
    Pick<
      TotpAccountItem,
      'secret' | 'algorithm' | 'digits' | 'period' | 'issuer' | 'label' | 'account'
    >
  >
): string {
  return accounts.map((account) => toOtpauthUri(account)).join('\n');
}

export function generateTotpCode(
  account: Pick<
    TotpAccountItem,
    'secret' | 'algorithm' | 'digits' | 'period' | 'issuer' | 'label' | 'account'
  >
): string {
  return createTotp(account).generate();
}

/** 当前周期剩余秒数 */
export function getTotpRemainingSeconds(period: number, nowMs = Date.now()): number {
  const elapsed = Math.floor(nowMs / 1000) % period;
  return period - elapsed;
}

export function formatTotpCode(code: string, digits: TotpDigits): string {
  if (digits === 8 && code.length === 8) {
    return `${code.slice(0, 4)} ${code.slice(4)}`;
  }
  if (code.length === 6) {
    return `${code.slice(0, 3)} ${code.slice(3)}`;
  }
  return code;
}
