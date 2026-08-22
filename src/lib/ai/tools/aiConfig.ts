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
  apiKeyConfigured: boolean;
}

interface AIProfileSummary {
  id: string;
  name: string;
  provider: AIProviderType;
  baseUrl: string;
  model: string;
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
    description:
      'Get D仔 current AI configuration and all provider configurations. API keys are masked.',
    parameters: createToolParameter({}, []),
    handler: ai_config_get as ToolHandler,
  });

  toolRegistry.register({
    name: 'ai_config_update',
    description:
      'Update D仔 AI configuration. Can change provider, baseUrl, model, apiKey, clear apiKey, and choose whether to activate the provider.',
    parameters: createToolParameter(
      {
        provider: {
          type: 'string',
          description:
            'Target protocol adapter to update. Use profileId for an existing profile. Defaults to the current configuration.',
          enum: ['opencode', 'custom', 'anthropic', 'ollama', 'google'],
        },
        profileId: {
          type: 'string',
          description:
            'Existing profile ID. Omit to update the current configuration or create one.',
        },
        name: {
          type: 'string',
          description: 'Profile display name.',
        },
        baseUrl: {
          type: 'string',
          description: 'New provider base URL. Omit to keep the existing value.',
        },
        model: {
          type: 'string',
          description: 'New model name. Omit to keep the existing value.',
        },
        apiKey: {
          type: 'string',
          description: 'New API key. Omit to keep the existing value.',
        },
        clearApiKey: {
          type: 'boolean',
          description: 'Clear the API key for the target provider.',
        },
        activateProvider: {
          type: 'boolean',
          description:
            'Whether to switch D仔 to the target provider after updating. Defaults to true.',
        },
      },
      []
    ),
    handler: ai_config_update as ToolHandler,
    requiresConfirmation: true,
  });
}
