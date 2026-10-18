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

test('keeps every logged table and its entity history separate', () => {
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
      { id: 'internal', before: undefined },
      { id: '2', before: undefined },
      { id: '3', before: { name: 'One' } },
    ]
  );
});

test('消息通道、接收对象与未来新增模块的每次变更都保留', () => {
  const rows = [
    operation(
      'config-create',
      'create',
      { messageTemplate: '旧模板' },
      1,
      'notifyConfig',
      'default'
    ),
    operation(
      'config-update',
      'update',
      { messageTemplate: '新模板' },
      2,
      'notifyConfig',
      'default'
    ),
    operation('target-create', 'create', { label: '运维群' }, 3, 'notifyTargets', 'target'),
    operation(
      'target-delete',
      'update',
      { label: '运维群', deletedAt: 4 },
      4,
      'notifyTargets',
      'target'
    ),
    operation('future-create', 'create', { name: '新模块' }, 5, 'futureModule', 'item'),
    operation('future-update', 'update', { name: '新内容' }, 6, 'futureModule', 'item'),
  ];
  const entries = buildAuditEntries(rows, new Set(['config-create']));
  assert.equal(entries.length, rows.length);
  assert.deepEqual(entries.map(getAuditEntryType), [
    'notifyConfig',
    'notifyConfig',
    'notifyTargets',
    'notifyTargets',
    'unknown',
    'unknown',
  ]);
  assert.deepEqual(entries[1].before, entries[0].after);
  assert.equal(entries[3].action, 'delete');
  assert.equal(entries[4].table, 'futureModule');
  assert.deepEqual(entries[5].before, { name: '新模块' });
});

test('缺少载荷、未知操作类型和缺少元数据的记录不会消失', () => {
  const rows = [
    operation('missing-payload', 'update', undefined, 1, 'notifyConfig', 'default'),
    operation('future-action', 'future-action', { value: 1 }, 2, 'futureModule', 'item'),
    operation('no-metadata', undefined, null, undefined, undefined, undefined),
  ];
  delete rows[2].operation.table;
  delete rows[2].operation.key;
  const entries = buildAuditEntries(rows, new Set());
  assert.equal(entries.length, 3);
  assert.ok(entries.find(({ id }) => id === 'missing-payload').after.includes('未知'));
  assert.equal(entries.find(({ id }) => id === 'future-action').action, 'unknown');
  assert.equal(getAuditEntryType(entries.find(({ id }) => id === 'no-metadata')), 'unknown');
});

test('缺少对象标识的变更不会被误认为是同一个对象', () => {
  const rows = ['one', 'two'].map((id, index) => {
    const row = operation(id, 'update', { value: id }, index + 1);
    delete row.operation.table;
    delete row.operation.key;
    return row;
  });
  const entries = buildAuditEntries(rows, new Set());
  assert.equal(entries.length, 2);
  assert.ok(entries.every((entry) => entry.before === undefined));
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
