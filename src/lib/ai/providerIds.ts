export const AI_PROVIDER_TYPES = [
  'ollama',
  'anthropic',
  'google',
  'openai',
  'deepseek',
  'qwen',
  'groq',
  'xai',
  'mistral',
  'moonshot',
  'minimax',
  'openrouter',
  'together',
  'fireworks',
  'cerebras',
  'opencode',
  'custom',
] as const;

export type AIProviderType = (typeof AI_PROVIDER_TYPES)[number];

export const DEFAULT_AI_PROVIDER: AIProviderType = 'opencode';

export function isAIProviderType(value: unknown): value is AIProviderType {
  return (
    typeof value === 'string' && AI_PROVIDER_TYPES.some((providerType) => providerType === value)
  );
}
