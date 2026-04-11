import { getAIConfig } from '@/lib/db/settings';

export type AIConfigValidationResult =
  | { success: true; config: { baseUrl: string; apiKey: string; model: string } }
  | { success: false; error: string };

export async function validateAIConfig(): Promise<AIConfigValidationResult> {
  const aiConfig = await getAIConfig();

  if (!aiConfig) {
    return { success: false, error: '请先配置 AI 服务' };
  }

  if (!aiConfig.apiKey) {
    return { success: false, error: '请先配置 API Key' };
  }

  if (aiConfig.isAnthropicProvider) {
    return {
      success: false,
      error:
        'Page Agent 仅支持 OpenAI 兼容格式的 API。Anthropic 供应商使用的是 Anthropic 格式端点，不兼容。请切换到其他供应商（如 OpenAI、DeepSeek、Qwen 等），或使用 OpenAI 兼容的第三方代理服务。',
    };
  }

  return {
    success: true,
    config: {
      baseUrl: aiConfig.baseUrl,
      apiKey: aiConfig.apiKey || '',
      model: aiConfig.model,
    },
  };
}
