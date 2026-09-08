import { db } from '@/db';
import { createDefaultSyncProvider } from '@/db/syncProvider';
import { decryptData } from '@/lib/crypto/encryption';
import type { EncryptedData } from '@/lib/crypto/encryption';
import { decryptAndValidate } from '@/lib/sync/SyncEngine.pull';
import {
  type AuditEntry,
  type OrderedSyncOperation,
  buildAuditEntries,
  isAuditTable,
} from '@/lib/sync/auditHistoryModel';
import {
  type SyncChunkRecord,
  isSyncChunkOperation,
  reassembleChunkGroup,
  toSyncChunkRecord,
} from '@/lib/sync/chunks';
import { loadSyncKeyring } from '@/lib/sync/syncKeys';
import type { SyncOperation } from '@/lib/sync/types';

const HISTORY_PAGE_SIZE = 1000;

export interface AuditHistoryResult {
  entries: AuditEntry[];
  rawOperationCount: number;
}

interface LoadAuditHistoryOptions {
  signal?: AbortSignal;
  onProgress?: (loaded: number) => void;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Audit history loading aborted', 'AbortError');
}

function assertCursorAdvanced(cursor: string | number, nextCursor: string | number) {
  if (
    nextCursor === cursor ||
    (typeof cursor === 'number' && typeof nextCursor === 'number' && nextCursor < cursor)
  ) {
    throw new Error(`审计历史游标未前进: ${String(cursor)} -> ${String(nextCursor)}`);
  }
}

function getEncryptedContent(payload: unknown): EncryptedData | undefined {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return undefined;
  const encryptedContent = (payload as Record<string, unknown>).encryptedContent;
  if (
    typeof encryptedContent !== 'object' ||
    encryptedContent === null ||
    Array.isArray(encryptedContent)
  ) {
    return undefined;
  }
  const value = encryptedContent as Record<string, unknown>;
  return typeof value.ciphertext === 'string' && typeof value.iv === 'string'
    ? { ciphertext: value.ciphertext, iv: value.iv }
    : undefined;
}

function createUnavailableAuditEntry(
  operation: SyncOperation,
  order: number,
  reason: string,
  isChunked = false
): AuditEntry {
  return {
    id: operation.id,
    clientId: operation.clientId,
    table: 'unavailable',
    type: operation.type,
    action: 'unavailable',
    key: operation.key,
    timestamp: operation.timestamp,
    serverTimestamp: operation.serverTimestamp,
    source: 'remote',
    after: {
      reason,
      encryptedTable: operation.table,
      encryptedType: operation.type,
      encryptedKey: operation.key,
      keyHash: operation.keyHash,
      encryptedPayload: operation.payload,
    },
    order,
    isChunked,
    unavailable: true,
  };
}

async function decryptAuditEntryContent(entry: AuditEntry, teamKey: CryptoKey | null) {
  if (
    entry.table !== 'materials' &&
    entry.table !== 'testRuns' &&
    entry.table !== 'testProjects' &&
    entry.table !== 'projectRuns'
  ) {
    return { entry, unavailable: false };
  }

  const encryptedContent = getEncryptedContent(entry.after);
  if (!encryptedContent) return { entry, unavailable: false };

  const record = entry.after as Record<string, unknown>;
  const metadata = { ...record };
  delete metadata.encryptedContent;
  if (!teamKey) {
    return {
      entry: { ...entry, after: { ...metadata, content: '[未配置团队密钥，无法解密业务内容]' } },
      unavailable: true,
    };
  }

  try {
    return {
      entry: {
        ...entry,
        after: { ...metadata, content: await decryptData(encryptedContent, teamKey) },
      },
      unavailable: false,
    };
  } catch {
    return {
      entry: { ...entry, after: { ...metadata, content: '[业务内容解密失败]' } },
      unavailable: true,
    };
  }
}

