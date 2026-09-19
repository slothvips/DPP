import { trackTotp } from '@/lib/analytics';
import { recordRecentAction } from '@/lib/db';
import { getTotpCodeAt } from '../hooks/useTotpCode';
import type { TotpAccountItem } from '../types';

/**
 * 复制 TOTP 验证码的唯一收敛入口：
 * 生成验证码 → 写入剪贴板 → recordRecentAction → 埋点 codeCopied。
 * 仅在复制成功后记录最近操作与埋点；生成失败时抛错由调用方处理。
 */
export async function copyTotpCode(account: TotpAccountItem, nowMs: number): Promise<void> {
  const { code } = getTotpCodeAt(account, nowMs);
  if (code === '------') throw new Error('无法生成验证码');

  await navigator.clipboard.writeText(code);
  await recordRecentAction({
    type: 'totp_copy',
    targetId: account.id,
    label: account.label,
  });
  trackTotp('codeCopied');
}

/** 明文验证码被展示时的埋点入口：验证器页切换显示、快捷预览首次展开都走这里。 */
export function reportTotpCodesRevealed(): void {
  trackTotp('codeRevealed');
}
