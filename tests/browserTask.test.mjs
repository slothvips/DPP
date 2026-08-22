import assert from 'node:assert/strict';
import test from 'node:test';
import {
  areBrowserUrlsEqual,
  parseBrowserTaskArguments,
} from '../src/lib/browserTask/arguments.ts';
import { isTaskGroupTitle, toTaskGroupTitle } from '../src/lib/browserTask/groupTitle.ts';
import { buildActionRecord } from '../src/lib/browserTask/stepRecord.ts';

test('parses browser task tool arguments as strings', () => {
  assert.deepEqual(parseBrowserTaskArguments('{"tabId": 12, "ok": true}', 'browser_switch_tab'), {
    tabId: '12',
    ok: 'true',
  });
});

test('rejects non-object browser task arguments', () => {
  assert.throws(
    () => parseBrowserTaskArguments('[]', 'browser_click'),
    /工具 browser_click 参数无效/
  );
});

test('compares normalized browser target URLs', () => {
  assert.equal(areBrowserUrlsEqual('https://example.com', 'https://example.com/'), true);
  assert.equal(areBrowserUrlsEqual('https://example.com/a', 'https://example.com/b'), false);
});

test('builds task group titles with DPP prefix', () => {
  assert.equal(toTaskGroupTitle('新闻 搜索'), 'DPP · 新闻 搜索');
  assert.equal(toTaskGroupTitle('   '), 'DPP · 网页任务');
});

test('recognizes only DPP task group titles', () => {
  assert.equal(isTaskGroupTitle('DPP · 任意任务'), true);
  assert.equal(isTaskGroupTitle('用户自己的分组'), false);
  assert.equal(isTaskGroupTitle(undefined), false);
});

function makeState(currentTabId, url) {
  return {
    currentTabId,
    tabs: [],
    page: { url, elements: [] },
    recentActions: [],
    visitedUrls: [],
  };
}

test('builds action record with navigation and tab switch info', () => {
  const record = buildActionRecord({
    action: 'browser_click',
    message: '已点击目标元素，并切换到新打开的标签页',
    stateBefore: makeState(1, 'https://example.com/search'),
    stateAfter: makeState(2, 'https://example.com/article/1'),
  });
  assert.equal(record.action, 'browser_click');
  assert.equal(record.urlBefore, 'https://example.com/search');
  assert.equal(record.urlAfter, 'https://example.com/article/1');
  assert.equal(record.tabIdBefore, 1);
  assert.equal(record.tabIdAfter, 2);
  assert.equal(record.switchedToTabId, 2);
  assert.equal(record.navigatedFrom, 'https://example.com/search');
  assert.equal(record.navigatedTo, 'https://example.com/article/1');
  assert.equal(record.error, undefined);
});

test('omits switch and navigation fields when nothing changed', () => {
  const record = buildActionRecord({
    action: 'browser_scroll_page',
    message: '已向下翻页滚动',
    error: false,
    stateBefore: makeState(3, 'https://example.com/list'),
    stateAfter: makeState(3, 'https://example.com/list'),
  });
  assert.equal(record.switchedToTabId, undefined);
  assert.equal(record.navigatedFrom, undefined);
  assert.equal(record.navigatedTo, undefined);
  assert.equal(record.error, undefined);
});

test('marks failed actions in the record', () => {
  const record = buildActionRecord({
    action: 'browser_fill',
    message: '动作失败：目标输入元素不存在',
    error: true,
    stateBefore: makeState(1, 'https://example.com'),
    stateAfter: makeState(1, 'https://example.com'),
  });
  assert.equal(record.error, true);
});
