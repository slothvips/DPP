import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const source = readFileSync(
  new URL('../src/features/aiAssistant/utils/exportChatToMarkdown.ts', import.meta.url),
  'utf8'
);
const executableSource = stripTypeScriptTypes(source).replace(
  "'@/utils/sensitive'",
  `'${new URL('../src/utils/sensitive.ts', import.meta.url).href}'`
);
const { exportChatToMarkdown } = await import(
  `data:text/javascript,${encodeURIComponent(executableSource)}`
);

test('chat export preserves order, includes reasoning, and redacts tool secrets', () => {
  const markdown = exportChatToMarkdown(
    [
      { id: '1', role: 'user', content: 'first', createdAt: Date.UTC(2026, 8, 2) },
      { id: '2', role: 'user', content: 'second', createdAt: Date.UTC(2026, 8, 1) },
      {
        id: '3',
        role: 'assistant',
        content: 'third',
        createdAt: Date.UTC(2026, 8, 2),
        providerMetadata: {
          anthropicContentBlocks: [{ type: 'thinking', thinking: 'private reasoning' }],
        },
        toolCalls: [
          {
            id: 'tool-1',
            type: 'function',
            function: { name: 'request', arguments: '{"apiKey":"secret-value","query":"ok"}' },
          },
        ],
      },
    ],
    'Test session'
  );

  assert.ok(markdown.indexOf('first') < markdown.indexOf('second'));
  assert.ok(markdown.indexOf('second') < markdown.indexOf('third'));
  assert.match(markdown, /1 次思考/);
  assert.match(markdown, /> private reasoning/);
  assert.match(markdown, /"apiKey": "\[redacted\]"/);
  assert.doesNotMatch(markdown, /secret-value/);
});

test('anthropic text blocks are not counted as reasoning', () => {
  const markdown = exportChatToMarkdown(
    [
      {
        id: '1',
        role: 'assistant',
        content: 'answer',
        createdAt: Date.UTC(2026, 8, 2),
        providerMetadata: { anthropicContentBlocks: [{ type: 'text', text: 'answer' }] },
      },
    ],
    'Test session'
  );

  assert.match(markdown, /0 次思考/);
});
