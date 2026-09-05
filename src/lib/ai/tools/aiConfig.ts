import {
  type StoredAIConfig,
  activateAIProfile,
  createAIProfile,
  loadAIConfig,
  loadAIProfiles,
  loadProviderConfig,
  saveProviderConfig,
  updateAIProfile,
} from '@/features/aiAssistant/lib/aiConfigStorage';
import { AI_PROVIDER_TYPES, isAIProviderType } from '@/lib/ai/providerIds';
import type { AIProviderType } from '@/lib/ai/types';
import { createToolParameter, toolRegistry } from '../tools';
import type { ToolHandler } from '../tools';

type UserAIProvider = Exclude<AIProviderType, 'opencode'>;

interface AIConfigSummary {
  provider: AIProviderType;
  baseUrl: string;
  model: string;
  contextWindow?: number;
  visionEnabled: boolean;
  apiKeyConfigured: boolean;
}

interface AIProfileSummary {
  id: string;
  name: string;
  provider: AIProviderType;
  baseUrl: string;
  model: string;
  visionEnabled: boolean;
  apiKeyConfigured: boolean;
}

interface AIConfigUpdateArgs {
  profileId?: string;
  name?: string;
  provider?: AIProviderType;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  clearApiKey?: boolean;
  activateProvider?: boolean;
  contextWindow?: number;
  visionEnabled?: boolean;
}

function readStringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`${key} must be a string`);
  }
  return value;
}

function readBooleanArg(args: Record<string, unknown>, key: string): boolean | undefined {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    throw new Error(`${key} must be a boolean`);
  }
  return value;
}

