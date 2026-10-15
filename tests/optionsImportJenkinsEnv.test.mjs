import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileImportedJenkinsEnv } from '../src/entrypoints/options/reconcileImportedJenkinsEnv.ts';

const ENV_A = { id: 'env-a', name: 'A', host: 'https://a', user: 'u', token: 't', order: 0 };
const ENV_B = { id: 'env-b', name: 'B', host: 'https://b', user: 'u', token: 't', order: 1 };

test('备份缺少 jenkins_current_env 时补为第一个环境', () => {
  const settings = [{ key: 'jenkins_environments', value: [ENV_A, ENV_B] }];
  const result = reconcileImportedJenkinsEnv(settings);
  assert.deepEqual(
    result.find((s) => s.key === 'jenkins_current_env'),
    { key: 'jenkins_current_env', value: 'env-a' }
  );
});

test('current_env 指向不存在的对象时修正为第一个环境', () => {
  const settings = [
    { key: 'jenkins_environments', value: [ENV_A, ENV_B] },
    { key: 'jenkins_current_env', value: 'env-gone' },
  ];
  const result = reconcileImportedJenkinsEnv(settings);
  assert.equal(result.find((s) => s.key === 'jenkins_current_env').value, 'env-a');
});

test('current_env 有效时保持不动', () => {
  const settings = [
    { key: 'jenkins_environments', value: [ENV_A, ENV_B] },
    { key: 'jenkins_current_env', value: 'env-b' },
  ];
  const result = reconcileImportedJenkinsEnv(settings);
  assert.equal(result.find((s) => s.key === 'jenkins_current_env').value, 'env-b');
});

test('未导入 Jenkins 环境时不新增设置', () => {
  const settings = [{ key: 'theme', value: 'dark' }];
  const result = reconcileImportedJenkinsEnv(settings);
  assert.equal(
    result.some((s) => s.key === 'jenkins_current_env'),
    false
  );
});
