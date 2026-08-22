export const AI_PROVIDER_TYPES = ['anthropic', 'google', 'opencode', 'custom'] as const;

export type AIProviderType = (typeof AI_PROVIDER_TYPES)[number];

export const DEFAULT_AI_PROVIDER: AIProviderType = 'opencode';

export function isAIProviderType(value: unknown): value is AIProviderType {
  return (
    typeof value === 'string' && AI_PROVIDER_TYPES.some((providerType) => providerType === value)
  );
}
