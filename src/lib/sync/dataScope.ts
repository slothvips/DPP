import type { SyncOperation } from './types';

/** 数据归属：团队共享 / 个人私密 / 仅本地 */
export type DataScope = 'team' | 'personal' | 'local';

/** 表级默认归属（未进 SyncEngine 的 local 表可不登记） */
export const TABLE_DATA_SCOPE: Record<string, DataScope> = {
  tags: 'team',
  jobTags: 'team',
  links: 'team',
  linkTags: 'team',
  blackboard: 'team',
  totpAccounts: 'personal',
};

/** 当前纳入个人密钥同步的表 */
export const PERSONAL_SYNC_TABLES = Object.entries(TABLE_DATA_SCOPE)
  .filter(([, scope]) => scope === 'personal')
  .map(([table]) => table);

export function getTableDataScope(table: string): DataScope {
  return TABLE_DATA_SCOPE[table] ?? 'team';
}

function readEntityDataScope(payload: unknown): DataScope | undefined {
  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }
  const scope = (payload as { dataScope?: unknown }).dataScope;
  if (scope === 'team' || scope === 'personal') {
    return scope;
  }
  return undefined;
}

/**
 * 解析同步操作的数据归属。
 * - 表默认 personal：恒为 personal（禁止实体降级为 team）
 * - 表默认 team：允许实体覆盖为 personal（未来黑板私人条）
 * - 结果为 personal 时禁止用团队密钥加密
 */
export function resolveDataScope(op: Pick<SyncOperation, 'table' | 'payload'>): DataScope {
  const tableScope = getTableDataScope(op.table);

  if (tableScope === 'personal') {
    return 'personal';
  }

  if (tableScope === 'local') {
    return 'local';
  }

  const entityScope = readEntityDataScope(op.payload);
  if (entityScope === 'personal') {
    return 'personal';
  }

  return 'team';
}

export function isPersonalSyncScope(scope: DataScope): boolean {
  return scope === 'personal';
}
