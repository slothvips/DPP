import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { handleNotifyRequest } from '../packages/cf-worker-googlesheet/src/lib/notify.ts';
import { canonicalChatId, notifyClaimKey } from '../src/features/notify/canonical.ts';
import { clearNotifySinceCache, deliverOnce } from '../src/features/notify/deliverCore.ts';
import { saveNotifyConfigWith } from '../src/features/notify/saveCore.ts';
import { sendNotifyTest } from '../src/features/notify/sendTest.ts';
import { sendTelegramNotification } from '../src/features/notify/telegram.ts';
import { renderNotifyTemplate } from '../src/features/notify/template.ts';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function createDb() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(
    readFileSync(
      new URL(
        '../packages/cf-worker-googlesheet/migrations/0004_notify_claims.sql',
        import.meta.url
      ),
      'utf8'
    )
  );
  return {
    raw,
    prepare(sql) {
      return {
        bind(...params) {
          return {
            sql,
            params,
            async first() {
              return raw.prepare(sql).get(...params) ?? null;
            },
          };
        },
      };
    },
    async batch(statements) {
      raw.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) {
          const prepared = raw.prepare(statement.sql);
          if (/^\s*select\b/i.test(statement.sql)) {
            results.push({ results: prepared.all(...statement.params), meta: { changes: 0 } });
          } else {
            const info = prepared.run(...statement.params);
            results.push({ results: [], meta: { changes: info.changes } });
          }
        }
        raw.exec('COMMIT');
        return results;
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

async function call(db, method, path, body) {
  const request = new Request(`https://worker.test${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await handleNotifyRequest(request, db);
  assert.ok(response);
  return { status: response.status, body: await response.json() };
}

async function seedSince(db, targetId, scope = 'jenkins-build') {
  return call(db, 'POST', '/api/notify/since', { scope, targetId, create: true });
}

function deliverPorts(db, targets, sendTelegram) {
  const telegram = [];
  const workerBodies = [];
  return {
    telegram,
    workerBodies,
    loadToken: async () => 'secret-token',
    loadTargets: async () => targets,
    getClientId: async () => 'client-a',
    async request(path, body) {
      workerBodies.push(body);
      return call(db, 'POST', path, body);
    },
    async sendTelegram(token, chatId, text) {
      telegram.push({ token, chatId, text });
      return sendTelegram ? sendTelegram(token, chatId, text) : 'ok';
    },
  };
}

test('canonical chat id strips leading zeros and rejects usernames', () => {
  assert.equal(canonicalChatId(' 0123 '), '123');
  assert.equal(canonicalChatId('-0123'), '-123');
  assert.equal(canonicalChatId('@name'), null);
});

test('kv increase inserts, refuses smaller or equal values, and any may overwrite', async () => {
  const db = createDb();
  const inserted = await call(db, 'PUT', '/api/kv', {
    key: 'cursor',
    value: '43',
    type: 'number',
    order: 'increase',
  });
  assert.equal(inserted.body.updated, true);
  assert.equal(inserted.body.value, '43');

  const smaller = await call(db, 'PUT', '/api/kv', {
    key: 'cursor',
    value: '41',
    type: 'number',
    order: 'increase',
  });
  assert.equal(smaller.body.updated, false);
  assert.equal(smaller.body.value, '43');

  const same = await call(db, 'PUT', '/api/kv', {
    key: 'cursor',
    value: '43',
    type: 'number',
    order: 'increase',
  });
  assert.equal(same.body.updated, false);
  assert.equal(same.body.value, '43');

  const overwritten = await call(db, 'PUT', '/api/kv', {
    key: 'cursor',
    value: '41',
    type: 'number',
    order: 'any',
  });
  assert.equal(overwritten.body.updated, true);
  assert.equal(overwritten.body.value, '41');

  const rejected = await call(db, 'PUT', '/api/kv', {
    key: 'other',
    value: '41abc',
    type: 'number',
    order: 'increase',
  });
  assert.equal(rejected.status, 400);
  assert.equal(
    db.raw.prepare('SELECT value FROM kv_entries WHERE entry_key = ?').get('other'),
    undefined
  );

  db.raw
    .prepare('INSERT INTO kv_entries (entry_key, value, updated_at) VALUES (?, ?, ?)')
    .run('bad', '41abc', 1);
  const kept = await call(db, 'PUT', '/api/kv', {
    key: 'bad',
    value: '42',
    type: 'number',
    order: 'increase',
  });
  assert.equal(kept.body.updated, false);
  assert.equal(kept.body.value, '41abc');
});

test('claim is single-use and ack ignores an expired lease', async () => {
  const db = createDb();
  const claimKey = await notifyClaimKey('jenkins-build', '123', 'build-41');
  const first = await call(db, 'POST', '/api/notify/claim', { claimKey, clientId: 'client-a' });
  const second = await call(db, 'POST', '/api/notify/claim', { claimKey, clientId: 'client-b' });
  assert.equal(first.body.granted, true);
  assert.equal(second.body.granted, false);
  assert.equal(second.body.status, 'leased');
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS count FROM notify_claims').get().count, 1);

  db.raw.prepare('UPDATE notify_claims SET lease_until = 0').run();
  const acked = await call(db, 'POST', '/api/notify/ack', { claimKey, clientId: 'client-a' });
  assert.equal(acked.body.updated, true);
  const afterSent = await call(db, 'POST', '/api/notify/claim', { claimKey, clientId: 'client-b' });
  assert.equal(afterSent.body.granted, false);
  assert.equal(afterSent.body.status, 'sent');
});

test('since create keeps the first timestamp and create=false does not insert', async () => {
  const db = createDb();
  const missing = await call(db, 'POST', '/api/notify/since', {
    scope: 'jenkins-build',
    targetId: 'missing',
    create: false,
  });
  assert.equal(missing.status, 404);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS count FROM notify_target_since').get().count, 0);

  await seedSince(db, 'target-a');
  db.raw.prepare('UPDATE notify_target_since SET since_ms = 1').run();
  const again = await seedSince(db, 'target-a');
  assert.equal(again.body.sinceMs, 1);
});

test('deliverOnce sends once per claim and skips events before since', async () => {
  const db = createDb();
  clearNotifySinceCache();
  const seeded = await seedSince(db, 'a');
  const early = deliverPorts(db, [{ id: 'a', chatId: '123' }]);
  const earlyResult = await deliverOnce(
    {
      scope: 'jenkins-build',
      dedupKey: 'https://jenkins.example.com/job/foo/41',
      text: 'hello',
      occurredAt: seeded.body.sinceMs - 1,
    },
    early
  );
  assert.equal(earlyResult.complete, true);
  assert.equal(early.telegram.length, 0);
  assert.equal(
    early.workerBodies.some((body) => body.claimKey),
    false
  );

  clearNotifySinceCache();
  const onTime = deliverPorts(db, [{ id: 'a', chatId: '0123' }]);
  const sent = await deliverOnce(
    {
      scope: 'jenkins-build',
      dedupKey: 'https://jenkins.example.com/job/foo/41',
      text: 'hello',
      occurredAt: seeded.body.sinceMs,
    },
    onTime
  );
  assert.equal(sent.complete, true);
  assert.equal(onTime.telegram.length, 1);
  assert.equal(onTime.telegram[0].chatId, '123');
  assert.equal(JSON.stringify(onTime.workerBodies).includes('secret-token'), false);
  assert.equal(JSON.stringify(onTime.workerBodies).includes('hello'), false);

  const sameChatDb = createDb();
  clearNotifySinceCache();
  await seedSince(sameChatDb, 'a');
  await seedSince(sameChatDb, 'b');
  sameChatDb.raw.prepare('UPDATE notify_target_since SET since_ms = 1').run();
  const duplicate = deliverPorts(sameChatDb, [
    { id: 'b', chatId: '123' },
    { id: 'a', chatId: '123' },
  ]);
  const once = await deliverOnce(
    {
      scope: 'jenkins-build',
      dedupKey: 'https://jenkins.example.com/job/foo/41',
      text: 'hello',
      occurredAt: 1,
    },
    duplicate
  );
  assert.equal(once.complete, true);
  assert.equal(duplicate.telegram.length, 1);

  clearNotifySinceCache();
  await seedSince(db, 'a', 'other-scope');
  const other = deliverPorts(db, [{ id: 'a', chatId: '123' }]);
  await deliverOnce(
    {
      scope: 'other-scope',
      dedupKey: 'https://jenkins.example.com/job/foo/41',
      text: 'hello',
      occurredAt: Date.now(),
    },
    other
  );
  assert.equal(other.telegram.length, 1);
});

test('deliverOnce retries only the target that failed and treats telegram status codes', async () => {
  const db = createDb();
  clearNotifySinceCache();
  await seedSince(db, 'a');
  await seedSince(db, 'b');
  db.raw.prepare('UPDATE notify_target_since SET since_ms = 1').run();
  const occurredAt = 1;
  const input = {
    scope: 'jenkins-build',
    dedupKey: 'https://jenkins.example.com/job/foo/42',
    text: 'hello',
    occurredAt,
  };
  const chats = [];
  const flaky = deliverPorts(
    db,
    [
      { id: 'a', chatId: '1' },
      { id: 'b', chatId: '2' },
    ],
    async (_token, chatId) => {
      chats.push(chatId);
      return chatId === '2' ? 'retry' : 'ok';
    }
  );
  const first = await deliverOnce(input, flaky);
  assert.equal(first.complete, false);
  const second = await deliverOnce(input, flaky);
  assert.deepEqual(chats, ['1', '2', '2']);
  assert.equal(second.complete, false);

  clearNotifySinceCache();
  const permanentDb = createDb();
  const permanentSince = await seedSince(permanentDb, 'a');
  const permanent = deliverPorts(permanentDb, [{ id: 'a', chatId: '9' }], async () => 'permanent');
  const permanentResult = await deliverOnce(
    { ...input, occurredAt: permanentSince.body.sinceMs },
    permanent
  );
  assert.equal(permanentResult.complete, true);
  assert.equal(permanentDb.raw.prepare('SELECT status FROM notify_claims').get().status, 'sent');
  const again = await deliverOnce({ ...input, occurredAt: permanentSince.body.sinceMs }, permanent);
  assert.equal(again.complete, true);
  assert.equal(permanent.telegram.length, 1);

  clearNotifySinceCache();
  const deadDb = createDb();
  const deadSince = await seedSince(deadDb, 'a');
  const dead = deliverPorts(deadDb, [{ id: 'a', chatId: '9' }], async () => 'token_dead');
  const deadResult = await deliverOnce({ ...input, occurredAt: deadSince.body.sinceMs }, dead);
  assert.deepEqual(deadResult, { complete: false, halt: true });
  assert.equal(deadDb.raw.prepare('SELECT status FROM notify_claims').get().status, 'leased');

  clearNotifySinceCache();
  const limited = deliverPorts(db, [{ id: 'a', chatId: '1' }]);
  limited.request = async () => ({ status: 429, body: { error: 'Rate limit exceeded' } });
  const limitedResult = await deliverOnce(input, limited);
  assert.equal(limitedResult.complete, false);
  assert.equal(limitedResult.halt, true);
  assert.equal(limited.telegram.length, 0);
});

test('missing since stays missing and is not created by a scan read', async () => {
  const db = createDb();
  clearNotifySinceCache();
  const ports = deliverPorts(db, [{ id: 'new', chatId: '5' }]);
  const result = await deliverOnce(
    {
      scope: 'jenkins-build',
      dedupKey: 'https://jenkins.example.com/job/foo/1',
      text: 'hello',
      occurredAt: Date.now(),
    },
    ports
  );
  assert.equal(result.complete, false);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS count FROM notify_target_since').get().count, 0);
  assert.equal(
    ports.workerBodies.every((body) => body.create === false),
    true
  );
});

test('save calls since only for new targets and skips dexie when since fails', async () => {
  const events = [];
  let written;
  const ports = {
    hasTeamSync: async () => true,
    loadTargets: async () => [{ id: 'keep' }],
    async createSince(targetId) {
      events.push(`since:${targetId}`);
    },
    async write(next) {
      written = next;
      events.push('write');
    },
  };
  await saveNotifyConfigWith(
    {
      botToken: ' token ',
      targets: [
        { id: 'keep', kind: 'user', label: ' 甲 ', chatId: '0123' },
        { id: 'new', kind: 'group', label: '', chatId: '-01' },
      ],
    },
    ports
  );
  assert.deepEqual(events, ['since:new', 'write']);
  assert.equal(written.botToken, 'token');
  assert.equal(written.targets[0].chatId, '123');
  assert.equal(written.targets[0].label, '甲');
  assert.equal(written.targets[1].chatId, '-1');

  const blocked = {
    ...ports,
    hasTeamSync: async () => false,
    write: async () => events.push('write-2'),
  };
  await assert.rejects(
    saveNotifyConfigWith(
      { botToken: '', targets: [{ id: 'x', kind: 'user', label: '', chatId: '1' }] },
      blocked
    ),
    /团队同步密钥/
  );
  assert.equal(events.includes('write-2'), false);

  const failing = {
    ...ports,
    async createSince() {
      throw new Error('起始时间保存失败');
    },
    async write() {
      events.push('write-3');
    },
  };
  await assert.rejects(
    saveNotifyConfigWith(
      { botToken: '', targets: [{ id: 'fresh', kind: 'user', label: '', chatId: '8' }] },
      failing
    ),
    /起始时间保存失败/
  );
  assert.equal(events.includes('write-3'), false);
  assert.match(source('src/features/notify/saveConfig.ts'), /create:\s*true/);
  assert.doesNotMatch(source('src/features/notify/deliverCore.ts'), /create:\s*true/);
});

test('settings expose the stable notify test ids and the alarm name', () => {
  const section = source('src/entrypoints/options/NotifySettingsSection.tsx');
  for (const testId of [
    'notify-bot-token',
    'notify-target-list',
    'notify-target-add',
    'notify-target-label',
    'notify-target-kind',
    'notify-target-chat-id',
    'notify-target-remove',
    'notify-save',
    'notify-test',
    'notify-message-template',
  ]) {
    assert.match(section, new RegExp(testId));
  }
  assert.match(source('src/features/jenkins/buildNotifyScan.ts'), /jenkins-build-notify-alarm/);
  assert.match(
    source('src/entrypoints/background/backgroundLifecycle.ts'),
    /JENKINS_BUILD_NOTIFY_ALARM/
  );
  assert.match(source('src/features/jenkins/buildNotifyScan.ts'), /jenkins_environments/);
  assert.doesNotMatch(source('src/features/jenkins/buildNotifyScan.ts'), /jenkins_current_env/);
});

test('channel test sends the saved targets and skips unsaved drafts', async () => {
  const saved = [{ id: 'a', kind: 'user', label: '甲', chatId: '123' }];
  const sent = [];
  const ports = {
    async loadToken() {
      return 'token';
    },
    async loadTemplate() {
      return '';
    },
    async loadTargets() {
      return saved;
    },
    async send(token, chatId, text, file) {
      sent.push({ token, chatId, text, file });
      return 'ok';
    },
  };
  const draft = {
    botToken: 'token',
    targets: [{ id: 'a', kind: 'user', label: '甲', chatId: '0123' }],
  };
  assert.equal(await sendNotifyTest(draft, ports), 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].chatId, '123');
  assert.equal(sent[0].text, 'DPP 通道测试');
  assert.equal(sent[0].file, undefined);

  ports.loadTemplate = async () => '{任务} 完成';
  await assert.rejects(sendNotifyTest(draft, ports), /请先保存再试发/);
  assert.equal(await sendNotifyTest({ ...draft, messageTemplate: '{任务} 完成' }, ports), 1);
  assert.equal(sent.at(-1).text, '{任务} 完成');

  ports.loadTemplate = async () => '';

  await assert.rejects(sendNotifyTest({ ...draft, botToken: 'other' }, ports), /请先保存再试发/);
  assert.equal(sent.length, 2);

  ports.send = async () => 'token_dead';
  await assert.rejects(sendNotifyTest(draft, ports), /机器人 Token 无效/);
  assert.doesNotMatch(source('src/features/notify/sendTest.ts'), /notify\/claim|create:\s*true/);
});

test('template escapes html values and drops an empty log block', () => {
  const text = renderNotifyTemplate('<b>{任务}</b>\n<pre>{日志}</pre>', {
    环境: '',
    任务: 'a<b>',
    编号: '1',
    结果: 'SUCCESS',
    触发: '自动',
    标签: '无',
    日志: '',
    链接: 'https://jenkins.example/job/a/1/',
  });
  assert.equal(text, '<b>a&lt;b&gt;</b>');
});

test('a short notice and a log go out as one document', async () => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: init.body });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    assert.equal(
      await sendTelegramNotification('tok', '1', 'hi', { filename: 'a.txt', body: 'log' }),
      'ok'
    );
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/sendDocument$/);
    assert.equal(calls[0].body.get('caption'), 'hi');
    assert.equal(calls[0].body.get('parse_mode'), 'HTML');
    assert.equal(calls[0].body.get('reply_markup'), null);
    assert.equal(calls[0].body.get('document').name, 'a.txt');
    assert.equal(await calls[0].body.get('document').text(), 'log');
  } finally {
    globalThis.fetch = original;
  }
});

test('a build link becomes a button and localhost can be opened', async () => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: init.body });
    return new Response(JSON.stringify({ ok: calls.length > 1 }), { status: calls.length > 1 ? 200 : 400 });
  };
  try {
    const text = '<a href="http://localhost:8080/job/demo/3/">🔗 打开这次构建</a>';
    assert.equal(
      await sendTelegramNotification('tok', '1', text, { filename: 'a.txt', body: 'log' }),
      'ok'
    );
    assert.equal(calls.length, 2);
    assert.equal(
      calls[0].body.get('caption'),
      '<a href="http://127.0.0.1:8080/job/demo/3/">🔗 打开这次构建</a>'
    );
    assert.equal(
      calls[0].body.get('reply_markup'),
      JSON.stringify({
        inline_keyboard: [[{ text: '打开这次构建', url: 'http://127.0.0.1:8080/job/demo/3/' }]],
      })
    );
    assert.equal(calls[1].body.get('reply_markup'), null);
    assert.equal(calls[1].body.get('parse_mode'), 'HTML');
  } finally {
    globalThis.fetch = original;
  }
});

test('a job title link still gets an open button', async () => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    calls.push({ body: init.body });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    assert.equal(
      await sendTelegramNotification(
        'tok',
        '1',
        '<a href="https://jenkins.example/job/foo/7/"><b>🔨 folder/foo #7</b></a>',
        { filename: 'a.txt', body: 'log' }
      ),
      'ok'
    );
    assert.equal(
      calls[0].body.get('reply_markup'),
      JSON.stringify({
        inline_keyboard: [
          [{ text: '打开这次构建', url: 'https://jenkins.example/job/foo/7/' }],
        ],
      })
    );
  } finally {
    globalThis.fetch = original;
  }
});

test('a long notice stays on the same message as the log file', async () => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: init.body });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    const text = 'x'.repeat(1025);
    assert.equal(
      await sendTelegramNotification('tok', '1', text, { filename: 'a.txt', body: 'log' }),
      'ok'
    );
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/sendDocument$/);
    assert.equal(calls[0].body.get('caption').length, 1024);
  } finally {
    globalThis.fetch = original;
  }
});
