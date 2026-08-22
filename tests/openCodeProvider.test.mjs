import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeOpenCodePageAgentRequest } from '../src/lib/pageAgent/openCodePageAgentProxy.ts';
import {
  createOpenCodeRequestIdentity,
  deriveOpenCodeSessionId,
  getOpenCodeHeaders,
  getOpenCodeModelHeaders,
  isOpenCodeFreeModel,
  normalizeOpenCodeModel,
} from '../src/lib/ai/openCodeProviderShared.ts';

test('recognizes OpenCode free model ids', () => {
  assert.equal(isOpenCodeFreeModel('opencodefree'), true);
  assert.equal(isOpenCodeFreeModel('mimo-v2.5-free'), true);
  assert.equal(isOpenCodeFreeModel('big-pickle'), true);
  assert.equal(isOpenCodeFreeModel('gpt-5.4'), false);
});

test('migrates the retired OpenCode free model alias', () => {
  assert.equal(normalizeOpenCodeModel('opencodefree'), 'big-pickle');
  assert.equal(normalizeOpenCodeModel('mimo-v2.5-free'), 'mimo-v2.5-free');
});

test('normalizes PageAgent requests for OpenCode Free', () => {
  const request = normalizeOpenCodePageAgentRequest({
    model: 'opencodefree',
    messages: [{ role: 'user', content: 'Inspect the page.' }],
    stream: false,
    stream_options: { include_usage: true },
    reasoning_effort: 'low',
    tools: [
      {
        type: 'function',
        function: {
          name: 'inspect_page',
          description: 'Inspect the current page',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: 'required',
  });

  assert.equal(request.model, 'big-pickle');
  assert.equal(request.stream, true);
  assert.equal(request.stream_options, undefined);
  assert.equal(request.reasoning_effort, undefined);
  assert.equal(request.tool_choice, 'required');
  assert.deepEqual(request.tools?.[0]?.function.parameters, {
    type: 'object',
    properties: {},
    required: [],
  });
});

test('preserves business properties named like unsupported schema metadata', () => {
  const request = normalizeOpenCodePageAgentRequest({
    model: 'opencodefree',
    messages: [{ role: 'user', content: 'Inspect the page.' }],
    tools: [
      {
        type: 'function',
        function: {
          name: 'check_flag',
          description: 'Check a flag',
          parameters: {
            type: 'object',
            properties: {
              strict: { type: 'boolean', description: 'A business field' },
            },
            required: ['strict'],
            additionalProperties: false,
          },
        },
      },
    ],
  });

  assert.deepEqual(request.tools?.[0]?.function.parameters, {
    type: 'object',
    properties: {
      strict: { type: 'boolean', description: 'A business field' },
    },
    required: ['strict'],
  });
});

test('creates differentiated OpenCode request headers', () => {
  const identity = createOpenCodeRequestIdentity();
  const first = getOpenCodeHeaders(identity, 'req_one');
  const streamed = getOpenCodeHeaders(identity, 'req_two', { stream: true, apiKey: 'sk-test' });

  assert.equal(first.Authorization, 'Bearer public');
  assert.equal(streamed.Authorization, 'Bearer sk-test');
  assert.equal(first['X-Opencode-Session'], streamed['X-Opencode-Session']);
  assert.equal(first['X-Opencode-Project'], streamed['X-Opencode-Project']);
  assert.equal(first['X-Opencode-Request'], 'req_one');
  assert.equal(streamed['X-Opencode-Request'], 'req_two');
  assert.equal(streamed.Accept, 'text/event-stream');
  assert.equal(getOpenCodeModelHeaders()['X-Opencode-Session'], undefined);
});

test('derives stable sessions from conversation openers', async () => {
  const opener = { role: 'user', content: 'hello' };
  const first = await deriveOpenCodeSessionId([opener]);
  const grown = await deriveOpenCodeSessionId([
    opener,
    { role: 'assistant', content: 'hi' },
    { role: 'user', content: 'next turn' },
  ]);
  const other = await deriveOpenCodeSessionId([{ role: 'user', content: 'other' }]);

  assert.ok(first?.startsWith('ses_'));
  assert.equal(grown, first);
  assert.notEqual(other, first);
});