async function decryptServerOperations(rawOperations: SyncOperation[]) {
  const keyring = await loadSyncKeyring();

  const decoded: OrderedSyncOperation[] = [];
  const unavailableEntries: AuditEntry[] = [];
  const chunks = new Map<string, { order: number; records: SyncChunkRecord[] }>();

  for (const [order, operation] of rawOperations.entries()) {
    if (isSyncChunkOperation(operation)) {
      const record = toSyncChunkRecord(operation);
      if (!record) {
        unavailableEntries.push(
          createUnavailableAuditEntry(operation, order, '分片记录无法识别或校验失败')
        );
        continue;
      }
      const group = chunks.get(record.operationId) ?? { order, records: [] };
      group.records.push(record);
      chunks.set(record.operationId, group);
      continue;
    }

    try {
      decoded.push({ operation: await decryptAndValidate(operation, keyring), order });
    } catch {
      unavailableEntries.push(createUnavailableAuditEntry(operation, order, '业务模块无法解密'));
    }
  }

  for (const group of chunks.values()) {
    const assembled = await reassembleChunkGroup(group.records);
    if (!assembled) {
      const first = group.records[0];
      if (first) {
        unavailableEntries.push(
          createUnavailableAuditEntry(
            {
              id: first.operationId,
              clientId: first.clientId,
              table: 'encrypted',
              type: 'create',
              key: first.operationId,
              keyHash: first.keyHash,
              timestamp: first.timestamp,
              payload: {
                kind: 'chunk-v1',
                chunkIndex: first.chunkIndex,
                chunkTotal: first.chunkTotal,
                ciphertextHash: first.ciphertextHash,
                iv: first.iv,
              },
              synced: 1,
            },
            group.order,
            '分片未完整重组',
            true
          )
        );
      }
      continue;
    }
    try {
      decoded.push({
        operation: await decryptAndValidate(assembled.operation, keyring),
        order: group.order,
        isChunked: true,
      });
    } catch {
      unavailableEntries.push(
        createUnavailableAuditEntry(assembled.operation, group.order, '分片业务模块无法解密', true)
      );
    }
  }

  return { decoded, unavailableEntries, teamKey: keyring.teamKey };
}

export async function loadAuditHistory({
  signal,
  onProgress,
}: LoadAuditHistoryOptions = {}): Promise<AuditHistoryResult> {
  const provider = createDefaultSyncProvider(db);
  const localOperations = (await db.operations.toArray()) as SyncOperation[];
  const localOperationIds = new Set(localOperations.map((operation) => operation.id));
  const rawOperations: SyncOperation[] = [];
  let cursor: string | number = 0;

  while (true) {
    throwIfAborted(signal);
    const page = await provider.pull(cursor, undefined, HISTORY_PAGE_SIZE);
    throwIfAborted(signal);
    rawOperations.push(...page.ops);
    onProgress?.(rawOperations.length);
    if (page.ops.length === 0) break;
    assertCursorAdvanced(cursor, page.nextCursor);
    cursor = page.nextCursor;
  }

  const { decoded, unavailableEntries, teamKey } = await decryptServerOperations(rawOperations);
  throwIfAborted(signal);

  const serverIds = new Set(decoded.map(({ operation }) => operation.id));
  const pending = localOperations
    .filter(
      (operation) =>
        operation.synced === 0 &&
        operation.payload !== undefined &&
        isAuditTable(operation.table) &&
        !serverIds.has(operation.id)
    )
    .sort((left, right) => left.timestamp - right.timestamp)
    .map((operation, index) => ({ operation, order: rawOperations.length + index }));

  const contentResults: Awaited<ReturnType<typeof decryptAuditEntryContent>>[] = [];
  for (const entry of buildAuditEntries([...decoded, ...pending], localOperationIds)) {
    throwIfAborted(signal);
    contentResults.push(await decryptAuditEntryContent(entry, teamKey));
  }

  return {
    entries: [...contentResults.map((result) => result.entry), ...unavailableEntries].sort(
      (left, right) => left.timestamp - right.timestamp || left.order - right.order
    ),
    rawOperationCount: rawOperations.length,
  };
}
