import { useEffect, useState } from 'react';
import { formatTotpCode, generateTotpCode, getTotpRemainingSeconds } from '../totpCrypto';
import type { TotpAccountItem } from '../types';

/** 驱动整表倒计时刷新（共享 ticker，避免每行独立 interval） */
export function useTotpTicker(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;

    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => window.clearInterval(id);
  }, [enabled]);

  return now;
}

export function getTotpCodeAt(
  account: TotpAccountItem,
  nowMs: number
): { code: string; displayCode: string; remaining: number } {
  try {
    const code = generateTotpCode(account);
    return {
      code,
      displayCode: formatTotpCode(code, account.digits),
      remaining: getTotpRemainingSeconds(account.period, nowMs),
    };
  } catch {
    return {
      code: '------',
      displayCode: '------',
      remaining: 0,
    };
  }
}
