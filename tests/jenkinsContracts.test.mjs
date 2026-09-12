import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createJenkinsHttpError,
  createJenkinsNetworkError,
} from '../src/features/jenkins/api/contracts.ts';
import { createFakeJenkinsFixture } from './fixtures/fakeJenkins.mjs';

test('fake Jenkins fixture records requests and returns typed responses', async () => {
  const fixture = createFakeJenkinsFixture({
    'GET /api/json': { body: { jobs: [] } },
  });
  const response = await fixture.fetch('https://ci.example.com/api/json');
  assert.deepEqual(await response.json(), { jobs: [] });
  assert.deepEqual(fixture.calls[0], {
    method: 'GET',
    url: 'https://ci.example.com/api/json',
    body: undefined,
  });
});

test('Jenkins HTTP errors retain actionable categories', () => {
  assert.equal(createJenkinsHttpError(new Response('', { status: 401 })).code, 'authentication');
  assert.equal(
    createJenkinsHttpError(new Response('', { status: 403 }), 'crumb expired').code,
    'csrf'
  );
  assert.equal(createJenkinsHttpError(new Response('', { status: 404 })).code, 'not_found');
  assert.equal(createJenkinsHttpError(new Response('', { status: 429 })).code, 'rate_limited');
  assert.equal(createJenkinsNetworkError(new Error('请求超时')).code, 'timeout');
  assert.equal(createJenkinsNetworkError(new TypeError('fetch failed')).code, 'offline');
});