function readNumberArg(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${key} must be a positive number`);
  }
  return value;
}

function parseObjectArgs(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    throw new Error('Arguments must be an object');
  }
  return args as Record<string, unknown>;
}

function summarizeConfig(config: StoredAIConfig): AIConfigSummary {
  return {
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    contextWindow: config.contextWindow,
    visionEnabled: config.visionEnabled === true,
    apiKeyConfigured: Boolean(config.apiKey),
  };
}

function readProfileId(args: Record<string, unknown>): string | undefined {
  return readStringArg(args, 'profileId');
}

async function ai_config_get() {
  const currentConfig = await loadAIConfig();
  const profiles = await loadAIProfiles();
  const providerConfigs: AIProfileSummary[] = await Promise.all(
    profiles.map(async (profile) => ({
      id: profile.id,
      name: profile.name,
      provider: profile.provider,
      baseUrl: profile.baseUrl,
      model: profile.model,
      visionEnabled: profile.visionEnabled === true,
      apiKeyConfigured: Boolean(profile.apiKey),
    }))
  );

  return {
    currentProvider: currentConfig.provider,
    current: summarizeConfig(currentConfig),
    profiles: providerConfigs,
    editableFields: [
      'profileId',
      'name',
      'provider',
      'baseUrl',
      'model',
      'apiKey',
      'clearApiKey',
      'activateProvider',
      'contextWindow',
      'visionEnabled',
    ],
    note: 'API Key 只返回是否已配置；修改时请通过 ai_config_update 传入新值。',
  };
}

function parseUpdateArgs(args: unknown): AIConfigUpdateArgs {
  const objectArgs = parseObjectArgs(args);
  const providerValue = objectArgs.provider;
  if (providerValue !== undefined && !isAIProviderType(providerValue)) {
    throw new Error(`provider must be one of: ${AI_PROVIDER_TYPES.join(', ')}`);
  }

  return {
    profileId: readProfileId(objectArgs),
    name: readStringArg(objectArgs, 'name'),
    provider: providerValue,
    baseUrl: readStringArg(objectArgs, 'baseUrl'),
    model: readStringArg(objectArgs, 'model'),
    contextWindow: readNumberArg(objectArgs, 'contextWindow'),
    visionEnabled: readBooleanArg(objectArgs, 'visionEnabled'),
    apiKey: readStringArg(objectArgs, 'apiKey'),
    clearApiKey: readBooleanArg(objectArgs, 'clearApiKey'),
    activateProvider: readBooleanArg(objectArgs, 'activateProvider'),
  };
}

async function ai_config_update(args: unknown) {
  const parsed = parseUpdateArgs(args);
  const currentConfig = await loadAIConfig();
  const profiles = await loadAIProfiles();
  const targetProfile = parsed.profileId
    ? profiles.find((profile) => profile.id === parsed.profileId)
    : undefined;
  if (parsed.profileId && !targetProfile) {
    throw new Error('profileId not found');
  }
  const targetProvider = targetProfile?.provider ?? parsed.provider ?? currentConfig.provider;
  const existingConfig = targetProfile ?? (await loadProviderConfig(targetProvider));
  const activateProvider = parsed.activateProvider ?? true;

  if (parsed.clearApiKey && parsed.apiKey !== undefined) {
    throw new Error('apiKey and clearApiKey cannot be used together');
  }

  const nextConfig: StoredAIConfig = {
    provider: targetProvider,
    baseUrl: parsed.baseUrl ?? existingConfig.baseUrl,
    model: parsed.model ?? existingConfig.model,
    contextWindow: parsed.contextWindow ?? existingConfig.contextWindow,
    visionEnabled: parsed.visionEnabled ?? existingConfig.visionEnabled,
    apiKey: parsed.clearApiKey ? '' : (parsed.apiKey ?? existingConfig.apiKey),
  };
  const preserveApiKey = parsed.apiKey === undefined && parsed.clearApiKey !== true;

  if (targetProfile) {
    await updateAIProfile(targetProfile.id, {
      ...nextConfig,
      name: parsed.name ?? targetProfile.name,
      provider: targetProfile.provider as UserAIProvider,
    });
    if (activateProvider) await activateAIProfile(targetProfile.id);
  } else {
    const matchingProfile = profiles.find(
      (profile) => profile.provider === targetProvider && profile.baseUrl === nextConfig.baseUrl
    );
    if (matchingProfile && parsed.name) {
      await updateAIProfile(matchingProfile.id, {
        ...nextConfig,
        name: parsed.name,
        provider: matchingProfile.provider as UserAIProvider,
      });
      if (activateProvider) await activateAIProfile(matchingProfile.id);
    } else if (parsed.name && targetProvider !== 'opencode') {
      await createAIProfile(
        { ...nextConfig, name: parsed.name, provider: targetProvider as UserAIProvider },
        { activate: activateProvider }
      );
    } else {
      await saveProviderConfig(nextConfig, { activateProvider, preserveApiKey });
    }
  }

  return {
    success: true,
    action: 'ai_config_updated',
    activatedProvider: activateProvider ? targetProvider : currentConfig.provider,
    updatedProvider: targetProvider,
    config: summarizeConfig(nextConfig),
    message: activateProvider
      ? `D仔配置已更新并切换到 ${targetProvider}`
      : `D仔的 ${targetProvider} 配置已更新，当前服务商未切换`,
  };
}

export function registerAIConfigTools() {
  toolRegistry.register({
    name: 'ai_config_get',
    description: '获取 D 仔当前 AI 配置以及所有服务商配置。API 密钥会被隐藏。',
    parameters: createToolParameter({}, []),
    handler: ai_config_get as ToolHandler,
  });

  toolRegistry.register({
    name: 'ai_config_update',
    description:
      '更新 D 仔 AI 配置。可以修改服务商、baseUrl、模型、apiKey、清除 apiKey，并选择是否激活该服务商。',
    parameters: createToolParameter(
      {
        provider: {
          type: 'string',
          description: '要更新的协议适配器。更新已有配置档案时使用 profileId。默认使用当前配置。',
          enum: ['opencode', 'custom', 'anthropic', 'google'],
        },
        profileId: {
          type: 'string',
          description: '已有配置档案 ID。不提供时更新当前配置或创建新配置。',
        },
        name: {
          type: 'string',
          description: '配置档案显示名称。',
        },
        baseUrl: {
          type: 'string',
          description: '新的服务商基础 URL。不提供时保留现有值。',
        },
        model: {
          type: 'string',
          description: '新的模型名称。不提供时保留现有值。',
        },
        apiKey: {
          type: 'string',
          description: '新的 API 密钥。不提供时保留现有值。',
        },
        clearApiKey: {
          type: 'boolean',
          description: '清除目标服务商的 API 密钥。',
        },
        activateProvider: {
          type: 'boolean',
          description: '更新后是否将 D 仔切换到目标服务商。默认为 true。',
        },
        contextWindow: {
          type: 'number',
          minimum: 1,
          description: '可选的正数上下文窗口覆盖值。',
        },
        visionEnabled: {
          type: 'boolean',
          description: '目标模型是否接受浏览器截图作为图像输入。',
        },
      },
      []
    ),
    handler: ai_config_update as ToolHandler,
    requiresConfirmation: true,
  });
}
