import type { AIProviderType } from '@/lib/ai/types';

export const PROVIDER_OPTIONS: { value: AIProviderType; label: string }[] = [
  { value: 'ollama', label: 'Ollama (本地)' },
  { value: 'anthropic', label: 'Anthropic 兼容' },
  { value: 'custom', label: 'OpenAI 兼容' },
];

export function shouldShowApiKey(provider: AIProviderType): boolean {
  return provider !== 'ollama';
}

export function getBaseUrlPlaceholder(provider: AIProviderType): string {
  switch (provider) {
    case 'ollama':
      return 'http://localhost:11434';
    case 'anthropic':
      return 'https://api.anthropic.com';
    default:
      return 'https://api.example.com/v1';
  }
}

export function getModelPlaceholder(provider: AIProviderType): string {
  switch (provider) {
    case 'ollama':
      return 'llama3.2';
    case 'anthropic':
      return 'claude-3-5-sonnet-20241022';
    default:
      return 'gpt-4o-mini';
  }
}

export function getApiKeyPlaceholder(provider: AIProviderType): string {
  return provider === 'anthropic' ? 'sk-ant-...' : 'sk-...';
}
