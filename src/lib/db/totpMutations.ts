import {
  DEFAULT_TOTP_PERIOD,
  isValidTotpSecret,
  normalizeTotpSecret,
} from '@/features/totp/totpCrypto';
import { VALIDATION_LIMITS, validateLength } from '@/utils/validation';
import {
  type AddTotpAccountArgs,
  type AddTotpAccountResult,
  type DeleteTotpAccountArgs,
  type ReorderTotpAccountsArgs,
  type TotpMutationResult,
  type UpdateTotpAccountArgs,
  getTotpAccountOrThrow,
  getTotpTable,
} from './totpShared';

function validateAccountFields(args: {
  label: string;
  issuer?: string;
  account?: string;
  secret: string;
  period: number;
}) {
  const labelCheck = validateLength(args.label, VALIDATION_LIMITS.TOTP_LABEL_MAX, '名称');
  if (!labelCheck.valid) {
    throw new Error(labelCheck.error);
  }
  if (!args.label.trim()) {
    throw new Error('名称不能为空');
  }

  const issuerCheck = validateLength(
    args.issuer ?? '',
    VALIDATION_LIMITS.TOTP_ISSUER_MAX,
    '发行方'
  );
  if (!issuerCheck.valid) {
    throw new Error(issuerCheck.error);
  }

  const accountCheck = validateLength(
    args.account ?? '',
    VALIDATION_LIMITS.TOTP_ACCOUNT_MAX,
    '账号'
  );
  if (!accountCheck.valid) {
    throw new Error(accountCheck.error);
  }

  if (!isValidTotpSecret(args.secret)) {
    throw new Error('密钥无效，请输入有效的 Base32 密钥');
  }

  if (!Number.isInteger(args.period) || args.period < 10 || args.period > 120) {
    throw new Error('刷新周期需为 10–120 之间的整数秒');
  }
}

export async function addTotpAccount(args: AddTotpAccountArgs): Promise<AddTotpAccountResult> {
  const period = args.period ?? DEFAULT_TOTP_PERIOD;
  validateAccountFields({
    label: args.label,
    issuer: args.issuer,
    account: args.account,
    secret: args.secret,
    period,
  });

  const now = Date.now();
  const id = crypto.randomUUID();
  const secret = normalizeTotpSecret(args.secret);

  const existing = await getTotpTable().toArray();
  const maxSortOrder = existing.reduce((max, item) => {
    const value = typeof item.sortOrder === 'number' ? item.sortOrder : item.createdAt;
    return Math.max(max, value);
  }, -1);

  await getTotpTable().add({
    id,
    label: args.label.trim(),
    issuer: args.issuer?.trim() || undefined,
    account: args.account?.trim() || undefined,
    secret,
    algorithm: args.algorithm ?? 'SHA1',
    digits: args.digits ?? 6,
    period,
    sortOrder: maxSortOrder + 1,
    createdAt: now,
    updatedAt: now,
  });

  return {
    success: true,
    id,
    message: '验证器账户已添加',
  };
}

export async function updateTotpAccount(args: UpdateTotpAccountArgs): Promise<TotpMutationResult> {
  const existing = await getTotpAccountOrThrow(args.id);
  const label = args.label ?? existing.label;
  const issuer = args.issuer !== undefined ? args.issuer : existing.issuer;
  const account = args.account !== undefined ? args.account : existing.account;

  validateAccountFields({
    label,
    issuer,
    account,
    secret: existing.secret,
    period: existing.period,
  });

  // 密钥 / 算法 / 位数 / 周期导入后不可修改
  await getTotpTable().update(args.id, {
    label: label.trim(),
    issuer: issuer?.trim() || undefined,
    account: account?.trim() || undefined,
    updatedAt: Date.now(),
  });

  return {
    success: true,
    message: '验证器账户已更新',
  };
}

export async function deleteTotpAccount(args: DeleteTotpAccountArgs): Promise<TotpMutationResult> {
  await getTotpAccountOrThrow(args.id);
  // 仅本地表：硬删除
  await getTotpTable().delete(args.id);

  return {
    success: true,
    message: '验证器账户已删除',
  };
}

export async function reorderTotpAccounts(
  args: ReorderTotpAccountsArgs
): Promise<TotpMutationResult> {
  const now = Date.now();
  const table = getTotpTable();

  await Promise.all(
    args.orderedIds.map((id, index) =>
      table.update(id, {
        sortOrder: index,
        updatedAt: now,
      })
    )
  );

  return {
    success: true,
    message: '排序已更新',
  };
}
