import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import {
  StatsRateLimitError,
  assertUnderIpRateLimit,
  validateStatsBatch,
} from '../packages/cf-worker-googlesheet/src/lib/stats.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
let server;
let tracker;
let trackEvent;
let events;
let sender;

before(async () => {
  server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
    resolve: { alias: { '@': path.join(root, 'src') } },
  });
  [tracker, events, sender] = await Promise.all([
    server.ssrLoadModule('/src/lib/analytics/tracker.ts'),
    server.ssrLoadModule('/src/lib/analytics/events.ts'),
    server.ssrLoadModule('/src/lib/analytics/sender.ts'),
  ]);
  trackEvent = tracker.trackEvent;
});

after(async () => {
  await server?.close();
});

// ---------- 服务端 batch 校验（纯函数） ----------

const validEvent = { ts: 1726646400000, module: 'links', action: 'link_opened' };
const validUuid = '123e4567-e89b-42d3-a456-426614174000';

function makeBatch(overrides = {}) {
  return {
    v: 1,
    instanceId: validUuid,
    extVersion: '0.10.0',
    browser: 'chrome',
    events: [validEvent],
    ...overrides,
  };
}

test('validateStatsBatch accepts a valid batch', () => {
  const batch = validateStatsBatch(makeBatch());
  assert.equal(batch.v, 1);
  assert.equal(batch.instanceId, validUuid);
  assert.equal(batch.events.length, 1);
  assert.equal(batch.events[0].module, 'links');
});

test('validateStatsBatch rejects wrong version, bad ids and empty events', () => {
  assert.throws(() => validateStatsBatch(makeBatch({ v: 2 })));
  assert.throws(() => validateStatsBatch(makeBatch({ instanceId: 'not-a-uuid' })));
  assert.throws(() => validateStatsBatch(makeBatch({ instanceId: 'x'.repeat(70) })));
  assert.throws(() => validateStatsBatch(makeBatch({ events: [] })));
  assert.throws(() => validateStatsBatch(null));
  assert.throws(() => validateStatsBatch('nope'));
});

test('validateStatsBatch rejects oversized batches', () => {
  const events = Array.from({ length: 201 }, () => ({ ...validEvent }));
  assert.throws(() => validateStatsBatch(makeBatch({ events })));
});

test('validateStatsBatch rejects names outside the allow pattern', () => {
  for (const bad of ['Links', '1abc', 'link opened', 'link.opened', 'x'.repeat(65), '']) {
    assert.throws(() => validateStatsBatch(makeBatch({ events: [{ ...validEvent, module: bad }] })));
    assert.throws(() => validateStatsBatch(makeBatch({ events: [{ ...validEvent, action: bad }] })));
  }
});

test('validateStatsBatch rejects bad values and meta', () => {
  assert.throws(() =>
    validateStatsBatch(makeBatch({ events: [{ ...validEvent, value: Number.NaN }] }))
  );
  assert.throws(() =>
    validateStatsBatch(makeBatch({ events: [{ ...validEvent, value: 'many' }] }))
  );
  assert.throws(() =>
    validateStatsBatch(
      makeBatch({ events: [{ ...validEvent, meta: { nested: { a: 1 } } }] })
    )
  );
  assert.throws(() =>
    validateStatsBatch(makeBatch({ events: [{ ...validEvent, meta: { long: 'y'.repeat(65) } }] }))
  );
  assert.throws(() =>
    validateStatsBatch(makeBatch({ events: [{ ...validEvent, meta: ['a'] }] }))
  );
});

test('assertUnderIpRateLimit caps a single IP then resets after the window', () => {
  const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
  const now = Date.now();
  assert.doesNotThrow(() => assertUnderIpRateLimit(ip, 20_000, now));
  assert.throws(() => assertUnderIpRateLimit(ip, 1, now), StatsRateLimitError);
  assert.doesNotThrow(() => assertUnderIpRateLimit(ip, 1, now + 60 * 60_000));
});

test('validateStatsBatch keeps coarse meta and trims optional fields', () => {
  const batch = validateStatsBatch(
    makeBatch({
      events: [{ ...validEvent, value: 42, meta: { ok: true, tool: 'calculator', count: 3 } }],
    })
  );
  assert.equal(batch.events[0].value, 42);
  assert.deepEqual(batch.events[0].meta, { ok: true, tool: 'calculator', count: 3 });

  const minimal = validateStatsBatch({ v: 1, instanceId: validUuid, events: [validEvent] });
  assert.equal(minimal.extVersion, undefined);
  assert.equal(minimal.browser, undefined);
});

