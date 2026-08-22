import type { Setting, SettingKey } from '@/db/types';
import type { StoredEncryptedValue } from '@/db/types';
import { isAIProviderType } from '@/lib/ai/providerIds';
import { AI_PROVIDER_DEFINITIONS } from '@/lib/ai/providerRegistry';

export const EXCLUDED_SETTINGS: SettingKey[] = [
  'sync_client_id',
  'last_sync_time',
  'last_sync_status',
  'last_global_sync',
  'global_sync_status',
  'global_sync_error',
  'global_sync_start_time',
  // 个人私钥禁止进入配置导出/导入，避免误分享到团队备份
  'personal_encryption_key',
  'personal_sync_bootstrap_done',
  // 验证器 PIN 仅本机 UI 锁，禁止进入配置备份
  'totp_pin_hash',
  'totp_pin_salt',
  'totp_pin_iterations',
  'totp_pin_auto_lock_minutes',
];

/** 导入配置清空本地库时，仍从本机保留、禁止被备份覆盖的设置 */
export const IMPORT_PRESERVED_SETTINGS: SettingKey[] = [
  'personal_encryption_key',
  'personal_sync_bootstrap_done',
  'totp_pin_hash',
  'totp_pin_salt',
  'totp_pin_iterations',
  'totp_pin_auto_lock_minutes',
];

export const SETTINGS_CATEGORIES: Array<{
  key: string;
  label: string;
  description: string;
  keys: SettingKey[];
}> = [
  {
    key: 'theme',
    label: '主题设置',
    description: '深色/浅色主题',
    keys: ['theme'],
  },
  {
    key: 'feature_toggles',
    label: '功能开关',
    description: '标签页显示开关',
    keys: [
      'feature_hotnews_enabled',
      'feature_links_enabled',
      'feature_blackboard_enabled',
      'feature_jenkins_enabled',
      'feature_recorder_enabled',
      'feature_ai_assistant_enabled',
      'feature_playground_enabled',
      'feature_totp_enabled',
    ],
  },
  {
    key: 'jenkins_envs',
    label: 'Jenkins 环境',
    description: 'Jenkins 服务器配置',
    keys: ['jenkins_environments', 'jenkins_current_env'],
  },
  {
    key: 'sync_settings',
    label: '同步设置',
    description: '服务器地址、访问令牌、加密密钥',
    keys: ['custom_server_url', 'sync_access_token', 'sync_encryption_key'],
  },
  {
    key: 'ai_settings',
    label: 'AI 设置',
    description: 'D仔服务商、模型配置',
    keys: [
      'ai_provider_type',
      'ai_active_profile_id',
      ...AI_PROVIDER_DEFINITIONS.flatMap((provider) => [
        `ai_${provider.id}_base_url` as SettingKey,
        `ai_${provider.id}_model` as SettingKey,
        `ai_${provider.id}_api_key` as SettingKey,
      ]),
    ],
  },
  {
    key: 'display_prefs',
    label: '显示偏好',
    description: '其他显示相关设置',
    keys: ['show_others_builds'],
  },
];

export function getSettingValue<K extends SettingKey>(
  settings: Setting[],
  key: K
): Setting<K>['value'] | undefined {
  const setting = settings.find((item) => item.key === key);
  return setting?.value as Setting<K>['value'] | undefined;
}

export interface ImportedSetting {
  key: SettingKey;
  value: unknown;
}

const VALID_SETTING_KEYS = new Set<SettingKey>([
  ...EXCLUDED_SETTINGS,
  ...SETTINGS_CATEGORIES.flatMap((category) => category.keys),
  'auto_sync_enabled',
  'auto_sync_interval',
  'links_sort_by',
  'jenkins_host',
  'jenkins_user',
  'jenkins_token',
  'ai_base_url',
  'ai_model',
  'ai_api_key',
  ...AI_PROVIDER_DEFINITIONS.map((provider) => `ai_${provider.id}_api_key` as SettingKey),
]);

function isSettingKey(value: unknown): value is SettingKey {
  return typeof value === 'string' && VALID_SETTING_KEYS.has(value as SettingKey);
}

export function isStoredEncryptedValue(value: unknown): value is StoredEncryptedValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const candidate = value as { ciphertext?: unknown; iv?: unknown };
  return typeof candidate.ciphertext === 'string' && typeof candidate.iv === 'string';
}

