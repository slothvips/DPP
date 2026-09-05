import { browser } from 'wxt/browser';
import { db } from '@/db';
import type { JenkinsEnvironment, SettingKey, SettingValue } from '@/db/types';
import { AI_PROVIDER_TYPES } from '@/lib/ai/providerIds';
import { AI_PROVIDER_DEFINITIONS } from '@/lib/ai/providerRegistry';
import { getSetting } from '@/lib/db/settings';
import { logger } from '@/utils/logger';
import { VALIDATION_LIMITS, validateLength } from '@/utils/validation';
import { createToolParameter, toolRegistry } from '../tools';
import type { ToolHandler } from '../tools';

type ConfigValueType = 'boolean' | 'json' | 'number' | 'string';

interface ConfigDefinition {
  category: string;
  description: string;
  sensitive?: boolean;
  type: ConfigValueType;
  enum?: readonly string[];
  writable: boolean;
}

interface ConfigEntry {
  key: SettingKey;
  category: string;
  description: string;
  type: ConfigValueType;
  enum?: string[];
  writable: boolean;
  configured: boolean;
  value: unknown;
}

type AIProviderSettingKey = Extract<SettingKey, `ai_${string}_${'api_key' | 'base_url' | 'model'}`>;

const AI_PROVIDER_CONFIG_DEFINITIONS = Object.fromEntries(
  AI_PROVIDER_DEFINITIONS.flatMap((provider) => [
    [
      `ai_${provider.id}_base_url`,
      {
        category: 'ai',
        description: `${provider.label} 基础 URL`,
        type: 'string',
        writable: true,
      },
    ],
    [
      `ai_${provider.id}_model`,
      {
        category: 'ai',
        description: `${provider.label} 模型`,
        type: 'string',
        writable: true,
      },
    ],
    [
      `ai_${provider.id}_api_key`,
      {
        category: 'ai',
        description: `${provider.label} API 密钥`,
        sensitive: true,
        type: 'string',
        writable: true,
      },
    ],
  ])
) as Record<AIProviderSettingKey, ConfigDefinition>;

