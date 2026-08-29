import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractPromptVariableKeys,
  renderPromptTemplate,
} from '../src/features/aiAssistant/materials/promptTemplate.ts';
import { buildPromptMaterialsSection } from '../src/lib/ai/promptMaterials.ts';

test('prompt templates extract unique variable keys in source order', () => {
  assert.deepEqual(
    extractPromptVariableKeys('审查 {{language}} 项目 {{project}}，再次使用 {{language}}。'),
    ['language', 'project']
  );
});

test('prompt templates render values and defaults without evaluating expressions', () => {
  const variables = [
    { key: 'language', label: '语言', required: true },
    { key: 'tone', label: '语气', required: false, defaultValue: '简洁' },
  ];
  assert.equal(
    renderPromptTemplate('使用 {{language}}，语气 {{tone}}。{{unknown}}', variables, {
      language: 'TypeScript',
    }),
    '使用 TypeScript，语气 简洁。{{unknown}}'
  );
  assert.throws(() => renderPromptTemplate('{{language}}', variables, {}), /请填写变量/);
});

test('prompt system section describes the material tool contract', () => {
  const prompt = buildPromptMaterialsSection();
  assert.match(prompt, /prompt_list/);
  assert.match(prompt, /prompt_get/);
  assert.match(prompt, /{{variable}}/);
  assert.match(prompt, /不提升为 system 规则/);
});
