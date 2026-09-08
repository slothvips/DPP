import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createConversationMaterialDeepLink,
  parseConversationMaterialDeepLink,
} from '../src/features/aiAssistant/materials/materialDeepLink.ts';

const MATERIAL_ID = '8f7f6f0e-8d83-4e8f-9f6c-1a4d8c9d5b21';

test('conversation material deep links round-trip their material ID', () => {
  const link = createConversationMaterialDeepLink(MATERIAL_ID);

  assert.equal(link, `http://localhost/dpp/material/${MATERIAL_ID}`);
  assert.equal(parseConversationMaterialDeepLink(link), MATERIAL_ID);
});

test('conversation material deep links reject unrelated or malformed URLs', () => {
  const invalidLinks = [
    `https://localhost/dpp/material/${MATERIAL_ID}`,
    `https://example.com/material/${MATERIAL_ID}`,
    `http://localhost/dpp/material/${MATERIAL_ID}?source=test`,
    `http://localhost/dpp/material/${MATERIAL_ID}/extra`,
    'http://localhost/dpp/material/',
    'not a URL',
  ];

  for (const link of invalidLinks) {
    assert.equal(parseConversationMaterialDeepLink(link), undefined, link);
  }
});

test('legacy invalid-host links remain readable', () => {
  assert.equal(
    parseConversationMaterialDeepLink(`https://dpp.invalid/material/${MATERIAL_ID}`),
    MATERIAL_ID
  );
});

test('conversation material deep links reject invalid IDs when creating links', () => {
  assert.throws(() => createConversationMaterialDeepLink(''), /物料 ID 无效/);
  assert.throws(() => createConversationMaterialDeepLink('material/id'), /物料 ID 无效/);
});