const DPP_CONFIG_DEFINITIONS = {
  theme: {
    category: 'appearance',
    description: 'DPP 主题模式',
    type: 'string',
    enum: ['light', 'dark'],
    writable: true,
  },
  last_sync_time: {
    category: 'runtime',
    description: '上次同步时间戳',
    type: 'number',
    writable: false,
  },
  last_sync_status: {
    category: 'runtime',
    description: '上次同步状态',
    type: 'string',
    writable: false,
  },
  global_sync_status: {
    category: 'runtime',
    description: '全局同步运行状态',
    type: 'string',
    enum: ['idle', 'syncing', 'partial', 'error'],
    writable: false,
  },
  global_sync_phase: {
    category: 'runtime',
    description: '当前全局同步阶段',
    type: 'string',
    enum: ['idle', 'database', 'database-push', 'database-pull', 'jenkins', 'hotNews'],
    writable: false,
  },
  global_sync_error: {
    category: 'runtime',
    description: '全局同步运行错误',
    type: 'string',
    writable: false,
  },
  last_global_sync: {
    category: 'runtime',
    description: '上次全局同步时间戳',
    type: 'number',
    writable: false,
  },
  jenkins_host: {
    category: 'jenkins',
    description: '旧版 Jenkins 服务器地址',
    type: 'string',
    writable: true,
  },
  jenkins_user: {
    category: 'jenkins',
    description: '旧版 Jenkins 用户名',
    type: 'string',
    writable: true,
  },
  jenkins_token: {
    category: 'jenkins',
    description: '旧版 Jenkins API Token',
    sensitive: true,
    type: 'string',
    writable: true,
  },
  jenkins_environments: {
    category: 'jenkins',
    description: 'Jenkins 环境列表',
    sensitive: true,
    type: 'json',
    writable: true,
  },
  jenkins_current_env: {
    category: 'jenkins',
    description: '当前 Jenkins 环境 ID',
    type: 'string',
    writable: true,
  },
  custom_server_url: {
    category: 'sync',
    description: 'DPP 同步服务器 URL',
    type: 'string',
    writable: true,
  },
  sync_access_token: {
    category: 'sync',
    description: 'DPP 同步访问令牌',
    sensitive: true,
    type: 'string',
    writable: true,
  },
  sync_encryption_key: {
    category: 'sync',
    description: 'DPP 同步加密密钥',
    sensitive: true,
    type: 'string',
    writable: true,
  },
  personal_encryption_key: {
    category: 'security',
    description: '私有数据的个人加密密钥（切勿分享；不是团队同步密钥）',
    sensitive: true,
    type: 'string',
    writable: false,
  },
  personal_sync_bootstrap_done: {
    category: 'runtime',
    description: '个人同步表是否已加入操作队列',
    type: 'boolean',
    writable: false,
  },
  feature_hotnews_enabled: {
    category: 'features',
    description: '显示热榜功能',
    type: 'boolean',
    writable: true,
  },
  feature_links_enabled: {
    category: 'features',
    description: '显示链接功能',
    type: 'boolean',
    writable: true,
  },
  feature_blackboard_enabled: {
    category: 'features',
    description: '显示便签功能',
    type: 'boolean',
    writable: true,
  },
  feature_jenkins_enabled: {
    category: 'features',
    description: '显示 Jenkins 功能',
    type: 'boolean',
    writable: true,
  },
  feature_recorder_enabled: {
    category: 'features',
    description: '显示录制功能',
    type: 'boolean',
    writable: true,
  },
  feature_ai_assistant_enabled: {
    category: 'features',
    description: '显示 D 仔功能',
    type: 'boolean',
    writable: true,
  },
  feature_playground_enabled: {
    category: 'features',
    description: '显示 Playground 功能',
    type: 'boolean',
    writable: true,
  },
  feature_totp_enabled: {
    category: 'features',
    description: '显示 TOTP 验证器功能',
    type: 'boolean',
    writable: true,
  },
  sync_client_id: {
    category: 'runtime',
    description: 'DPP 同步客户端 ID',
    sensitive: true,
    type: 'string',
    writable: false,
  },
  global_sync_start_time: {
    category: 'runtime',
    description: '全局同步开始时间戳',
    type: 'number',
    writable: false,
  },
  show_others_builds: {
    category: 'display',
    description: '显示其他用户触发的 Jenkins 构建',
    type: 'boolean',
    writable: true,
  },
  jenkins_builds_last_refresh_by_env: {
    category: 'runtime',
    description: '按环境记录的 Jenkins 构建上次刷新时间',
    type: 'json',
    writable: false,
  },
  jenkins_jobs_last_refresh_by_env: {
    category: 'runtime',
    description: '按环境记录的 Jenkins 任务上次刷新时间',
    type: 'json',
    writable: false,
  },
  auto_sync_enabled: {
    category: 'sync',
    description: '启用自动同步',
    type: 'boolean',
    writable: true,
  },
  auto_sync_interval: {
    category: 'sync',
    description: '自动同步间隔（分钟）',
    type: 'number',
    writable: true,
  },
  ai_provider_type: {
    category: 'ai',
    description: '当前 D 仔 AI 服务商',
    type: 'string',
    enum: AI_PROVIDER_TYPES,
    writable: true,
  },
  ai_active_profile_id: {
    category: 'ai',
    description: '当前 AI 配置档案 ID',
    type: 'string',
    writable: true,
  },
  ai_base_url: {
    category: 'ai',
    description: '旧版 AI 基础 URL',
    type: 'string',
    writable: true,
  },
  ai_model: {
    category: 'ai',
    description: '旧版 AI 模型',
    type: 'string',
    writable: true,
  },
  ai_api_key: {
    category: 'ai',
    description: '旧版 AI API 密钥',
    sensitive: true,
    type: 'string',
    writable: true,
  },
  ai_opencode_vision_enabled: {
    category: 'ai',
    description: '允许当前 OpenCode 模型接收浏览器截图',
    type: 'boolean',
    writable: true,
  },
  ...AI_PROVIDER_CONFIG_DEFINITIONS,
  links_sort_by: {
    category: 'links',
    description: '链接排序字段',
    type: 'string',
    enum: ['createdAt', 'updatedAt', 'usageCount', 'lastUsedAt'],
    writable: true,
  },
  totp_pin_hash: {
    category: 'security',
    description: 'TOTP PIN 哈希（仅用于本地界面锁定）',
    sensitive: true,
    type: 'string',
    writable: false,
  },
  totp_pin_salt: {
    category: 'security',
    description: 'TOTP PIN 盐值',
    sensitive: true,
    type: 'string',
    writable: false,
  },
  totp_pin_iterations: {
    category: 'security',
    description: 'TOTP PIN PBKDF2 迭代次数',
    type: 'number',
    writable: false,
  },
  totp_pin_auto_lock_minutes: {
    category: 'security',
    description: 'TOTP PIN 自动锁定的空闲分钟数（0 = 仅在离开时锁定）',
    type: 'number',
    writable: false,
  },
} as const satisfies Record<SettingKey, ConfigDefinition>;

