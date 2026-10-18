import type { OperationType, SyncOperation } from './types';

// 只用于已知模块的展示元数据，不能作为审计记录的过滤白名单。
export const AUDIT_TABLES = [
  'blackboard',
  'jobTags',
  'links',
  'linkTags',
  'materials',
  'notifyConfig',
  'notifyTargets',
  'roleUsageEvents',
  'tags',
  'testRuns',
  'testProjects',
  'projectRuns',
  'totpAccounts',
] as const;

export type AuditTable = (typeof AUDIT_TABLES)[number];
export type AuditSource = 'local' | 'remote';
export type AuditEntityType =
  | AuditTable
  | 'unavailable'
  | 'unknown'
  | 'prompt'
  | 'role'
  | 'testCase'
  | 'conversation';
export type AuditAction = OperationType | 'restore' | 'unavailable' | 'unknown';

export interface OrderedSyncOperation {
  operation: SyncOperation;
  order: number;
  isChunked?: boolean;
}

export interface AuditEntry {
  id: string;
  clientId?: string;
  table: string;
  type: OperationType;
  action: AuditAction;
  key: unknown;
  timestamp: number;
  serverTimestamp?: number;
  source: AuditSource;
  before?: unknown;
  after: unknown;
  order: number;
  isChunked: boolean;
  unavailable?: boolean;
}

export function isAuditTable(table: string): table is AuditTable {
  return AUDIT_TABLES.includes(table as AuditTable);
}

export function getAuditEntryType(entry: AuditEntry): AuditEntityType {
  if (entry.table === 'unavailable') return 'unavailable';
  if (!isAuditTable(entry.table)) return 'unknown';
  if (entry.table !== 'materials') return entry.table;

  const payload =
    typeof entry.after === 'object' && entry.after !== null && !Array.isArray(entry.after)
      ? (entry.after as Record<string, unknown>)
      : undefined;
  return payload?.type === 'prompt' ||
    payload?.type === 'role' ||
    payload?.type === 'testCase' ||
    payload?.type === 'conversation'
    ? payload.type
    : 'materials';
}

function entityKey(operation: SyncOperation): string {
  return JSON.stringify([operation.table, operation.key]);
}

function isDeleted(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).deletedAt != null
  );
}

function getAuditAction(type: OperationType, before: unknown, after: unknown): AuditAction {
  if (type === 'delete') return 'delete';
  if (!isDeleted(before) && isDeleted(after)) return 'delete';
  if (isDeleted(before) && !isDeleted(after)) return 'restore';
  return type === 'create' || type === 'update' ? type : 'unknown';
}

export function compareAuditEntries(
  left: { timestamp: number; order: number },
  right: { timestamp: number; order: number }
): number {
  const leftTime = Number.isFinite(left.timestamp) ? left.timestamp : 0;
  const rightTime = Number.isFinite(right.timestamp) ? right.timestamp : 0;
  return leftTime - rightTime || left.order - right.order;
}

function normalizeEncryptedContentPaths(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return payload;

  const record = payload as Record<string, unknown>;
  const ciphertext = record['encryptedContent.ciphertext'];
  const iv = record['encryptedContent.iv'];
  if (typeof ciphertext !== 'string' && typeof iv !== 'string') return payload;

  const current =
    typeof record.encryptedContent === 'object' &&
    record.encryptedContent !== null &&
    !Array.isArray(record.encryptedContent)
      ? (record.encryptedContent as Record<string, unknown>)
      : {};
  const normalized: Record<string, unknown> = {
    ...record,
    encryptedContent: {
      ...current,
      ...(typeof ciphertext === 'string' ? { ciphertext } : {}),
      ...(typeof iv === 'string' ? { iv } : {}),
    },
  };
  delete normalized['encryptedContent.ciphertext'];
  delete normalized['encryptedContent.iv'];
  return normalized;
}

export function buildAuditEntries(
  orderedOperations: OrderedSyncOperation[],
  localOperationIds: ReadonlySet<string>,
  uncertainAfterOrders: ReadonlySet<number> = new Set()
): AuditEntry[] {
  const snapshots = new Map<string, unknown>();
  let historyUncertain = false;
  const sortedUncertaintyOrders = [...uncertainAfterOrders].sort((left, right) => left - right);
  let uncertaintyIndex = 0;

  return [...orderedOperations]
    .sort((left, right) =>
      compareAuditEntries(
        { timestamp: left.operation.timestamp, order: left.order },
        { timestamp: right.operation.timestamp, order: right.order }
      )
    )
    .map(({ operation, order, isChunked }): AuditEntry => {
      while (
        uncertaintyIndex < sortedUncertaintyOrders.length &&
        sortedUncertaintyOrders[uncertaintyIndex] < order
      ) {
        historyUncertain = true;
        uncertaintyIndex += 1;
      }
      const snapshotKey = entityKey(operation);
      const hasEntityKey = Boolean(operation.table) && operation.key !== undefined;
      const before = historyUncertain || !hasEntityKey ? undefined : snapshots.get(snapshotKey);
      const after =
        operation.payload === undefined
          ? '[未知：该操作缺少变更载荷]'
          : normalizeEncryptedContentPaths(operation.payload);
      if (hasEntityKey) snapshots.set(snapshotKey, after);
      if (uncertainAfterOrders.has(order)) historyUncertain = true;

      return {
        id: operation.id,
        clientId: operation.clientId,
        table: operation.table ?? '',
        type: operation.type,
        action: getAuditAction(operation.type, before, after),
        key: operation.key,
        timestamp: operation.timestamp,
        serverTimestamp: operation.serverTimestamp,
        source: localOperationIds.has(operation.id) ? 'local' : 'remote',
        before,
        after,
        order,
        isChunked: isChunked === true,
      };
    })
    .sort(compareAuditEntries);
}
