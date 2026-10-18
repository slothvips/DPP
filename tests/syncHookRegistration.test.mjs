import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

await import('fake-indexeddb/auto');
const { default: Dexie } = await import('dexie');

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let registerSyncHooks;
let resolveDataScope;
let databaseModule;

before(async () => {
  server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
    resolve: { alias: { '@': path.join(root, 'src') } },
  });
  ({ registerSyncHooks } = await server.ssrLoadModule('/src/lib/sync/SyncEngine.hooks.ts'));
  ({ resolveDataScope } = await server.ssrLoadModule('/src/lib/sync/dataScope.ts'));
  databaseModule = await server.ssrLoadModule('/src/db/index.ts');
  await databaseModule.db.delete();
  await databaseModule.db.open();
});

after(async () => {
  await databaseModule?.db.close();
  await server?.close();
});

const { registerDatabaseSchema } = await import('../src/db/schema.ts');

async function createDb() {
  const db = new Dexie(`hooks-${crypto.randomUUID()}`);
  registerDatabaseSchema(db);
  await db.open();
  return db;
}

test('事务回滚不会为创建或更新留下同步操作', async (t) => {
  const db = databaseModule.db;
  await db.notifyConfig.put({ id: 'default', botToken: 'original', updatedAt: 1 });
  for (let attempt = 0; attempt < 20 && (await db.operations.count()) === 0; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  await db.operations.clear();

  for (const nested of [false, true]) {
    await t.test(nested ? '子事务成功后外层回滚' : '普通事务回滚', async () => {
      const write = async () => {
        await db.notifyConfig.put({ id: 'default', botToken: 'rolled-back', updatedAt: 2 });
        await db.notifyTargets.put({
          id: 'rolled-back-target',
          kind: 'user',
          label: '回滚对象',
          chatId: '123',
          updatedAt: 2,
        });
      };
      await assert.rejects(
        db.transaction('rw', db.notifyConfig, db.notifyTargets, async () => {
          if (nested) {
            await db.transaction('rw', db.notifyConfig, db.notifyTargets, write);
          } else {
            await write();
          }
          throw new Error('rollback');
        }),
        /rollback/
      );
      assert.equal((await db.notifyConfig.get('default')).botToken, 'original');
      assert.equal(await db.notifyTargets.get('rolled-back-target'), undefined);
      // 排队一次写事务，确保错误实现中独立落库的同步操作也已经完成。
      await db.transaction('rw', db.settings, db.operations, async () => {
        assert.equal(await db.operations.count(), 0);
      });
    });
  }
});

test('嵌套写入等外层提交后记录操作，远端同步写入不产生反馈', async (t) => {
  const db = await createDb();
  t.after(() => db.delete());
  await db.notifyConfig.put({ id: 'default', botToken: 'original', updatedAt: 1 });
  const recorded = [];
  registerSyncHooks({
    db,
    tables: ['notifyConfig', 'notifyTargets'],
    isRegistered: () => true,
    recordOperation: async (table, type, key, payload) => {
      recorded.push({ table, type, key, payload });
    },
  });

  await db.transaction('rw', db.notifyConfig, db.notifyTargets, async () => {
    await db.transaction('rw', db.notifyConfig, db.notifyTargets, async () => {
      await db.notifyConfig.update('default', { botToken: 'committed' });
      await db.notifyTargets.add({ id: 'committed-target', chatId: '123', updatedAt: 1 });
    });
    assert.deepEqual(recorded, [], '子事务成功不代表外层事务已提交');
  });
  assert.equal(recorded.length, 2);
  assert.deepEqual(
    recorded.map(({ table, type }) => ({ table, type })),
    [
      { table: 'notifyConfig', type: 'update' },
      { table: 'notifyTargets', type: 'create' },
    ]
  );
  assert.equal(recorded[0].payload.botToken, 'committed');
  assert.equal(recorded[1].key, 'committed-target');

  await db.transaction('rw', db.notifyConfig, db.notifyTargets, async (transaction) => {
    transaction.source = 'sync';
    await db.notifyConfig.update('default', { botToken: 'remote' });
    await db.notifyTargets.add({ id: 'remote-target', chatId: '456', updatedAt: 1 });
  });
  assert.equal(recorded.length, 2);
});

test('db/index 模块加载时会自动注册同步引擎钩子', async () => {
  await databaseModule.db.notifyConfig.put({ id: 'default', botToken: '123:abc', updatedAt: 1 });

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if ((await databaseModule.db.operations.count()) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  assert.fail('模块加载后的数据库写入没有产生同步操作');
});

test('设置页场景:钩子未注册时写消息表不产生同步操作,注册后 normal put 立即产生', async () => {
  const db = await createDb();
  const recorded = [];
  const recordOperation = async (table, type, key, payload) => {
    recorded.push({ table, type, key, payload });
  };

  // 模拟旧问题:设置页上下文没有创建 SyncEngine,保存消息配置不记 op、不触发推送。
  await db.notifyConfig.put({ id: 'default', botToken: '', updatedAt: 1 });
  assert.equal(recorded.length, 0);

  registerSyncHooks({
    db,
    tables: ['notifyConfig', 'notifyTargets'],
    isRegistered: () => true,
    recordOperation,
  });

  await db.notifyConfig.put({
    id: 'default',
    botToken: '123:abc',
    messageTemplate: '完成了 {任务}',
    updatedAt: 0,
  });
  await db.notifyTargets.put({
    id: 't1',
    kind: 'user',
    label: '测试人',
    chatId: '123456',
    updatedAt: 0,
  });

  assert.equal(recorded.length, 2);
  const configOp = recorded.find((op) => op.table === 'notifyConfig');
  const targetOp = recorded.find((op) => op.table === 'notifyTargets');
  assert.ok(configOp, 'notifyConfig 应记录同步操作');
  assert.ok(targetOp, 'notifyTargets 应记录同步操作');
  assert.equal(configOp.type, 'update', '已存在的 default 行 put 走 updating 钩子');
  assert.equal(targetOp.type, 'create', '新接收对象行 put 走 creating 钩子');
  assert.equal(configOp.payload.messageTemplate, '完成了 {任务}');
  assert.ok(configOp.payload.updatedAt > 0, '钩子应补写 updatedAt 供 LWW 使用');

  assert.equal(
    resolveDataScope({ table: configOp.table, payload: configOp.payload }),
    'team',
    '消息配置归属必须是团队共享'
  );

  await db.close();
});
