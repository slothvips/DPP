import { AI_PROVIDER_DEFINITIONS, getAIProviderDefinition } from '@/lib/ai/providerRegistry';
import type { AIProviderType } from '@/lib/ai/types';

export const PROVIDER_OPTIONS: { value: AIProviderType; label: string }[] = [
  { value: 'opencode', label: 'OpenCode Free（内置）' },
  { value: 'custom', label: 'OpenAI 兼容' },
  { value: 'anthropic', label: 'Anthropic 兼容' },
  { value: 'ollama', label: 'Ollama（本地）' },
  { value: 'google', label: 'Google Gemini' },
];

export function toConfigProvider(provider: AIProviderType): AIProviderType {
  const definition = AI_PROVIDER_DEFINITIONS.find((item) => item.id === provider);
  return definition?.protocol === 'openai-compatible' && provider !== 'opencode'
    ? 'custom'
    : provider;
}

export function shouldShowApiKey(provider: AIProviderType): boolean {
  return getAIProviderDefinition(provider).requiresApiKey;
}

export function getBaseUrlPlaceholder(provider: AIProviderType): string {
  return getAIProviderDefinition(provider).baseUrlPlaceholder;
}

export function getModelPlaceholder(provider: AIProviderType): string {
  return getAIProviderDefinition(provider).modelPlaceholder;
}

export function getApiKeyPlaceholder(provider: AIProviderType): string {
  return getAIProviderDefinition(provider).apiKeyPlaceholder;
}
