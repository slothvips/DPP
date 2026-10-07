import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractBuildFailure,
  formatBuildNotifyText,
  jenkinsBuildDedupKey,
  jenkinsJobCursorKey,
  notifyClientLabel,
  scanJenkinsBuildNotifications,
} from '../src/features/jenkins/buildNotifyCore.ts';

const finished = (number, extra = {}) => ({
  kind: 'build',
  build: {
    url: `https://jenkins.example.com/job/foo/${number}/`,
    result: 'SUCCESS',
    timestamp: 1_700_000_000_000 + number,
    building: false,
    ...extra,
  },
});

function basePorts(overrides = {}) {
  const events = [];
  const ports = {
    events,
    loadToken: async () => 'token',
    hasTargets: async () => true,
    loadEnvironments: async () => [
      {
        id: 'env',
        name: '生产',
        host: 'https://jenkins.example.com',
        user: 'u',
        token: 't',
        order: 0,
      },
    ],
    listJobs: async () => ({
      ok: true,
      jobs: [
        {
          name: 'foo',
          fullName: 'folder/foo',
          url: 'https://jenkins.example.com/job/foo/',
          lastBuildNumber: 43,
        },
      ],
    }),
    fetchBuild: async (_env, _url, number) => {
      events.push(`fetch:${number}`);
      return finished(number);
    },
    getKv: async () => {
      events.push('kv');
      return { status: 200, value: '40', updated: false };
    },
    putKv: async (_key, value) => {
      events.push(`put:${value}`);
      return { status: 200, value, updated: true };
    },
    deliverOnce: async (input) => {
      events.push(`deliver:${input.dedupKey}`);
      return { complete: true };
    },
    ...overrides,
  };
  return ports;
}

test('build dedup keys keep the number and cursor keys follow the host', async () => {
  assert.notEqual(
    jenkinsBuildDedupKey('https://jenkins.example.com/job/foo/41/'),
    jenkinsBuildDedupKey('https://jenkins.example.com/job/foo/42/')
  );
  const prod = await jenkinsJobCursorKey('https://Jenkins-Prod.example.com/job/foo/');
  assert.equal(prod, await jenkinsJobCursorKey('https://jenkins-prod.example.com:443/job/foo'));
  assert.notEqual(prod, await jenkinsJobCursorKey('https://jenkins-test.example.com/job/foo'));
});

test('builds older than the notify floor are skipped without a send', async () => {
  const delivered = [];
  const logs = [];
  const ports = basePorts({
    getKv: async () => ({ status: 200, value: '', updated: false }),
    listJobs: async () => ({
      ok: true,
      jobs: [
        {
          name: 'foo',
          url: 'https://jenkins.example.com/job/foo/',
          lastBuildNumber: 30,
        },
      ],
    }),
    loadFloor: async () => 1_700_000_000_000 + 28.5,
    loadLog: async (_env, url) => {
      logs.push(url);
      return 'log';
    },
    deliverOnce: async (input) => {
      delivered.push(input.dedupKey);
      return { complete: true };
    },
  });
  await scanJenkinsBuildNotifications(ports);
  const url = (number) => `https://jenkins.example.com/job/foo/${number}/`;
  assert.deepEqual(delivered, [29, 30].map((number) => jenkinsBuildDedupKey(url(number))));
  assert.deepEqual(logs, [url(29), url(30)]);
  assert.equal(ports.events.includes('fetch:1'), false);
});

test('a job whose latest build is already old jumps the cursor in one write', async () => {
  const ports = basePorts({
    getKv: async () => ({ status: 200, value: '', updated: false }),
    listJobs: async () => ({
      ok: true,
      jobs: [
        {
          name: 'foo',
          url: 'https://jenkins.example.com/job/foo/',
          lastBuildNumber: 30,
        },
      ],
    }),
    loadFloor: async () => 1_700_000_000_000 + 100,
    deliverOnce: async () => {
      throw new Error('should not deliver');
    },
  });
  await scanJenkinsBuildNotifications(ports);
  assert.deepEqual(
    ports.events.filter((event) => event.startsWith('fetch:')),
    ['fetch:30']
  );
  assert.deepEqual(
    ports.events.filter((event) => event.startsWith('put:')),
    ['put:30']
  );
});

