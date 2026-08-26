import JSZip from 'jszip';
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseInputFile } from '../src/features/aiAssistant/utils/fileParser.ts';

test('parses text and markdown files', async () => {
  const text = await parseInputFile(new File(['登录页面'], 'case.md'));
  assert.equal(text, '登录页面');
});

test('parses modern XMind JSON content as an outline', async () => {
  const archive = new JSZip();
  archive.file(
    'content.json',
    JSON.stringify([
      {
        title: '登录测试',
        rootTopic: {
          title: '打开登录页',
          children: { attached: [{ title: '输入账号密码' }] },
        },
      },
    ])
  );
  const content = await archive.generateAsync({ type: 'uint8array' });
  const parsed = await parseInputFile(new File([content], 'case.xmind'));

  assert.equal(parsed, '# 登录测试\n- 打开登录页\n  - 输入账号密码');
});

test('rejects unsupported files and keeps large text intact', async () => {
  await assert.rejects(
    parseInputFile(new File(['内容'], 'case.pdf')),
    /仅支持 TXT、Markdown 和 XMind/
  );
  const content = 'x'.repeat(20_001);
  assert.equal(await parseInputFile(new File([content], 'case.txt')), content);
});
