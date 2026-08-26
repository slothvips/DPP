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
        description: `${provider.label} base URL`,
        type: 'string',
        writable: true,
      },
    ],
    [
      `ai_${provider.id}_model`,
      {
        category: 'ai',
        description: `${provider.label} model`,
        type: 'string',
        writable: true,
      },
    ],
    [
      `ai_${provider.id}_api_key`,
      {
        category: 'ai',
        description: `${provider.label} API key`,
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
    description: 'DPP theme mode',
    type: 'string',
    enum: ['light', 'dark'],
    writable: true,
  },
  last_sync_time: {
    category: 'runtime',
    description: 'Last sync timestamp',
    type: 'number',
    writable: false,
  },
  last_sync_status: {
    category: 'runtime',
    description: 'Last sync status',
    type: 'string',
    writable: false,
  },
  global_sync_status: {
    category: 'runtime',
    description: 'Global sync runtime status',
    type: 'string',
    enum: ['idle', 'syncing', 'partial', 'error'],
    writable: false,
  },
  global_sync_error: {
    category: 'runtime',
    description: 'Global sync runtime error',
    type: 'string',
    writable: false,
  },
  last_global_sync: {
    category: 'runtime',
    description: 'Last global sync timestamp',
    type: 'number',
    writable: false,
  },
  jenkins_host: {
    category: 'jenkins',
    description: 'Legacy Jenkins server host',
    type: 'string',
    writable: true,
  },
  jenkins_user: {
    category: 'jenkins',
    description: 'Legacy Jenkins user',
    type: 'string',
    writable: true,
  },
  jenkins_token: {
    category: 'jenkins',
    description: 'Legacy Jenkins API token',
    sensitive: true,
    type: 'string',
    writable: true,
  },
  jenkins_environments: {
    category: 'jenkins',
    description: 'Jenkins environment list',
    sensitive: true,
    type: 'json',
    writable: true,
  },
  jenkins_current_env: {
    category: 'jenkins',
    description: 'Current Jenkins environment ID',
    type: 'string',
    writable: true,
  },
  custom_server_url: {
    category: 'sync',
    description: 'DPP sync server URL',
    type: 'string',
    writable: true,
  },
  sync_access_token: {
    category: 'sync',
    description: 'DPP sync access token',
    sensitive: true,
    type: 'string',
    writable: true,
  },
  sync_encryption_key: {
    category: 'sync',
    description: 'DPP sync encryption key',
    sensitive: true,
    type: 'string',
    writable: true,
  },
  personal_encryption_key: {
    category: 'security',
    description: 'Personal encryption key for private data (never share; not team sync key)',
    sensitive: true,
    type: 'string',
    writable: false,
  },
  personal_sync_bootstrap_done: {
    category: 'runtime',
    description: 'Whether personal sync tables have been bootstrapped into the operations queue',
    type: 'boolean',
    writable: false,
  },
  feature_hotnews_enabled: {
    category: 'features',
    description: 'Show Hot News feature',
    type: 'boolean',
    writable: true,
  },
  feature_links_enabled: {
    category: 'features',
    description: 'Show Links feature',
    type: 'boolean',
    writable: true,
  },
  feature_blackboard_enabled: {
    category: 'features',
    description: 'Show Blackboard feature',
    type: 'boolean',
    writable: true,
  },
  feature_jenkins_enabled: {
    category: 'features',
    description: 'Show Jenkins feature',
    type: 'boolean',
    writable: true,
  },
  feature_recorder_enabled: {
    category: 'features',
    description: 'Show Recorder feature',
    type: 'boolean',
    writable: true,
  },
  feature_ai_assistant_enabled: {
    category: 'features',
    description: 'Show D仔 feature',
    type: 'boolean',
    writable: true,
  },
  feature_playground_enabled: {
    category: 'features',
    description: 'Show Playground feature',
    type: 'boolean',
    writable: true,
  },
  feature_totp_enabled: {
    category: 'features',
    description: 'Show TOTP authenticator feature',
    type: 'boolean',
    writable: true,
  },
  sync_client_id: {
    category: 'runtime',
    description: 'DPP sync client ID',
    sensitive: true,
    type: 'string',
    writable: false,
  },
  global_sync_start_time: {
    category: 'runtime',
    description: 'Global sync start timestamp',
    type: 'number',
    writable: false,
  },
  show_others_builds: {
    category: 'display',
    description: 'Show Jenkins builds triggered by other users',
    type: 'boolean',
    writable: true,
  },
  jenkins_builds_last_refresh_by_env: {
    category: 'runtime',
    description: 'Jenkins builds last refresh time by environment',
    type: 'json',
    writable: false,
  },
  jenkins_jobs_last_refresh_by_env: {
    category: 'runtime',
    description: 'Jenkins jobs last refresh time by environment',
    type: 'json',
    writable: false,
  },
  auto_sync_enabled: {
    category: 'sync',
    description: 'Enable automatic sync',
    type: 'boolean',
    writable: true,
  },
  auto_sync_interval: {
    category: 'sync',
    description: 'Automatic sync interval in minutes',
    type: 'number',
    writable: true,
  },
  ai_provider_type: {
    category: 'ai',
    description: 'Current D仔 AI provider',
    type: 'string',
    enum: AI_PROVIDER_TYPES,
    writable: true,
  },
  ai_active_profile_id: {
    category: 'ai',
    description: 'Active AI profile ID',
    type: 'string',
    writable: true,
  },
  ai_base_url: {
    category: 'ai',
    description: 'Legacy AI base URL',
    type: 'string',
    writable: true,
  },
  ai_model: {
    category: 'ai',
    description: 'Legacy AI model',
    type: 'string',
    writable: true,
  },
  ai_api_key: {
    category: 'ai',
    description: 'Legacy AI API key',
    sensitive: true,
    type: 'string',
    writable: true,
  },
  ai_opencode_vision_enabled: {
    category: 'ai',
    description: 'Allow the current OpenCode model to receive browser screenshots',
    type: 'boolean',
    writable: true,
  },
  ...AI_PROVIDER_CONFIG_DEFINITIONS,
  links_sort_by: {
    category: 'links',
    description: 'Links sorting field',
    type: 'string',
    enum: ['createdAt', 'updatedAt', 'usageCount', 'lastUsedAt'],
    writable: true,
  },
  totp_pin_hash: {
    category: 'security',
    description: 'TOTP PIN hash (local UI lock only)',
    sensitive: true,
    type: 'string',
    writable: false,
  },
  totp_pin_salt: {
    category: 'security',
    description: 'TOTP PIN salt',
    sensitive: true,
    type: 'string',
    writable: false,
  },
  totp_pin_iterations: {
    category: 'security',
    description: 'TOTP PIN PBKDF2 iterations',
    type: 'number',
    writable: false,
  },
  totp_pin_auto_lock_minutes: {
    category: 'security',
    description: 'TOTP PIN auto-lock idle minutes (0 = lock only when leaving)',
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
    description:
      'Get DPP application settings by key or category. Sensitive values are masked. Use this before changing unknown settings.',
    parameters: createToolParameter(
      {
        keys: {
          type: 'string',
          description:
            'Comma-separated config keys to read. Omit to read all known DPP config keys.',
        },
        category: {
          type: 'string',
          description:
            'Optional category filter: appearance, features, jenkins, sync, ai, display, links, runtime.',
        },
      },
      []
    ),
    handler: dpp_config_get as ToolHandler,
  });

  toolRegistry.register({
    name: 'dpp_config_update',
    description:
      'Update DPP application settings. Pass an updates object mapping SettingKey to the new typed value. Runtime-managed keys are read-only.',
    parameters: createToolParameter(
      {
        updates: {
          type: 'object',
          description:
            'Object mapping DPP config keys to new values. Example: {"theme":"dark","feature_jenkins_enabled":false,"auto_sync_interval":30}',
        },
      },
      ['updates']
    ),
    handler: dpp_config_update as ToolHandler,
    requiresConfirmation: true,
  });
}
