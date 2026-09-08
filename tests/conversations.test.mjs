import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('conversation materials preserve the complete message payload and are immutable', () => {
  const types = source('../src/features/aiAssistant/materials/testCaseTypes.ts');
  const conversations = source('../src/lib/db/conversations.ts');
  const persistence = source('../src/features/aiAssistant/services/aiChatPersistence.ts');
  const syncApply = source('../src/lib/sync/SyncEngine.apply.ts');

  assert.match(types, /role: 'user' \| 'assistant' \| 'system' \| 'tool'/);
  assert.match(types, /toolCalls\?: OpenAIToolCall\[\]/);
  assert.match(types, /providerMetadata\?: ProviderMessageMetadata/);
  assert.match(conversations, /immutable: true/);
  assert.match(conversations, /createSessionFromConversation/);
  assert.doesNotMatch(conversations, /deleteConversationMaterial|updateConversationMaterial/);
  assert.doesNotMatch(persistence, /sanitizeTool|redactSensitiveJsonObject/);
  assert.match(syncApply, /Ignoring deletion of immutable conversation material/);
  assert.match(syncApply, /Ignoring update of immutable conversation material/);
});

test('conversation sharing loads the selected session instead of the visible chat', () => {
  const facade = source('../src/features/aiAssistant/hooks/useAIChatFacade.ts');

  assert.match(facade, /shareSession/);
  assert.match(facade, /getMessagesBySession\(targetSessionId\)/);
  assert.match(facade, /getSessionStatus\(targetSessionId\) !== 'idle'/);
});

test('all materials view includes project-level test materials', () => {
  const library = source('../src/features/aiAssistant/components/AIMaterialLibraryView.tsx');
  const assistant = source('../src/features/aiAssistant/components/AIAssistantView.tsx');
  const prompts = source('../src/features/aiAssistant/components/PromptMaterialLibraryView.tsx');
  const conversations = source(
    '../src/features/aiAssistant/components/ConversationMaterialLibraryView.tsx'
  );

  assert.match(library, /const testProjectHeader/);
  assert.match(library, /onGenerateTestCase/);
  assert.match(library, /aria-label="生成测试用例提示词"/);
  assert.match(library, /aria-label="导入生成的测试用例"/);
  assert.match(assistant, /navigator\.clipboard\.writeText\(TEST_CASE_GENERATE_PROMPT\)/);
  assert.match(assistant, /生成测试用例提示词已复制/);
  assert.match(library, /renderFeed=\{\(conversationItems, conversationItemsLoading\) => \(/);
  assert.match(library, /additionalItems=\{\[\.\.\.projectItems, \.\.\.conversationItems\]\}/);
  assert.match(library, /<TestProjectLibraryView/);
  assert.doesNotMatch(library, /testCaseFeedItems|onExecuteTestCase=/);
  assert.match(library, /selectedType === 'conversation' \? \(\s*conversationContent/);
  assert.match(prompts, /sort\(\(left, right\) => right\.updatedAt - left\.updatedAt\)/);
  assert.match(conversations, /renderFeed\(items, isLoading\)/);
  assert.match(conversations, /updatedAt: material\.updatedAt/);
});