// ---------- 客户端 tracker 零影响 ----------

test('track helpers never throw on valid input', () => {
  assert.doesNotThrow(() => {
    events.trackLinks('linkOpened');
    events.trackJenkins('jobTriggered');
    events.trackAiAssistant('messageSent', { meta: { hasTools: true } });
    events.trackPlayground('toolOpened', { meta: { tool: 'json' } });
    events.trackFeaturePresence('jenkins', 'featureOpened');
    events.trackFeaturePresence('hotNews', 'featureOpened');
    events.trackFeaturePresence('jenkins', 'featureClosed', { value: 12 });
  });
});

test('persistAndFlushAnalytics never throws', async () => {
  await assert.doesNotReject(() => tracker.persistAndFlushAnalytics());
});

test('track helpers never throw on invalid or hostile input', () => {
  assert.doesNotThrow(() => {
    trackEvent({ module: 'Links', action: 'x' });
    trackEvent({ module: 'links', action: 'link opened' });
    trackEvent({ module: 'links', action: 'link_opened', value: Number.NaN });
    trackEvent({
      module: 'links',
      action: 'link_opened',
      meta: { url: 'https://secret.example/path', long: 'z'.repeat(200) },
    });
    trackEvent({ module: 'links', action: 'link_opened', meta: { bad: {} } });
  });
});

test('unknown actions are ignored without throwing', () => {
  assert.doesNotThrow(() => {
    events.trackLinks('nonExistentAction');
    events.trackFeaturePresence('jenkins', 'nonExistent');
  });
});

test('resolveAnalyticsEndpoint follows the configured sync server', () => {
  assert.equal(
    sender.resolveAnalyticsEndpoint('https://sync-test.example.com'),
    'https://sync-test.example.com/api/stats/events'
  );
  assert.equal(
    sender.resolveAnalyticsEndpoint('https://sync-test.example.com/'),
    'https://sync-test.example.com/api/stats/events'
  );
  assert.equal(
    sender.resolveAnalyticsEndpoint('https://sync.example.com'),
    'https://sync.example.com/api/stats/events'
  );
  assert.equal(sender.resolveAnalyticsEndpoint(''), null);
  assert.equal(sender.resolveAnalyticsEndpoint('not-a-url'), null);
  assert.equal(sender.resolveAnalyticsEndpoint('ftp://example.com'), null);
  assert.equal(sender.resolveAnalyticsEndpoint('https://user:pass@evil.example'), null);
});

test('stats catalog labels every registered analytics action', async () => {
  const { STATS_CATALOG } = await server.ssrLoadModule(
    '/packages/cf-worker-googlesheet/src/lib/statsCatalog.ts'
  );
  const maps = {
    links: events.LINKS_EVENTS,
    jenkins: events.JENKINS_EVENTS,
    aiAssistant: events.AI_ASSISTANT_EVENTS,
    recorder: events.RECORDER_EVENTS,
    blackboard: events.BLACKBOARD_EVENTS,
    hotnews: events.HOTNEWS_EVENTS,
    totp: events.TOTP_EVENTS,
    playground: events.PLAYGROUND_EVENTS,
    settings: events.SETTINGS_EVENTS,
    sync: events.SYNC_EVENTS,
    error: events.ERROR_EVENTS,
  };
  for (const [moduleId, actionMap] of Object.entries(maps)) {
    assert.ok(STATS_CATALOG[moduleId], `missing module ${moduleId}`);
    for (const action of Object.values(actionMap)) {
      assert.ok(
        STATS_CATALOG[moduleId].actions[action],
        `missing catalog entry ${moduleId}.${action}`
      );
    }
  }
  const presenceModules = [
    'links',
    'jenkins',
    'aiAssistant',
    'recorder',
    'blackboard',
    'hotnews',
    'totp',
    'playground',
  ];
  for (const action of Object.values(events.FRAME_EVENTS)) {
    for (const moduleId of presenceModules) {
      assert.ok(
        STATS_CATALOG[moduleId].actions[action],
        `missing presence action ${moduleId}.${action}`
      );
    }
  }
});

test('stats dashboard html uses Chinese labels for operators', async () => {
  const { renderStatsDashboard } = await server.ssrLoadModule(
    '/packages/cf-worker-googlesheet/src/lib/statsDashboard.ts'
  );
  const html = renderStatsDashboard();
  assert.match(html, /DPP 使用洞察/);
  assert.match(html, /打开链接/);
  assert.match(html, /助手回复成功/);
  assert.match(html, /动作词典/);
  assert.match(html, /区间汇总/);
});
