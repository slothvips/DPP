import assert from 'node:assert/strict';
import test from 'node:test';
import { describeOpenAIResponseBody } from '../src/lib/ai/openAIResponseGuards.ts';

test('extracts nested error.message from 200-status error payloads', () => {
  assert.equal(
    describeOpenAIResponseBody({ error: { code: '1113', message: 'Insufficient balance' } }),
    'Insufficient balance'
  );
});

test('extracts string-form error payloads', () => {
  assert.equal(describeOpenAIResponseBody({ error: 'rate limited' }), 'rate limited');
});

test('extracts top-level message field', () => {
  assert.equal(describeOpenAIResponseBody({ message: 'quota exceeded' }), 'quota exceeded');
});

test('falls back to truncated raw body snippet', () => {
  const described = describeOpenAIResponseBody({ id: 'x', model: 'y', unexpected: true });
  assert.ok(described.includes('"id":"x"'));
});

test('describes empty responses', () => {
  assert.equal(describeOpenAIResponseBody(undefined), '(空响应)');
  assert.ok(describeOpenAIResponseBody({}).length > 0);
});