const BOOLEAN_SETTING_KEYS = new Set<SettingKey>([
  'personal_sync_bootstrap_done',
  'feature_hotnews_enabled',
  'feature_links_enabled',
  'feature_blackboard_enabled',
  'feature_jenkins_enabled',
  'feature_recorder_enabled',
  'feature_ai_assistant_enabled',
  'feature_playground_enabled',
  'feature_totp_enabled',
  'show_others_builds',
  'auto_sync_enabled',
]);

const NUMBER_SETTING_KEYS = new Set<SettingKey>([
  'last_sync_time',
  'last_global_sync',
  'global_sync_start_time',
  'auto_sync_interval',
  'totp_pin_iterations',
  'totp_pin_auto_lock_minutes',
]);

const STRING_SETTING_KEYS = new Set<SettingKey>([
  'last_sync_status',
  'global_sync_error',
  'jenkins_host',
  'jenkins_user',
  'jenkins_token',
  'jenkins_current_env',
  'custom_server_url',
  'sync_access_token',
  'sync_encryption_key',
  'personal_encryption_key',
  'totp_pin_hash',
  'totp_pin_salt',
  'sync_client_id',
  'ai_base_url',
  'ai_model',
  'ai_active_profile_id',
]);

const AI_API_KEY_SETTING_KEYS = new Set<SettingKey>([
  'ai_api_key',
  ...AI_PROVIDER_DEFINITIONS.map((provider) => `ai_${provider.id}_api_key` as SettingKey),
]);

const AI_TEXT_SETTING_KEYS = new Set<SettingKey>(
  AI_PROVIDER_DEFINITIONS.flatMap((provider) => [
    `ai_${provider.id}_base_url` as SettingKey,
    `ai_${provider.id}_model` as SettingKey,
  ])
);

function isStringRecordOfNumbers(value: unknown): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === 'number' && Number.isFinite(item))
  );
}

function isJenkinsEnvironments(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return false;
      }
      const environment = item as Record<string, unknown>;
      return (
        typeof environment.id === 'string' &&
        typeof environment.name === 'string' &&
        typeof environment.host === 'string' &&
        typeof environment.user === 'string' &&
        typeof environment.token === 'string' &&
        typeof environment.order === 'number' &&
        Number.isFinite(environment.order)
      );
    })
  );
}

function isValidImportedSettingValue(key: SettingKey, value: unknown): boolean {
  if (BOOLEAN_SETTING_KEYS.has(key)) {
    return typeof value === 'boolean';
  }
  if (NUMBER_SETTING_KEYS.has(key)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return false;
    }
    if (key === 'auto_sync_interval') {
      return Number.isInteger(value) && value >= 1 && value <= 1440;
    }
    return true;
  }
  if (STRING_SETTING_KEYS.has(key) || AI_TEXT_SETTING_KEYS.has(key)) {
    return typeof value === 'string';
  }
  if (AI_API_KEY_SETTING_KEYS.has(key)) {
    return typeof value === 'string' || isStoredEncryptedValue(value);
  }

  switch (key) {
    case 'theme':
      return value === 'light' || value === 'dark' || value === 'system';
    case 'global_sync_status':
      return value === 'idle' || value === 'syncing' || value === 'partial' || value === 'error';
    case 'jenkins_environments':
      return isJenkinsEnvironments(value);
    case 'jenkins_builds_last_refresh_by_env':
    case 'jenkins_jobs_last_refresh_by_env':
      return isStringRecordOfNumbers(value);
    case 'ai_provider_type':
      return isAIProviderType(value);
    case 'links_sort_by':
      return (
        value === 'createdAt' ||
        value === 'updatedAt' ||
        value === 'usageCount' ||
        value === 'lastUsedAt'
      );
    default:
      return false;
  }
}

function toImportedSetting(value: unknown): ImportedSetting | null {
  if (typeof value !== 'object' || value === null) {
    throw new Error('备份中包含格式无效的设置项');
  }

  const candidate = value as { key?: unknown; value?: unknown };
  if (!isSettingKey(candidate.key)) {
    return null;
  }
  if (!('value' in candidate) || !isValidImportedSettingValue(candidate.key, candidate.value)) {
    throw new Error(`设置 ${candidate.key} 的值无效`);
  }
  return { key: candidate.key, value: candidate.value };
}

export function parseImportedSettings(values: unknown[]): ImportedSetting[] {
  const settings = values
    .map(toImportedSetting)
    .filter((setting): setting is ImportedSetting => setting !== null);
  const keys = new Set<SettingKey>();
  for (const setting of settings) {
    if (keys.has(setting.key)) {
      throw new Error(`备份中包含重复设置：${setting.key}`);
    }
    keys.add(setting.key);
  }
  return settings;
}
