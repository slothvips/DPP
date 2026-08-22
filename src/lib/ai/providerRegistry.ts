import { AI_PROVIDER_TYPES } from './providerIds';
import type { AIProviderType } from './providerIds';

export type AIProviderProtocol = 'anthropic' | 'google' | 'openai-compatible';

export interface AIProviderDefinition {
  id: AIProviderType;
  label: string;
  protocol: AIProviderProtocol;
  defaultBaseUrl: string;
  defaultModel: string;
  apiKeyPlaceholder: string;
  baseUrlPlaceholder: string;
  modelPlaceholder: string;
  requiresApiKey: boolean;
}

export const AI_PROVIDER_REGISTRY = {
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    protocol: 'anthropic',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-haiku-20240307',
    apiKeyPlaceholder: 'sk-ant-...',
    baseUrlPlaceholder: 'https://api.anthropic.com',
    modelPlaceholder: 'claude-sonnet-4-6',
    requiresApiKey: true,
  },
  google: {
    id: 'google',
    label: 'Google Gemini',
    protocol: 'google',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash',
    apiKeyPlaceholder: 'AIza...',
    baseUrlPlaceholder: 'https://generativelanguage.googleapis.com/v1beta',
    modelPlaceholder: 'gemini-2.5-flash',
    requiresApiKey: true,
  },
  opencode: {
    id: 'opencode',
    label: 'OpenCode Free（内置）',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://opencode.ai/zen/v1',
    defaultModel: 'big-pickle',
    apiKeyPlaceholder: '可选，留空使用公共免费身份',
    baseUrlPlaceholder: 'https://opencode.ai/zen/v1',
    modelPlaceholder: 'big-pickle',
    requiresApiKey: false,
  },
  custom: {
    id: 'custom',
    label: '其他 OpenAI 兼容服务',
    protocol: 'openai-compatible',
    defaultBaseUrl: '',
    defaultModel: '',
    apiKeyPlaceholder: 'sk-...',
    baseUrlPlaceholder: 'https://api.example.com/v1',
    modelPlaceholder: 'model-name',
    requiresApiKey: true,
  },
} as const satisfies Record<AIProviderType, AIProviderDefinition>;

export const AI_PROVIDER_DEFINITIONS = AI_PROVIDER_TYPES.map(
  (providerType) => AI_PROVIDER_REGISTRY[providerType]
);

export function getAIProviderDefinition(providerType: AIProviderType): AIProviderDefinition {
  return AI_PROVIDER_REGISTRY[providerType];
}

export function isOpenAICompatibleProvider(providerType: AIProviderType): boolean {
  return getAIProviderDefinition(providerType).protocol === 'openai-compatible';
}