test('scan reads the cursor first and advances one finished build at a time', async () => {
  const ports = basePorts();
  await scanJenkinsBuildNotifications(ports);
  assert.deepEqual(ports.events, [
    'kv',
    'fetch:41',
    `deliver:${jenkinsBuildDedupKey('https://jenkins.example.com/job/foo/41/')}`,
    'put:41',
    'fetch:42',
    `deliver:${jenkinsBuildDedupKey('https://jenkins.example.com/job/foo/42/')}`,
    'put:42',
    'fetch:43',
    `deliver:${jenkinsBuildDedupKey('https://jenkins.example.com/job/foo/43/')}`,
    'put:43',
  ]);
});

test('scan does not write the cursor when the build is unfinished, missing, or undelivered', async () => {
  for (const fetchBuild of [
    async () => ({ kind: 'build', build: { ...finished(41).build, building: true } }),
    async () => ({ kind: 'build', build: { ...finished(41).build, result: null } }),
    async () => ({ kind: 'not_found' }),
  ]) {
    const ports = basePorts({
      fetchBuild,
      deliverOnce: async () => {
        throw new Error('should not deliver');
      },
    });
    await scanJenkinsBuildNotifications(ports);
    assert.equal(
      ports.events.some((event) => event.startsWith('put:')),
      false
    );
  }

  const undelivered = basePorts({
    deliverOnce: async () => ({ complete: false }),
  });
  await scanJenkinsBuildNotifications(undelivered);
  assert.equal(
    undelivered.events.some((event) => event.startsWith('put:')),
    false
  );
});

test('scan covers every environment and skips work without a token or target', async () => {
  const listed = [];
  const ports = basePorts({
    loadEnvironments: async () => [
      { id: 'later', name: '后', host: 'https://b.example.com', user: 'u', token: 't', order: 2 },
      { id: 'blank', name: '空', host: '', user: '', token: '', order: 0 },
      { id: 'sooner', name: '先', host: 'https://a.example.com', user: 'u', token: 't', order: 1 },
    ],
    async listJobs(env) {
      listed.push(env.id);
      return { ok: env.id !== 'later', jobs: [] };
    },
  });
  await scanJenkinsBuildNotifications(ports);
  assert.deepEqual(listed, ['sooner', 'later']);

  const idle = basePorts({
    loadToken: async () => '  ',
    listJobs: async () => {
      throw new Error('should not list jobs');
    },
    getKv: async () => {
      throw new Error('should not read kv');
    },
  });
  await scanJenkinsBuildNotifications(idle);
  await scanJenkinsBuildNotifications(
    basePorts({ hasTargets: async () => false, listJobs: idle.listJobs, getKv: idle.getKv })
  );
});

test('a farther cursor skips the builds in between', async () => {
  const fetched = [];
  const ports = basePorts({
    listJobs: async () => ({
      ok: true,
      jobs: [
        {
          name: 'foo',
          url: 'https://jenkins.example.com/job/foo/',
          lastBuildNumber: 45,
        },
      ],
    }),
    fetchBuild: async (_env, _url, number) => {
      fetched.push(number);
      return finished(number, number === 41 ? {} : { userName: '别人' });
    },
    putKv: async (_key, value) => ({
      status: 200,
      value: value === '41' ? '43' : value,
      updated: value !== '41',
    }),
  });
  await scanJenkinsBuildNotifications(ports);
  assert.deepEqual(fetched, [41, 44, 45]);
});

