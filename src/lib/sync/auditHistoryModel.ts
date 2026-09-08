import type { OperationType, SyncOperation } from './types';

export const AUDIT_TABLES = [
  'blackboard',
  'jobTags',
  'links',
  'linkTags',
  'materials',
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
  | 'prompt'
  | 'role'
  | 'testCase'
  | 'conversation';
export type AuditAction = OperationType | 'restore' | 'unavailable';

export interface OrderedSyncOperation {
  operation: SyncOperation;
  order: number;
  isChunked?: boolean;
}

export interface AuditEntry {
  id: string;
  clientId?: string;
  table: AuditTable | 'unavailable';
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
  return type;
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
  localOperationIds: ReadonlySet<string>
): AuditEntry[] {
  const snapshots = new Map<string, unknown>();

  return [...orderedOperations]
    .sort(
      (left, right) =>
        left.operation.timestamp - right.operation.timestamp || left.order - right.order
    )
    .flatMap(({ operation, order, isChunked }) => {
      if (!isAuditTable(operation.table) || operation.payload === undefined) return [];

      const snapshotKey = entityKey(operation);
      const before = snapshots.get(snapshotKey);
      const after = normalizeEncryptedContentPaths(operation.payload);
      snapshots.set(snapshotKey, after);

      return [
        {
          id: operation.id,
          clientId: operation.clientId,
          table: operation.table,
          type: operation.type,
          action: getAuditAction(operation.type, before, after),
          key: operation.key,
          timestamp: operation.timestamp,
          serverTimestamp: operation.serverTimestamp,
          source: localOperationIds.has(operation.id) ? ('local' as const) : ('remote' as const),
          before,
          after,
          order,
          isChunked: isChunked === true,
        },
      ];
    })
    .sort((left, right) => left.timestamp - right.timestamp || left.order - right.order);
}
