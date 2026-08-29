import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parsePushRequest } from '../packages/cf-worker-googlesheet/src/lib/requestValidation.ts';
import { detectSheetSchema } from '../packages/cf-worker-googlesheet/src/lib/sheets.ts';
import {
  assertJenkinsUrlAllowed,
  normalizeJenkinsRootUrl,
} from '../src/features/jenkins/api/urlSafety.ts';

test('Jenkins URLs are restricted to the configured HTTP(S) origin', () => {
  assert.equal(
    normalizeJenkinsRootUrl('https://ci.example.com/jenkins/'),
    'https://ci.example.com/jenkins'
  );
  assert.equal(
    assertJenkinsUrlAllowed('https://ci.example.com/job/demo/', 'https://ci.example.com/jenkins'),
    'https://ci.example.com/job/demo/'
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
});

test('proxy URL checks require an exact configured origin', () => {
  const source = readFileSync(new URL('../src/utils/urlSafety.ts', import.meta.url), 'utf8');
  assert.match(source, /allowedOrigins\.has\(parsed\.origin\)/);
  assert.match(source, /parsed\.username \|\| parsed\.password/);
  assert.match(source, /Origin not allowed/);
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
