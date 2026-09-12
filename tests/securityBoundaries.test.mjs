import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parsePushRequest } from '../packages/cf-worker-googlesheet/src/lib/requestValidation.ts';
import { detectSheetSchema } from '../packages/cf-worker-googlesheet/src/lib/sheets.ts';
import {
  assertJenkinsRedirectAllowed,
  assertJenkinsUrlAllowed,
  createJenkinsArtifactUrl,
  normalizeJenkinsRootUrl,
} from '../src/features/jenkins/api/urlSafety.ts';

test('Jenkins URLs are restricted to the configured HTTP(S) origin', () => {
  assert.equal(
    normalizeJenkinsRootUrl('https://ci.example.com/jenkins/'),
    'https://ci.example.com/jenkins'
  );
  assert.equal(
    assertJenkinsUrlAllowed(
      'https://ci.example.com/jenkins/job/demo/',
      'https://ci.example.com/jenkins'
    ),
    'https://ci.example.com/jenkins/job/demo/'
  );
  assert.throws(
    () =>
      assertJenkinsUrlAllowed(
        'https://ci.example.com/jenkins-other/job/demo',
        'https://ci.example.com/jenkins'
      ),
    /根路径/
  );
  assert.throws(
    () =>
      assertJenkinsUrlAllowed(
        'https://ci.example.com/jenkins/%2e%2e/admin',
        'https://ci.example.com/jenkins'
      ),
    /路径逃逸/
  );
  assert.throws(
    () => assertJenkinsUrlAllowed('https://attacker.example/job/demo', 'https://ci.example.com'),
    /同一来源/
  );
  assert.throws(
    () => assertJenkinsUrlAllowed('https://ci.example.com:8443/job/demo', 'https://ci.example.com'),
    /同一来源/
  );
  assert.throws(
    () => normalizeJenkinsRootUrl('https://user:secret@ci.example.com'),
    /用户名或密码/
  );
  assert.throws(() => normalizeJenkinsRootUrl('file:///tmp/jenkins'), /HTTP 或 HTTPS/);
  assert.throws(
    () =>
      assertJenkinsRedirectAllowed(
        new Response('', { status: 302 }),
        'https://ci.example.com/jenkins/job/demo/build',
        'https://ci.example.com/jenkins'
      ),
    /缺少目标地址/
  );
  assert.throws(
    () =>
      assertJenkinsRedirectAllowed(
        new Response('', { status: 302, headers: { Location: 'https://attacker.example/' } }),
        'https://ci.example.com/jenkins/job/demo/build',
        'https://ci.example.com/jenkins'
      ),
    /同一来源/
  );
});

test('Jenkins artifact URLs are derived from valid builds and safe relative paths', () => {
  assert.equal(
    createJenkinsArtifactUrl(
      'https://ci.example.com/jenkins/job/team/job/demo/42/',
      'reports/output file.zip',
      'https://ci.example.com/jenkins'
    ),
    'https://ci.example.com/jenkins/job/team/job/demo/42/artifact/reports/output%20file.zip'
  );
  assert.throws(
    () =>
      createJenkinsArtifactUrl(
        'https://ci.example.com/jenkins/job/team/job/demo/',
        'output.zip',
        'https://ci.example.com/jenkins'
      ),
    /有效构建/
  );
  assert.throws(
    () =>
      createJenkinsArtifactUrl(
        'https://ci.example.com/jenkins/job/demo/42/',
        '../config.xml',
        'https://ci.example.com/jenkins'
      ),
    /产物路径/
  );
});

test('proxy URL checks require an exact configured origin', () => {
  const source = readFileSync(new URL('../src/utils/urlSafety.ts', import.meta.url), 'utf8');
  assert.match(source, /allowedOrigins\.has\(parsed\.origin\)/);
  assert.match(source, /parsed\.username \|\| parsed\.password/);
  assert.match(source, /Origin not allowed/);
});

test('Jenkins build logs are restricted to extension pages', () => {
  const authorizationSource = readFileSync(
    new URL('../src/entrypoints/background/messageAuthorization.ts', import.meta.url),
    'utf8'
  );
  const apiSource = readFileSync(
    new URL('../src/features/jenkins/api/buildDetails.ts', import.meta.url),
    'utf8'
  );
  assert.match(authorizationSource, /EXTENSION_ONLY_TYPES[\s\S]*'JENKINS_GET_BUILD_LOG'/);
  assert.match(apiSource, /logText\/progressiveText/);
  assert.match(apiSource, /X-Text-Size/);
  assert.match(apiSource, /X-More-Data/);
});

test('Worker push parser enforces body and structure budgets', async () => {
  const request = new Request('https://worker.example/api/sync/push', {
    method: 'POST',
    body: JSON.stringify({ clientId: 'client-1', ops: [] }),
  });
  assert.deepEqual(await parsePushRequest(request), { clientId: 'client-1', ops: [] });

  const hugeRequest = new Request('https://worker.example/api/sync/push', {
    method: 'POST',
    body: JSON.stringify({ ops: [{ id: 'x', payload: 'x'.repeat(300_000) }] }),
  });
  await assert.rejects(parsePushRequest(hugeRequest), /maximum size/);
});

test('migration sheet schema detection is explicit and read-only compatible', () => {
  assert.equal(
    detectSheetSchema([
      'id',
      'clientId',
      'table',
      'type',
      'key',
      'payload',
      'timestamp',
      'serverTimestamp',
      'keyHash',
    ]),
    'v2'
  );
  assert.equal(
    detectSheetSchema(['id', 'table', 'type', 'key', 'payload', 'timestamp', 'serverTimestamp']),
    'v1'
  );
  assert.throws(() => detectSheetSchema(['id', 'table']), /unsupported/);
});
