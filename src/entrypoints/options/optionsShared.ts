import type { Setting, SettingKey } from '@/db/types';

export const EXCLUDED_SETTINGS: SettingKey[] = [
  'sync_client_id',
  'last_sync_time',
  'last_sync_status',
  'last_global_sync',
  'global_sync_status',
  'global_sync_error',
  'global_sync_start_time',
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
    ],
  },
  {
    key: 'jenkins_envs',
    label: 'Jenkins 环境',
    description: 'Jenkins 服务器配置',
    keys: ['jenkins_environments', 'jenkins_current_env'],
  },
  {
    key: 'jenkins_tg',
    label: 'Jenkins TG 通知',
    description: '发布构建群通知配置',
    keys: [
      'jenkins_tg_notification_enabled',
      'jenkins_tg_bot_token',
      'jenkins_tg_chat_id',
      'jenkins_tg_release_keywords',
    ],
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
      'ai_ollama_base_url',
      'ai_ollama_model',
      'ai_anthropic_base_url',
      'ai_anthropic_model',
      'ai_anthropic_api_key',
      'ai_custom_base_url',
      'ai_custom_model',
      'ai_custom_api_key',
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
  'ai_ollama_api_key',
]);

function isSettingKey(value: unknown): value is SettingKey {
  return typeof value === 'string' && VALID_SETTING_KEYS.has(value as SettingKey);
}

export function isImportedSetting(value: unknown): value is ImportedSetting {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { key?: unknown };
  return isSettingKey(candidate.key);
}