const SYNC_RELATED_SETTING_KEYS = new Set<SettingKey>([
  'auto_sync_enabled',
  'auto_sync_interval',
  'custom_server_url',
  'sync_access_token',
]);

function isSettingKey(value: unknown): value is SettingKey {
  return typeof value === 'string' && value in DPP_CONFIG_DEFINITIONS;
}

function getConfigDefinition(key: SettingKey): ConfigDefinition {
  return DPP_CONFIG_DEFINITIONS[key];
}

function getRequestedKeys(args: Record<string, unknown>): SettingKey[] {
  const keysValue = args.keys;
  if (keysValue === undefined) {
    return Object.keys(DPP_CONFIG_DEFINITIONS) as SettingKey[];
  }

  if (typeof keysValue !== 'string') {
    throw new Error('keys must be a comma-separated string');
  }

  return keysValue
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean)
    .map((key) => {
      if (!isSettingKey(key)) {
        throw new Error(`Unknown DPP config key: ${key}`);
      }
      return key;
    });
}

function parseObjectArgs(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    throw new Error('Arguments must be an object');
  }
  return args as Record<string, unknown>;
}

function toDisplayValue(key: SettingKey, value: unknown): unknown {
  const definition = getConfigDefinition(key);
  if (definition.sensitive) {
    return null;
  }

  return value ?? null;
}

