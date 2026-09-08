import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildAuditEntries, getAuditEntryType } from '../src/lib/sync/auditHistoryModel.ts';
import { AUDIT_TABLES } from '../src/lib/sync/auditHistoryModel.ts';

const auditHistorySource = readFileSync(
  new URL('../src/features/audit/auditHistory.ts', import.meta.url),
  'utf8'
);

function operation(id, type, payload, timestamp, table = 'links', key = 'link-1') {
  return {
    operation: {
      id,
      clientId: id === '2' ? 'remote-client' : 'local-client',
      table,
      type,
      key,
      payload,
      timestamp,
      synced: 1,
    },
    order: timestamp,
  };
}

test('reconstructs complete snapshots in operation order', () => {
  const entries = buildAuditEntries(
    [
      operation('3', 'delete', { id: 'link-1', name: 'New', deletedAt: 30 }, 30),
      operation('1', 'create', { id: 'link-1', name: 'Old' }, 10),
      operation('2', 'update', { id: 'link-1', name: 'New' }, 20),
    ],
    new Set(['1', '3'])
  );

  assert.deepEqual(
    entries.map(({ id, source, before, after }) => ({ id, source, before, after })),
    [
      {
        id: '1',
        source: 'local',
        before: undefined,
        after: { id: 'link-1', name: 'Old' },
      },
      {
        id: '2',
        source: 'remote',
        before: { id: 'link-1', name: 'Old' },
        after: { id: 'link-1', name: 'New' },
      },
      {
        id: '3',
        source: 'local',
        before: { id: 'link-1', name: 'New' },
        after: { id: 'link-1', name: 'New', deletedAt: 30 },
      },
    ]
  );
});

test('keeps entity histories separate and ignores internal sync tables', () => {
  const entries = buildAuditEntries(
    [
      operation('1', 'create', { name: 'One' }, 1, 'links', 'one'),
      operation('internal', 'create', { value: true }, 2, 'operations', 'internal'),
      operation('2', 'create', { name: 'Two' }, 3, 'links', 'two'),
      operation('3', 'update', { name: 'One updated' }, 4, 'links', 'one'),
    ],
    new Set()
  );

  assert.deepEqual(
    entries.map(({ id, before }) => ({ id, before })),
    [
      { id: '1', before: undefined },
      { id: '2', before: undefined },
      { id: '3', before: { name: 'One' } },
    ]
  );
});

test('preserves the merged chunk marker on the single audit entry', () => {
  const chunked = operation('chunked', 'update', { name: 'Complete payload' }, 1);
  chunked.isChunked = true;

  const entries = buildAuditEntries([chunked], new Set());

  assert.equal(entries.length, 1);
  assert.equal(entries[0].isChunked, true);
  assert.deepEqual(entries[0].after, { name: 'Complete payload' });
});

test('applies Dexie encrypted content paths before presenting the payload', () => {
  const entries = buildAuditEntries(
    [
      operation(
        'encrypted-update',
        'update',
        {
          id: 'run-1',
          encryptedContent: { ciphertext: 'old', iv: 'old-iv' },
          'encryptedContent.ciphertext': 'new',
          'encryptedContent.iv': 'new-iv',
        },
        1,
        'testRuns',
        'run-1'
      ),
    ],
    new Set()
  );

  assert.deepEqual(entries[0].after, {
    id: 'run-1',
    encryptedContent: { ciphertext: 'new', iv: 'new-iv' },
  });
});

test('distinguishes material entity types in audit entries', () => {
  const entries = buildAuditEntries(
    [
      operation('prompt', 'create', { type: 'prompt' }, 1, 'materials', 'prompt'),
      operation('role', 'update', { type: 'role' }, 2, 'materials', 'role'),
      operation('test-case', 'delete', { type: 'testCase' }, 3, 'materials', 'test-case'),
      operation('legacy', 'update', { title: 'Legacy material' }, 4, 'materials', 'legacy'),
    ],
    new Set()
  );

  assert.deepEqual(entries.map(getAuditEntryType), ['prompt', 'role', 'testCase', 'materials']);
});

test('classifies soft-delete transitions as delete and restore actions', () => {
  const entries = buildAuditEntries(
    [
      operation('create', 'create', { id: 'link-1', name: 'Original' }, 1),
      operation('update', 'update', { id: 'link-1', name: 'Changed' }, 2),
      operation('soft-delete', 'update', { id: 'link-1', name: 'Changed', deletedAt: 3 }, 3),
      operation('deleted-update', 'update', { id: 'link-1', name: 'Changed', deletedAt: 3 }, 4),
      operation('restore', 'update', { id: 'link-1', name: 'Changed', deletedAt: null }, 5),
      operation('physical-delete', 'delete', { id: 'link-1', name: 'Changed' }, 6),
    ],
    new Set()
  );

  assert.deepEqual(
    entries.map(({ action }) => action),
    ['create', 'update', 'delete', 'update', 'restore', 'delete']
  );
  assert.equal(entries[2].type, 'update');
});

test('decrypts audit content with bounded cancellable work', () => {
  assert.doesNotMatch(auditHistorySource, /contentResults = await Promise\.all/);
  assert.match(
    auditHistorySource,
    /for \(const entry of buildAuditEntries[\s\S]*throwIfAborted\(signal\);[\s\S]*await decryptAuditEntryContent/
  );
});

test('audit history includes and decrypts project records', () => {
  assert.ok(AUDIT_TABLES.includes('testProjects'));
  assert.ok(AUDIT_TABLES.includes('projectRuns'));
  assert.match(auditHistorySource, /entry\.table !== 'testProjects'/);
  assert.match(auditHistorySource, /entry\.table !== 'projectRuns'/);
});
