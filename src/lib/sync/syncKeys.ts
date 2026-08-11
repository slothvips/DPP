import { getKeyHash, loadKey } from '@/lib/crypto/encryption';
import { loadPersonalKey } from '@/lib/crypto/personalKey';
import { logger } from '@/utils/logger';
import { type DataScope, isPersonalSyncScope, resolveDataScope } from './dataScope';
import type { SyncOperation } from './types';

export interface SyncKeyring {
  teamKey: CryptoKey | null;
  teamHash: string | null;
  personalKey: CryptoKey | null;
  personalHash: string | null;
}

export async function loadSyncKeyring(): Promise<SyncKeyring> {
  const [teamKey, personalKey] = await Promise.all([loadKey(), loadPersonalKey()]);

  return {
    teamKey,
    teamHash: teamKey ? await getKeyHash(teamKey) : null,
    personalKey,
    personalHash: personalKey ? await getKeyHash(personalKey) : null,
  };
}

/**
 * 按归属取加密密钥。personal 无钥时返回 null（调用方应跳过上传，禁止回落团队钥）。
 */
export async function resolveKeyForScope(
  scope: DataScope,
  keyring?: SyncKeyring
): Promise<CryptoKey | null> {
  const ring = keyring ?? (await loadSyncKeyring());

  if (isPersonalSyncScope(scope)) {
    return ring.personalKey;
  }

  if (scope === 'local') {
    logger.warn('[Sync] Attempted to resolve key for local-only scope');
    return null;
  }

  return ring.teamKey;
}

export function resolveKeyForOperation(
  op: Pick<SyncOperation, 'table' | 'payload'>,
  keyring: SyncKeyring
): { scope: DataScope; key: CryptoKey | null } {
  const scope = resolveDataScope(op);
  if (isPersonalSyncScope(scope)) {
    return { scope, key: keyring.personalKey };
  }
  if (scope === 'local') {
    return { scope, key: null };
  }
  return { scope, key: keyring.teamKey };
}

export type SyncKeyRole = 'team' | 'personal';

/** 按远端 op.keyHash 选择解密密钥 */
export function resolveKeyForKeyHash(
  keyHash: string | undefined,
  keyring: SyncKeyring
): CryptoKey | null {
  const role = resolveKeyRoleForKeyHash(keyHash, keyring);
  if (role === 'personal') {
    return keyring.personalKey;
  }
  if (role === 'team') {
    return keyring.teamKey;
  }
  return null;
}

/** 按 keyHash 判定解密所用密钥角色；无 keyHash 的历史数据仅视为团队钥 */
export function resolveKeyRoleForKeyHash(
  keyHash: string | undefined,
  keyring: SyncKeyring
): SyncKeyRole | null {
  if (!keyHash) {
    return keyring.teamKey ? 'team' : null;
  }
  if (keyring.personalHash && keyHash === keyring.personalHash) {
    return 'personal';
  }
  if (keyring.teamHash && keyHash === keyring.teamHash) {
    return 'team';
  }
  return null;
}

/**
 * 解密后校验：个人 scope 必须用个人钥，团队 scope 必须用团队钥。
 * local 或不匹配 → false（调用方应 skip）。
 */
export function doesKeyRoleMatchScope(role: SyncKeyRole | null, scope: DataScope): boolean {
  if (!role) {
    return false;
  }
  if (isPersonalSyncScope(scope)) {
    return role === 'personal';
  }
  if (scope === 'team') {
    return role === 'team';
  }
  return false;
}
