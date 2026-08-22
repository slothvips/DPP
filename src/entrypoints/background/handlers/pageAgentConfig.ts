import { getAIConfig } from '@/lib/db/settings';
import { resolvePageAgentApiKey } from '@/lib/pageAgent/types';

export type AIConfigValidationResult =
  | { success: true; config: { baseUrl: string; apiKey: string; model: string } }
  | { success: false; error: string };

export async function validateAIConfig(): Promise<AIConfigValidationResult> {
  const aiConfig = await getAIConfig();

  if (!aiConfig) {
    return { success: false, error: '请先配置 AI 服务' };
  }

  if (!aiConfig.model) {
    return { success: false, error: '请先配置模型' };
  }

  return {
    success: true,
    config: {
      baseUrl: 'https://dpp-page-agent.invalid/v1',
      apiKey: resolvePageAgentApiKey(),
      model: aiConfig.model,
    },
  };
}
