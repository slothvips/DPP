import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateAIConfig } from '../src/features/aiAssistant/lib/aiConfigDialogValidation.ts';

const hookSource = readFileSync(
  new URL('../src/features/aiAssistant/hooks/useAIConfigDialog.ts', import.meta.url),
  'utf8'
);
const storageSource = readFileSync(
  new URL('../src/features/aiAssistant/lib/aiConfigStorage.ts', import.meta.url),
  'utf8'
);

const validConfig = {
  provider: 'anthropic',
  profileName: '工作账号',
  apiKey: 'secret',
  baseUrl: 'https://api.example.com',
  model: 'example-model',
  visionEnabled: false,
};

test('AI config validation requires predictable connection fields', () => {
  assert.deepEqual(validateAIConfig(validConfig), {});
  assert.deepEqual(
    validateAIConfig({ ...validConfig, profileName: '' }).profileName,
    '请输入配置名称'
  );
  assert.deepEqual(validateAIConfig({ ...validConfig, apiKey: '' }).apiKey, '请输入 API Key');
  assert.match(validateAIConfig({ ...validConfig, baseUrl: 'invalid' }).baseUrl, /http/);
  assert.deepEqual(validateAIConfig({ ...validConfig, model: '' }).model, '请输入模型名称');
});

test('OpenCode config does not require a profile name or API key', () => {
  assert.deepEqual(
    validateAIConfig({
      ...validConfig,
      provider: 'opencode',
      profileName: '',
      apiKey: '',
    }),
    {}
  );
});

test('AI config editing preserves unsaved input and the active provider', () => {
  assert.match(hookSource, /const toastRef = useRef\(toast\)/);
  assert.match(hookSource, /toastRef\.current\('读取 AI 配置失败，请稍后重试', 'error'\)/);
  assert.match(hookSource, /isDirty &&[\s\S]*await confirm\('当前修改尚未保存/);
  assert.match(
    storageSource,
    /isActive: activeProvider !== 'opencode' && profile\.id === activeProfileId/
  );
  assert.match(
    storageSource,
    /normalizeProviderValue\(activeProviderValue as unknown\) === 'opencode'[\s\S]*updateSetting\('ai_active_profile_id', ''\)/
  );
});
