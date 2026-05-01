import {
  type StoredAIConfig,
  loadAIConfig,
  loadProviderConfig,
  saveProviderConfig,
} from '@/features/aiAssistant/lib/aiConfigStorage';
import type { AIProviderType } from '@/lib/ai/types';
import { createToolParameter, toolRegistry } from '../tools';
import type { ToolHandler } from '../tools';

const AI_PROVIDER_TYPES = ['ollama', 'anthropic', 'custom'] as const satisfies AIProviderType[];

interface AIConfigSummary {
  provider: AIProviderType;
  baseUrl: string;
  model: string;
  apiKeyConfigured: boolean;
  apiKeyPreview: string;
}

interface AIConfigUpdateArgs {
  provider?: AIProviderType;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  clearApiKey?: boolean;
  activateProvider?: boolean;
}

function isAIProviderType(value: unknown): value is AIProviderType {
  return typeof value === 'string' && AI_PROVIDER_TYPES.includes(value as AIProviderType);
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

function parseObjectArgs(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    throw new Error('Arguments must be an object');
  }
  return args as Record<string, unknown>;
}

function maskSecret(value: string): string {
  if (!value) {
    return '';
  }
  if (value.length <= 8) {
    return '********';
  }
  return `${value.slice(0, 3)}...${value.slice(-4)}`;
}

function summarizeConfig(config: StoredAIConfig): AIConfigSummary {
  return {
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    apiKeyConfigured: Boolean(config.apiKey),
    apiKeyPreview: maskSecret(config.apiKey),
  };
}

async function ai_config_get() {
  const currentConfig = await loadAIConfig();
  const providerConfigs = await Promise.all(
    AI_PROVIDER_TYPES.map(async (provider) => summarizeConfig(await loadProviderConfig(provider)))
  );

  return {
    currentProvider: currentConfig.provider,
    current: summarizeConfig(currentConfig),
    providers: providerConfigs,
    editableFields: ['provider', 'baseUrl', 'model', 'apiKey', 'clearApiKey', 'activateProvider'],
    note: 'apiKey 只返回脱敏预览；修改 apiKey 时请通过 ai_config_update 传入新值。',
  };
}

function parseUpdateArgs(args: unknown): AIConfigUpdateArgs {
  const objectArgs = parseObjectArgs(args);
  const providerValue = objectArgs.provider;
  if (providerValue !== undefined && !isAIProviderType(providerValue)) {
    throw new Error(`provider must be one of: ${AI_PROVIDER_TYPES.join(', ')}`);
  }

  return {
    provider: providerValue,
    baseUrl: readStringArg(objectArgs, 'baseUrl'),
    model: readStringArg(objectArgs, 'model'),
    apiKey: readStringArg(objectArgs, 'apiKey'),
    clearApiKey: readBooleanArg(objectArgs, 'clearApiKey'),
    activateProvider: readBooleanArg(objectArgs, 'activateProvider'),
  };
}

async function ai_config_update(args: unknown) {
  const parsed = parseUpdateArgs(args);
  const currentConfig = await loadAIConfig();
  const targetProvider = parsed.provider ?? currentConfig.provider;
  const existingConfig = await loadProviderConfig(targetProvider);
  const activateProvider = parsed.activateProvider ?? true;

  if (parsed.clearApiKey && parsed.apiKey !== undefined) {
    throw new Error('apiKey and clearApiKey cannot be used together');
  }

  const nextConfig: StoredAIConfig = {
    provider: targetProvider,
    baseUrl: parsed.baseUrl ?? existingConfig.baseUrl,
    model: parsed.model ?? existingConfig.model,
    apiKey: parsed.clearApiKey ? '' : (parsed.apiKey ?? existingConfig.apiKey),
  };
  const preserveApiKey = parsed.apiKey === undefined && parsed.clearApiKey !== true;

  await saveProviderConfig(nextConfig, { activateProvider, preserveApiKey });

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
            'Target provider to update. If omitted, updates the current provider. Default activation switches D仔 to this provider.',
          enum: [...AI_PROVIDER_TYPES],
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
