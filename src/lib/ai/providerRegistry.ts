import { AI_PROVIDER_TYPES } from './providerIds';
import type { AIProviderType } from './providerIds';

export type AIProviderProtocol = 'ollama' | 'anthropic' | 'google' | 'openai-compatible';

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
  ollama: {
    id: 'ollama',
    label: 'Ollama (本地)',
    protocol: 'ollama',
    defaultBaseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.2',
    apiKeyPlaceholder: '',
    baseUrlPlaceholder: 'http://localhost:11434',
    modelPlaceholder: 'llama3.2',
    requiresApiKey: false,
  },
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
  openai: {
    id: 'openai',
    label: 'OpenAI',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-5.4-mini',
    apiKeyPlaceholder: 'sk-...',
    baseUrlPlaceholder: 'https://api.openai.com/v1',
    modelPlaceholder: 'gpt-5.4-mini',
    requiresApiKey: true,
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    apiKeyPlaceholder: 'sk-...',
    baseUrlPlaceholder: 'https://api.deepseek.com/v1',
    modelPlaceholder: 'deepseek-chat',
    requiresApiKey: true,
  },
  qwen: {
    id: 'qwen',
    label: '通义千问',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    apiKeyPlaceholder: 'sk-...',
    baseUrlPlaceholder: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelPlaceholder: 'qwen-plus',
    requiresApiKey: true,
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    apiKeyPlaceholder: 'gsk_...',
    baseUrlPlaceholder: 'https://api.groq.com/openai/v1',
    modelPlaceholder: 'llama-3.3-70b-versatile',
    requiresApiKey: true,
  },
  xai: {
    id: 'xai',
    label: 'xAI',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-4.5',
    apiKeyPlaceholder: 'xai-...',
    baseUrlPlaceholder: 'https://api.x.ai/v1',
    modelPlaceholder: 'grok-4.5',
    requiresApiKey: true,
  },
  mistral: {
    id: 'mistral',
    label: 'Mistral AI',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    apiKeyPlaceholder: '...',
    baseUrlPlaceholder: 'https://api.mistral.ai/v1',
    modelPlaceholder: 'mistral-small-latest',
    requiresApiKey: true,
  },
  moonshot: {
    id: 'moonshot',
    label: 'Kimi / Moonshot',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://api.moonshot.ai/v1',
    defaultModel: 'kimi-k2.5',
    apiKeyPlaceholder: 'sk-...',
    baseUrlPlaceholder: 'https://api.moonshot.ai/v1',
    modelPlaceholder: 'kimi-k2.5',
    requiresApiKey: true,
  },
  minimax: {
    id: 'minimax',
    label: 'MiniMax',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://api.minimax.io/v1',
    defaultModel: 'MiniMax-M2.5',
    apiKeyPlaceholder: '...',
    baseUrlPlaceholder: 'https://api.minimax.io/v1',
    modelPlaceholder: 'MiniMax-M2.5',
    requiresApiKey: true,
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    apiKeyPlaceholder: 'sk-or-v1-...',
    baseUrlPlaceholder: 'https://openrouter.ai/api/v1',
    modelPlaceholder: 'openai/gpt-4o-mini',
    requiresApiKey: true,
  },
  together: {
    id: 'together',
    label: 'Together AI',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    apiKeyPlaceholder: '...',
    baseUrlPlaceholder: 'https://api.together.xyz/v1',
    modelPlaceholder: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    requiresApiKey: true,
  },
  fireworks: {
    id: 'fireworks',
    label: 'Fireworks AI',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://api.fireworks.ai/inference/v1',
    defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    apiKeyPlaceholder: 'fw_...',
    baseUrlPlaceholder: 'https://api.fireworks.ai/inference/v1',
    modelPlaceholder: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    requiresApiKey: true,
  },
  cerebras: {
    id: 'cerebras',
    label: 'Cerebras',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://api.cerebras.ai/v1',
    defaultModel: 'gpt-oss-120b',
    apiKeyPlaceholder: 'csk-...',
    baseUrlPlaceholder: 'https://api.cerebras.ai/v1',
    modelPlaceholder: 'gpt-oss-120b',
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
