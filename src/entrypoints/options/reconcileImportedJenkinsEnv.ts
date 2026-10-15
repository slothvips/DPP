import type { JenkinsEnvironment } from '@/db/types';
import type { ImportedSetting } from './optionsShared';

/**
 * 导入 Jenkins 环境后对齐 jenkins_current_env。
 * 旧备份可能缺少该项，或指向不存在的对象 id，都会导致面板误判「未配置 Jenkins」，
 * 这里统一修正为指向导入的第一个环境。
 */
export function reconcileImportedJenkinsEnv(settings: ImportedSetting[]): ImportedSetting[] {
  const environmentsEntry = settings.find((setting) => setting.key === 'jenkins_environments');
  if (!environmentsEntry || !Array.isArray(environmentsEntry.value)) {
    return settings;
  }
  const environments = environmentsEntry.value as JenkinsEnvironment[];
  if (environments.length === 0 || typeof environments[0]?.id !== 'string') {
    return settings;
  }

  const envIds = new Set(environments.map((environment) => environment.id));
  const currentEntry = settings.find((setting) => setting.key === 'jenkins_current_env');
  const currentEnvId = typeof currentEntry?.value === 'string' ? currentEntry.value : '';
  if (envIds.has(currentEnvId)) {
    return settings;
  }

  const fallbackId = environments[0].id;
  if (currentEntry) {
    currentEntry.value = fallbackId;
  } else {
    settings.push({ key: 'jenkins_current_env', value: fallbackId });
  }
  return settings;
}