function validateValue(key: SettingKey, value: unknown): unknown {
  const definition = getConfigDefinition(key);

  if (!definition.writable) {
    throw new Error(`${key} is runtime-managed and cannot be updated by D仔`);
  }
  if (definition.sensitive) {
    throw new Error(`${key} contains sensitive data and must be changed in the Settings page`);
  }

  if (definition.enum && (typeof value !== 'string' || !definition.enum.includes(value))) {
    throw new Error(`${key} must be one of: ${definition.enum.join(', ')}`);
  }

  let validatedValue: unknown;
  switch (definition.type) {
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new Error(`${key} must be a boolean`);
      }
      validatedValue = value;
      break;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${key} must be a finite number`);
      }
      validatedValue = value;
      break;
    case 'string':
      if (typeof value !== 'string') {
        throw new Error(`${key} must be a string`);
      }
      validatedValue = value;
      break;
    case 'json':
      try {
        JSON.stringify(value);
      } catch {
        throw new Error(`${key} must be JSON-serializable`);
      }
      validatedValue = value;
      break;
  }

  validateSettingBoundary(key, validatedValue);
  return validatedValue;
}

function validateSettingBoundary(key: SettingKey, value: unknown): void {
  switch (key) {
    case 'auto_sync_interval':
      if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 1440) {
        throw new Error('auto_sync_interval must be an integer between 1 and 1440');
      }
      return;
    case 'custom_server_url':
      validateStringLength(key, value, VALIDATION_LIMITS.SYNC_SERVER_URL_MAX, '同步服务器地址');
      return;
    case 'sync_access_token':
      validateStringLength(key, value, VALIDATION_LIMITS.SYNC_ACCESS_TOKEN_MAX, '同步访问令牌');
      return;
    case 'sync_encryption_key':
      validateStringLength(key, value, VALIDATION_LIMITS.SYNC_ENCRYPTION_KEY_MAX, '同步加密密钥');
      return;
    case 'jenkins_host':
      validateStringLength(key, value, VALIDATION_LIMITS.JENKINS_HOST_MAX, 'Jenkins 地址');
      return;
    case 'jenkins_user':
      validateStringLength(key, value, VALIDATION_LIMITS.JENKINS_USER_MAX, 'Jenkins 用户名');
      return;
    case 'jenkins_token':
      validateStringLength(key, value, VALIDATION_LIMITS.JENKINS_TOKEN_MAX, 'Jenkins Token');
      return;
    case 'jenkins_environments':
      validateJenkinsEnvironments(value);
      return;
    default:
      return;
  }
}

function validateStringLength(
  key: SettingKey,
  value: unknown,
  maxLength: number,
  label: string
): void {
  if (typeof value !== 'string') {
    throw new Error(`${key} must be a string`);
  }

  const result = validateLength(value, maxLength, label);
  if (!result.valid) {
    throw new Error(result.error ?? `${key} is too long`);
  }
}

function validateJenkinsEnvironments(value: unknown): asserts value is JenkinsEnvironment[] {
  if (!Array.isArray(value)) {
    throw new Error('jenkins_environments must be an array');
  }

  for (const env of value) {
    if (!env || typeof env !== 'object' || Array.isArray(env)) {
      throw new Error('jenkins_environments entries must be objects');
    }

    const candidate = env as Partial<JenkinsEnvironment>;
    validateStringLength('jenkins_environments', candidate.id, 200, 'Jenkins 环境 ID');
    validateStringLength('jenkins_environments', candidate.name, 200, 'Jenkins 环境名称');
    validateStringLength(
      'jenkins_environments',
      candidate.host,
      VALIDATION_LIMITS.JENKINS_HOST_MAX,
      'Jenkins 地址'
    );
    validateStringLength(
      'jenkins_environments',
      candidate.user,
      VALIDATION_LIMITS.JENKINS_USER_MAX,
      'Jenkins 用户名'
    );
    validateStringLength(
      'jenkins_environments',
      candidate.token,
      VALIDATION_LIMITS.JENKINS_TOKEN_MAX,
      'Jenkins Token'
    );
    if (typeof candidate.order !== 'number' || !Number.isFinite(candidate.order)) {
      throw new Error('jenkins_environments order must be a finite number');
    }
  }
}

async function buildConfigEntry(key: SettingKey): Promise<ConfigEntry> {
  const definition = getConfigDefinition(key);
  const value = await getSetting(key);

  return {
    key,
    category: definition.category,
    description: definition.description,
    type: definition.type,
    enum: definition.enum ? [...definition.enum] : undefined,
    writable: definition.writable && !definition.sensitive,
    configured: value !== undefined && value !== '',
    value: toDisplayValue(key, value),
  };
}

async function dpp_config_get(args: unknown) {
  const objectArgs = args === undefined ? {} : parseObjectArgs(args);
  const categoryValue = objectArgs.category;
  if (categoryValue !== undefined && typeof categoryValue !== 'string') {
    throw new Error('category must be a string');
  }

  const requestedKeys = getRequestedKeys(objectArgs);
  const filteredKeys = categoryValue
    ? requestedKeys.filter((key) => DPP_CONFIG_DEFINITIONS[key].category === categoryValue)
    : requestedKeys;

  return {
    configs: await Promise.all(filteredKeys.map((key) => buildConfigEntry(key))),
    categories: Array.from(
      new Set(Object.values(DPP_CONFIG_DEFINITIONS).map((definition) => definition.category))
    ),
    updateUsage:
      'Use dpp_config_update with updates object, for example: {"theme":"dark","feature_jenkins_enabled":false}. Sensitive values are masked in logs/results.',
  };
}

function parseUpdates(args: unknown): Record<SettingKey, unknown> {
  const objectArgs = parseObjectArgs(args);
  const updatesValue = objectArgs.updates;

  if (!updatesValue || typeof updatesValue !== 'object' || Array.isArray(updatesValue)) {
    throw new Error('updates must be an object mapping DPP config keys to values');
  }

  const updates: Partial<Record<SettingKey, unknown>> = {};
  for (const [key, value] of Object.entries(updatesValue)) {
    if (!isSettingKey(key)) {
      throw new Error(`Unknown DPP config key: ${key}`);
    }
    if (key.startsWith('ai_')) {
      throw new Error('AI settings must be changed through ai_config_update');
    }
    updates[key] = value;
  }

  return updates as Record<SettingKey, unknown>;
}

async function notifyAutoSyncSettingsChanged(updatedKeys: SettingKey[]): Promise<void> {
  if (!updatedKeys.some((key) => SYNC_RELATED_SETTING_KEYS.has(key))) {
    return;
  }

  try {
    await browser.runtime.sendMessage({ type: 'AUTO_SYNC_SETTINGS_CHANGED' });
  } catch (error) {
    logger.error('[DPPConfig] Failed to notify auto sync settings change:', error);
  }
}

async function dpp_config_update(args: unknown) {
  const updates = parseUpdates(args);
  const entries = Object.entries(updates) as Array<[SettingKey, unknown]>;
  const validatedEntries = entries.map(
    ([key, rawValue]) => [key, validateValue(key, rawValue)] as const
  );
  const updatedKeys = validatedEntries.map(([key]) => key);

  await db.transaction('rw', db.settings, async () => {
    await db.settings.bulkPut(
      validatedEntries.map(([key, value]) => ({
        key,
        value: value as SettingValue<SettingKey>,
      }))
    );
  });
  await notifyAutoSyncSettingsChanged(updatedKeys);

  return {
    success: true,
    action: 'dpp_config_updated',
    updatedKeys,
    configs: await Promise.all(updatedKeys.map((key) => buildConfigEntry(key))),
  };
}

export function registerDPPConfigTools() {
  toolRegistry.register({
    name: 'dpp_config_get',
    description: '按键或分类读取 DPP 应用设置。敏感值会被隐藏。修改未知设置前请先使用此工具。',
    parameters: createToolParameter(
      {
        keys: {
          type: 'string',
          description: '要读取的配置键，使用逗号分隔。不提供时读取所有已知的 DPP 配置键。',
        },
        category: {
          type: 'string',
          description:
            '可选分类筛选：appearance、features、jenkins、sync、ai、display、links、runtime。',
        },
      },
      []
    ),
    handler: dpp_config_get as ToolHandler,
  });

  toolRegistry.register({
    name: 'dpp_config_update',
    description:
      '更新 DPP 应用设置。传入将 SettingKey 映射到新类型值的 updates 对象。由运行时管理的配置键为只读。',
    parameters: createToolParameter(
      {
        updates: {
          type: 'object',
          description:
            '将 DPP 配置键映射到新值的对象。例如：{"theme":"dark","feature_jenkins_enabled":false,"auto_sync_interval":30}',
        },
      },
      ['updates']
    ),
    handler: dpp_config_update as ToolHandler,
    requiresConfirmation: true,
  });
}
