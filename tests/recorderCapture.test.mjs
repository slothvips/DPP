import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_CLONE_DEPTH,
  MAX_CLONE_STRING_LENGTH,
  deepClone,
} from '../src/entrypoints/console-interceptor/clone.ts';
import {
  appendStreamChunk,
  createStreamAccumulator,
} from '../src/entrypoints/network-interceptor/streamShared.ts';
import {
  MAX_PLUGIN_EVENTS,
  createRecordingCaptureBuffer,
  pushRecordingEvent,
} from '../src/entrypoints/recorder/captureBudget.ts';
import { redactRecordingEventsForExport } from '../src/lib/db/recorderExportRedaction.ts';
import {
  CAPTURE_TRUNCATED_MARK,
  MAX_CAPTURED_TEXT_CHARS,
  readResponseTextLimited,
  redactCapturedText,
  redactCapturedUrl,
  redactHeaders,
} from '../src/utils/captureSanitize.ts';

test('sensitive headers are replaced and ordinary headers stay', () => {
  const headers = redactHeaders({
    Authorization: 'Bearer secret-token',
    Cookie: 'sid=abc',
    'Set-Cookie': 'sid=abc',
    'X-Api-Key': 'key-value',
    Accept: 'application/json',
  });

  assert.equal(headers.Authorization, '[redacted]');
  assert.equal(headers.Cookie, '[redacted]');
  assert.equal(headers['Set-Cookie'], '[redacted]');
  assert.equal(headers['X-Api-Key'], '[redacted]');
  assert.equal(headers.Accept, 'application/json');
});

test('json, query, bearer and basic secrets are redacted while business fields stay', () => {
  const json = redactCapturedText('{"name":"order","token":"sekret","note":"ok"}');
  assert.equal(json.truncated, false);
  assert.match(json.text, /"name":"order"/);
  assert.match(json.text, /"token":"\[redacted\]"/);
  assert.doesNotMatch(json.text, /sekret/);

  const url = redactCapturedUrl('https://shop.example/orders?token=sekret&q=shoes');
  assert.match(url, /q=shoes/);
  assert.match(url, /token=\[redacted\]/);
  assert.doesNotMatch(url, /sekret/);

  const bearer = redactCapturedText('Authorization: Bearer abc.def');
  assert.match(bearer.text, /Bearer \[redacted\]/);
  assert.doesNotMatch(bearer.text, /abc\.def/);

  const basic = redactCapturedText('Authorization: Basic dXNlcjpwYXNz');
  assert.match(basic.text, /Basic \[redacted\]/);
  assert.doesNotMatch(basic.text, /dXNlcjpwYXNz/);
});

test('captured text and stream bodies truncate with a marker', () => {
  const huge = redactCapturedText('a'.repeat(MAX_CAPTURED_TEXT_CHARS + 20));
  assert.equal(huge.truncated, true);
  assert.ok(huge.text.endsWith(CAPTURE_TRUNCATED_MARK));
  assert.ok(huge.text.length <= MAX_CAPTURED_TEXT_CHARS);

  const stream = createStreamAccumulator();
  appendStreamChunk(stream, 'b'.repeat(MAX_CAPTURED_TEXT_CHARS), 8);
  appendStreamChunk(stream, 'overflow', 8);
  appendStreamChunk(stream, 'token=should-not-grow', 8);
  assert.equal(stream.truncated, true);
  assert.ok(stream.body.endsWith(CAPTURE_TRUNCATED_MARK));
  assert.ok(stream.body.length <= MAX_CAPTURED_TEXT_CHARS);
  assert.equal(stream.chunks.length, 2);
  assert.doesNotMatch(stream.body, /should-not-grow/);
});

test('limited response reads stop once the captured text cap is reached', async () => {
  let pulls = 0;
  const stream = new ReadableStream({
    pull(controller) {
      pulls += 1;
      controller.enqueue(new TextEncoder().encode('a'.repeat(8 * 1024)));
    },
  });

  const limited = await readResponseTextLimited(new Response(stream));
  assert.equal(limited.truncated, true);
  assert.ok(limited.text.endsWith(CAPTURE_TRUNCATED_MARK));
  assert.ok(limited.text.length <= MAX_CAPTURED_TEXT_CHARS);
  assert.ok(pulls < 100);
});

test('console deep clone stops at depth and long strings', () => {
  let nested = { leaf: 'end' };
  for (let index = 0; index < MAX_CLONE_DEPTH + 3; index += 1) {
    nested = { child: nested };
  }
  const cloned = deepClone(nested);
  assert.match(JSON.stringify(cloned), /depth-limit/);

  const longText = deepClone('x'.repeat(MAX_CLONE_STRING_LENGTH + 50));
  assert.equal(typeof longText, 'string');
  assert.ok(longText.endsWith('...[truncated]'));
  assert.ok(longText.length <= MAX_CLONE_STRING_LENGTH);

  const bytes = new Uint8Array(1_000);
  bytes[0] = 7;
  bytes[255] = 9;
  const clonedBytes = deepClone(bytes);
  assert.equal(clonedBytes.__truncated__, true);
  assert.equal(clonedBytes.data.length, 256);
  assert.equal(clonedBytes.data[0], 7);
  assert.equal(clonedBytes.data[255], 9);
});

test('export redaction removes authorization from plugin events', () => {
  const events = redactRecordingEventsForExport([
    {
      type: 6,
      timestamp: 1,
      data: {
        plugin: 'rrweb/network@1',
        payload: {
          type: 'network',
          timestamp: 1,
          data: {
            url: 'https://api.example/login?password=sekret',
            requestHeaders: { Authorization: 'Basic dXNlcjpwYXNz', Accept: 'application/json' },
            requestBody: '{"password":"sekret","user":"ada"}',
          },
        },
      },
    },
    {
      type: 6,
      timestamp: 2,
      data: {
        plugin: 'rrweb/console@1',
        payload: {
          type: 'console',
          timestamp: 2,
          data: {
            args: ['Bearer abc.def', { token: 'sekret', name: 'ada' }],
            stack: 'token=sekret',
          },
        },
      },
    },
    { type: 3, timestamp: 3, data: { source: 1 } },
  ]);

  const serialized = JSON.stringify(events);
  assert.doesNotMatch(serialized, /dXNlcjpwYXNz/);
  assert.doesNotMatch(serialized, /sekret/);
  assert.doesNotMatch(serialized, /abc\.def/);
  assert.match(serialized, /ada/);
  assert.match(serialized, /application\/json/);
  assert.equal(events[2].type, 3);
});

test('plugin events past the recording budget are dropped after one truncation marker', () => {
  const buffer = createRecordingCaptureBuffer();
  pushRecordingEvent(buffer, { type: 2, timestamp: 1, data: {} });
  for (let index = 0; index < MAX_PLUGIN_EVENTS + 5; index += 1) {
    pushRecordingEvent(buffer, {
      type: 6,
      timestamp: index,
      data: {
        plugin: 'rrweb/network@1',
        payload: { type: 'network', timestamp: index, data: { url: `https://example/${index}` } },
      },
    });
  }

  const pluginEvents = buffer.events.filter((event) => event.type === 6);
  assert.equal(pluginEvents.length, MAX_PLUGIN_EVENTS + 1);
  assert.match(JSON.stringify(pluginEvents.at(-1)), /\[truncated\]/);
  assert.equal(buffer.events[0].type, 2);
});
