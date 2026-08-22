import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePageAgentApiKey } from '../src/lib/pageAgent/types.ts';
import { resolveActivePageTabId } from '../src/lib/pageAgent/utils.ts';

test('uses the bridge credential when the upstream provider has no API key', () => {
  assert.equal(resolvePageAgentApiKey(), 'dpp-local-bridge');
  assert.equal(resolvePageAgentApiKey(''), 'dpp-local-bridge');
  assert.equal(resolvePageAgentApiKey('  '), 'dpp-local-bridge');
  assert.equal(resolvePageAgentApiKey('provider-key'), 'provider-key');
});

test('selects the injectable active tab from the last focused window', async () => {
  let receivedQuery;
  const tabId = await resolveActivePageTabId(async (query) => {
    receivedQuery = query;
    return [{ id: 42, url: 'https://example.com/task' }];
  });

  assert.deepEqual(receivedQuery, { active: true, lastFocusedWindow: true });
  assert.equal(tabId, 42);
});

test('does not retry another tab query when the active page is not injectable', async () => {
  let queryCount = 0;
  const tabId = await resolveActivePageTabId(async () => {
    queryCount += 1;
    return [{ id: 7, url: 'chrome://settings' }];
  });

  assert.equal(queryCount, 1);
  assert.equal(tabId, null);
});

test('rejects extension pages and tabs without an id', async () => {
  const extensionPage = await resolveActivePageTabId(async () => [
    { id: 8, url: 'chrome-extension://example/pageAgentHost.html' },
  ]);
  const missingId = await resolveActivePageTabId(async () => [{ url: 'https://example.com' }]);

  assert.equal(extensionPage, null);
  assert.equal(missingId, null);
});