test('scan notifies other people and builds without a username', async () => {
  const texts = [];
  const ports = basePorts({
    getKv: async () => ({ status: 200, value: '', updated: false }),
    listJobs: async () => ({
      ok: true,
      jobs: [
        { name: 'b', url: 'https://jenkins.example.com/job/b/', lastBuildNumber: 1 },
        {
          name: 'a',
          fullName: '队列/a',
          url: 'https://jenkins.example.com/job/a/',
          lastBuildNumber: 1,
        },
      ],
    }),
    fetchBuild: async (_env, url, number) =>
      finished(number, {
        url: `${url}${number}`,
        ...(url.includes('/job/a/') ? { userName: '别人' } : {}),
      }),
    deliverOnce: async (input) => {
      texts.push(input.text);
      return { complete: true };
    },
  });
  await scanJenkinsBuildNotifications(ports);
  assert.match(texts[0], /成功/);
  assert.match(texts[0], /队列\/a #1/);
  assert.match(texts[0], /别人/);
  assert.match(texts[0], /🏗 环境　<b>生产<\/b>/);
  assert.match(texts[0], /🌐 地址　<code>jenkins\.example\.com<\/code>/);
  assert.match(texts[0], /🏷 DPP标签　无/);
  assert.match(texts[1], /自动/);
});

test('a log placeholder attaches the console and shows the tail', async () => {
  const sent = [];
  let reads = 0;
  const ports = basePorts({
    getKv: async () => ({ status: 200, value: '42', updated: false }),
    loadLog: async () => {
      reads += 1;
      return 'Finished: FAILURE';
    },
    deliverOnce: async (input) => {
      sent.push(input);
      return { complete: true };
    },
  });
  await scanJenkinsBuildNotifications(ports);
  assert.equal(reads, 1);
  assert.equal(sent[0].file.body, 'Finished: FAILURE');
  assert.equal(sent[0].file.filename, '日志-folder_foo-43.txt');
  assert.doesNotMatch(sent[0].text, /Finished: FAILURE/);
  assert.match(sent[0].text, /💥 错误　无/);

  const skipped = basePorts({
    getKv: async () => ({ status: 200, value: '42', updated: false }),
    loadTemplate: async () => '{任务} 结束了',
    loadLog: async () => {
      reads += 1;
      return 'should-not-fetch';
    },
    deliverOnce: async (input) => {
      sent.push(input);
      return { complete: true };
    },
  });
  await scanJenkinsBuildNotifications(skipped);
  assert.equal(reads, 2);
  assert.equal(sent.at(-1).file.body, 'should-not-fetch');
  assert.equal(sent.at(-1).text, 'folder/foo 结束了');
});

test('scan puts a failed build reason in the message', async () => {
  const sent = [];
  const ports = basePorts({
    getKv: async () => ({ status: 200, value: '42', updated: false }),
    fetchBuild: async (_env, _url, number) => finished(number, { result: 'FAILURE' }),
    loadLog: async () => 'ERROR: script returned exit code 2\nFinished: FAILURE\n',
    deliverOnce: async (input) => {
      sent.push(input);
      return { complete: true };
    },
  });
  await scanJenkinsBuildNotifications(ports);
  assert.match(sent[0].text, /💥 错误　ERROR: script returned exit code 2/);
  assert.doesNotMatch(sent[0].text, /Finished: FAILURE/);
});

test('a failed build shows the log reason and a success does not', () => {
  const maven = extractBuildFailure(`[INFO] compile
[ERROR] Failed to execute goal compiler:compile: cannot find symbol
[ERROR] 
[ERROR] To see the full stack trace of the errors, re-run Maven with the -e switch.
[ERROR] [Help 1] http://cwiki.apache.org/confluence/display/MAVEN/MojoFailureException
Finished: FAILURE
`);
  assert.equal(maven, '[ERROR] Failed to execute goal compiler:compile: cannot find symbol');

  const pipeline = extractBuildFailure('script returned exit code 1\nFinished: FAILURE\n');
  assert.equal(pipeline, 'script returned exit code 1');

  const specific = extractBuildFailure(`+ npm test
Error: Cannot find module 'left-pad'
    at Function.Module._resolveFilename
script returned exit code 1
ERROR: script returned exit code 1
Finished: FAILURE
`);
  assert.match(specific, /Cannot find module 'left-pad'/);
  assert.doesNotMatch(specific, /script returned exit code/);
  assert.doesNotMatch(specific, /_resolveFilename/);

  const plain = extractBuildFailure('make: *** [all] Error 1\nFinished: FAILURE\n');
  assert.match(plain, /Error 1/);

  const note = '////4EB67y7uvWuCfx1EJYnMoeQCaIuw5NUgYLa0MTF2/+gDAAAApR+LCAAAAAAAAP9tjTEOwjAUQ3+KAAAA==';
  const annotated = extractBuildFailure(
    `\u001b[8mha:${note}\u001b[0m[Pipeline] { (Boom)\n\u001b[8mha:${note}\u001b[0m[Pipeline] error\n\u001b[8mha:${note}\u001b[0mERROR: intentional failure\nFinished: FAILURE\n`
  );
  assert.equal(annotated, 'ERROR: intentional failure');
  assert.equal(
    extractBuildFailure(`ha:${note}[Pipeline] error\nFinished: FAILURE\n`),
    ''
  );

  const text = formatBuildNotifyText({
    envName: '生产',
    jobName: 'folder/foo',
    number: 7,
    result: 'FAILURE',
    trigger: '张三',
    buildUrl: 'https://jenkins.example/job/foo/7/',
    failure: pipeline,
  });
  assert.match(text, /💥 错误　script returned exit code 1/);
  assert.doesNotMatch(text, /Finished: FAILURE/);
});

test('the sending client is browser, system, and a short id', () => {
  const id = 'a1b2c3d4-1111-2222-3333-444444444444';
  assert.equal(
    notifyClientLabel(
      id,
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ),
    'Chrome · macOS · a1b2c3d4'
  );
  assert.equal(
    notifyClientLabel(
      id,
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
    ),
    'Edge · Windows · a1b2c3d4'
  );
  assert.equal(notifyClientLabel(id, ''), 'a1b2c3d4');
  const text = formatBuildNotifyText({
    envName: '生产',
    jobName: 'folder/foo',
    number: 7,
    result: 'SUCCESS',
    trigger: '张三',
    buildUrl: 'https://jenkins.example/job/foo/7/',
    client: 'Chrome · macOS · a1b2c3d4',
  });
  assert.match(text, /💻 通知发出者　<code>Chrome · macOS · a1b2c3d4<\/code>/);
});

test('the default message shows the build facts and leaves the log out', () => {
  const text = formatBuildNotifyText({
    envName: '生产',
    jobName: 'folder/foo',
    number: 7,
    result: 'FAILURE',
    trigger: '张三',
    buildUrl: 'https://jenkins.example/job/foo/7/',
    tags: '#后端',
    startedAt: Date.UTC(2026, 0, 2, 3, 4, 5),
    durationMs: 125000,
    node: 'agent-1',
    cause: 'Started by user 张三',
    parameters: 'BRANCH=main',
    changes: 'abc1234 fix',
    artifacts: 'app.jar',
    description: 'nightly',
    envHost: 'https://jenkins.example/',
  });
  assert.match(text, /<b>🔴 失败<\/b>\n<a href="https:\/\/jenkins\.example\/job\/foo\/7\/"><b>🔨 folder\/foo #7<\/b><\/a>/);
  assert.doesNotMatch(text, /打开这次构建/);
  assert.match(text, /🏗 环境　<b>生产<\/b>/);
  assert.match(text, /🌐 地址　<code>jenkins\.example<\/code>/);
  assert.match(text, /👤 触发　<b>张三<\/b>/);
  assert.match(text, /⏱ 耗时　<b>2分5秒<\/b>/);
  assert.match(text, /🕐 开始　<code>/);
  assert.match(text, /🖥 节点　<code>agent-1<\/code>/);
  assert.match(text, /💬 来源　用户 张三/);
  assert.match(text, /⚙ 参数　BRANCH=main/);
  assert.match(text, /🔀 变更　abc1234 fix/);
  assert.match(text, /📦 产物　app\.jar/);
  assert.match(text, /📝 说明　<i>nightly<\/i>/);
  assert.match(text, /💥 错误　无/);
  assert.match(text, /🏷 /);
  assert.doesNotMatch(text, /<pre>/);

  const sparse = formatBuildNotifyText({
    envName: 'http://localhost:8080',
    envHost: 'http://localhost:8080/',
    jobName: 'folder/foo',
    number: 7,
    result: 'SUCCESS',
    trigger: '张三',
    buildUrl: 'https://jenkins.example/job/foo/7/',
    startedAt: Date.UTC(2026, 0, 2, 3, 4, 5),
  });
  assert.match(sparse, /🏗 环境　<b>localhost:8080<\/b>/);
  assert.match(sparse, /🌐 地址　<code>localhost:8080<\/code>/);
  assert.match(sparse, /💥 错误　无/);
  assert.match(sparse, /⚙ 参数　无/);
  assert.match(sparse, /🔀 变更　无/);
  assert.match(sparse, /📦 产物　无/);
  assert.match(sparse, /📝 说明　<i>无<\/i>/);
  assert.match(sparse, /🏷 DPP标签　无/);
});

test('every result keeps the same rows', () => {
  const labels = (result) =>
    formatBuildNotifyText({
      envName: '生产',
      envHost: 'https://jenkins.example/',
      jobName: 'folder/foo',
      number: 1,
      result,
      trigger: '张三',
      buildUrl: 'https://jenkins.example/job/foo/1/',
      failure: result === 'SUCCESS' ? '' : 'boom',
    })
      .replace(/<[^>]+>/g, '')
      .match(/环境　|地址　|触发　|耗时　|开始　|节点　|来源　|错误　|参数　|变更　|产物　|说明　|DPP标签　|通知发出者　/g)
      ?.map((label) => label.trim());
  const success = labels('SUCCESS');
  assert.deepEqual(success, [
    '环境',
    '地址',
    'DPP标签',
    '触发',
    '耗时',
    '开始',
    '节点',
    '来源',
    '错误',
    '参数',
    '变更',
    '产物',
    '说明',
    '通知发出者',
  ]);
  for (const result of ['FAILURE', 'UNSTABLE', 'ABORTED', 'NOT_BUILT']) {
    assert.deepEqual(labels(result), success);
  }
});

test('aborted builds keep the error row and an empty log still attaches', async () => {
  const sent = [];
  const aborted = basePorts({
    getKv: async () => ({ status: 200, value: '42', updated: false }),
    fetchBuild: async (_env, _url, number) => finished(number, { result: 'ABORTED' }),
    loadLog: async () => 'Aborted by admin\nFinished: ABORTED\n',
    deliverOnce: async (input) => {
      sent.push(input);
      return { complete: true };
    },
  });
  await scanJenkinsBuildNotifications(aborted);
  assert.match(sent[0].text, /⚪ 已中止/);
  assert.match(sent[0].text, /💥 错误　Aborted by admin/);
  assert.match(sent[0].file.filename, /^日志-/);

  const empty = basePorts({
    getKv: async () => ({ status: 200, value: '42', updated: false }),
    loadLog: async () => {
      throw new Error('down');
    },
    deliverOnce: async (input) => {
      sent.push(input);
      return { complete: true };
    },
  });
  await scanJenkinsBuildNotifications(empty);
  assert.equal(sent.at(-1).file.body, '无');
  assert.match(sent.at(-1).text, /💥 错误　无/);
});

test('scan uses a saved message template', async () => {
  const texts = [];
  const ports = basePorts({
    getKv: async () => ({ status: 200, value: '42', updated: false }),
    loadTemplate: async () => '{任务} 结束了',
    deliverOnce: async (input) => {
      texts.push(input.text);
      return { complete: true };
    },
  });
  await scanJenkinsBuildNotifications(ports);
  assert.deepEqual(texts, ['folder/foo 结束了']);
});

test('one pass handles at most 20 builds', async () => {
  const fetched = [];
  const ports = basePorts({
    getKv: async () => ({ status: 200, value: '', updated: false }),
    listJobs: async () => ({
      ok: true,
      jobs: [{ name: 'foo', url: 'https://jenkins.example.com/job/foo/', lastBuildNumber: 25 }],
    }),
    fetchBuild: async (_env, _url, number) => {
      fetched.push(number);
      return finished(number);
    },
  });
  await scanJenkinsBuildNotifications(ports);
  assert.equal(fetched.length, 20);
  assert.equal(fetched[19], 20);
});
